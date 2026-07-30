const AJAX_FIXTURES_URL = "https://www.ajax.nl/wedstrijden/";
const TV_GUIDE_URL = "https://www.voetbaloptv.com/wp-json/vtv/v1/wedstrijden";

const DUTCH_MONTHS: Record<string, number> = {
  januari: 0,
  februari: 1,
  maart: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  augustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  december: 11,
};

const cleanText = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeTeam = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(afc|fc|fk|sc)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

const parseAjaxDate = (value: string) => {
  const match = cleanText(value).match(
    /(?:ma|di|wo|do|vr|za|zo)\.\s+(\d{1,2})\s+([a-z]+)\s+(\d{4})\s+(\d{1,2}):(\d{2})/i,
  );

  if (!match) return null;

  const [, day, monthName, year, hours, minutes] = match;
  const month = DUTCH_MONTHS[monthName.toLowerCase()];
  if (month === undefined) return null;

  const date = new Date(
    `${year}-${String(month + 1).padStart(2, "0")}-${day.padStart(2, "0")}T${hours.padStart(2, "0")}:${minutes}:00+02:00`,
  );

  return Number.isNaN(date.getTime()) ? null : date;
};

export const parseAjaxFixtures = (html: string) => {
  const items = html.match(/<li class="matches-block__match">[\s\S]*?<\/li>/g) ?? [];
  const fixtures = items
    .map((item) => {
      const competition = cleanText(
        item.match(/class="matches-block__league">([\s\S]*?)<\/span>/)?.[1] ?? "",
      );
      const dateText = cleanText(
        item.match(/class="matches-block__date">([\s\S]*?)<\/span>/)?.[1] ?? "",
      );
      const kickoff = parseAjaxDate(dateText);
      const teamNames = [
        ...new Set(
          [...item.matchAll(/<img[^>]+alt="([^"]+)"[^>]*>/g)]
            .map((match) => cleanText(match[1]))
            .filter(Boolean),
        ),
      ];
      const [home, away] = teamNames;

      if (!kickoff || !home || !away || (home !== "Ajax" && away !== "Ajax")) return null;
      return { home, away, competition, kickoff };
    })
    .filter((fixture): fixture is NonNullable<typeof fixture> => Boolean(fixture));

  const unique = new Map(
    fixtures.map((fixture) => [`${fixture.kickoff.toISOString()}-${fixture.home}-${fixture.away}`, fixture]),
  );

  return [...unique.values()].sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
};

const parseTvDate = (date: string, time: string) => {
  const [day, month, year] = date.split("-");
  const [hours, minutes] = time.split(":");
  return new Date(`${year}-${month}-${day}T${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00+02:00`);
};

export const findTvListing = (
  listings: Array<Record<string, string>>,
  fixture: ReturnType<typeof parseAjaxFixtures>[number],
) =>
  listings.find((listing) => {
    if (!normalizeTeam(listing.thuisteam).includes("ajax") && !normalizeTeam(listing.uitteam).includes("ajax")) {
      return false;
    }

    const tvKickoff = parseTvDate(listing.datum, listing.tijd);
    const sameKickoff = Math.abs(tvKickoff.getTime() - fixture.kickoff.getTime()) < 15 * 60 * 1000;
    const sameHome = normalizeTeam(listing.thuisteam).includes(normalizeTeam(fixture.home));
    const sameAway =
      normalizeTeam(listing.uitteam).includes(normalizeTeam(fixture.away)) ||
      normalizeTeam(fixture.away).includes(normalizeTeam(listing.uitteam));

    return sameKickoff && sameHome && sameAway;
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=86400",
    },
  });

export async function GET(request: Request) {
  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const [fixturesResponse, tvResponse] = await Promise.all([
      fetch(AJAX_FIXTURES_URL, {
        headers: { "User-Agent": "AjaxPro/1.0 (+https://www.ajaxpro.fans/)" },
        signal: AbortSignal.timeout(10000),
      }),
      fetch(TV_GUIDE_URL, {
        headers: { "User-Agent": "AjaxPro/1.0 (+https://www.ajaxpro.fans/)" },
        signal: AbortSignal.timeout(10000),
      }).catch(() => null),
    ]);

    if (!fixturesResponse.ok) throw new Error(`Ajax fixtures returned ${fixturesResponse.status}`);

    const fixtures = parseAjaxFixtures(await fixturesResponse.text());
    const now = Date.now();
    const nextFixture = fixtures.find((fixture) => fixture.kickoff.getTime() > now - 3 * 60 * 60 * 1000);

    if (!nextFixture) {
      return jsonResponse({
        match: null,
        message: "De volgende wedstrijd is nog niet bekend.",
        updatedAt: new Date().toISOString(),
      });
    }

    let tvListing: Record<string, string> | undefined;
    if (tvResponse?.ok) {
      const tvPayload = await tvResponse.json();
      tvListing = findTvListing(Array.isArray(tvPayload?.data) ? tvPayload.data : [], nextFixture);
    }

    const isHome = nextFixture.home === "Ajax";
    return jsonResponse({
      match: {
        home: nextFixture.home,
        away: nextFixture.away,
        opponent: isHome ? nextFixture.away : nextFixture.home,
        isHome,
        competition: nextFixture.competition,
        kickoff: nextFixture.kickoff.toISOString(),
        tv: tvListing?.alle_zenders || tvListing?.hoofdzender || null,
      },
      sources: {
        fixture: AJAX_FIXTURES_URL,
        tv: "https://www.voetbaloptv.com/ajax-op-tv/",
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Unable to load the next Ajax match", error);
    return jsonResponse(
      {
        error: "De wedstrijdinformatie kon tijdelijk niet worden opgehaald.",
        updatedAt: new Date().toISOString(),
      },
      502,
    );
  }
}
