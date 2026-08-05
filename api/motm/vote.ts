import { isSameOrigin, redirect } from "../../lib/discord-auth";
import { permissions } from "../../lib/permissions.config";
import { getSessionWithPermission } from "../../lib/server-permissions";
import { db, resultsFor } from "../../lib/motm-db";
import { esc, errorPage, formatMoment, matchHeading, matchTitle, page, pageHeader } from "../../lib/motm-view";
import { synchronizeMatch } from "../../lib/motm-scheduling";
import { canVoteAt } from "../../lib/motm-rules";

const slugOf = (request: Request) => new URL(request.url).searchParams.get("slug")?.trim() ?? "";
export async function GET(request: Request) {
  const slug = slugOf(request);
  const session = await getSessionWithPermission(request, permissions.portalAccess);
  if (!session) return redirect(`/api/auth/discord-login?returnTo=${encodeURIComponent(`/club/stemmen/${slug}`)}`);
  try {
    let [match] = await db()`SELECT * FROM motm_matches WHERE slug=${slug} AND deleted_at IS NULL`;
    if (!match) return errorPage("Stemming niet gevonden", "Controleer de gedeelde link.", 404, session);
    match = await synchronizeMatch(match as any);
    const players = await db()`SELECT * FROM motm_match_players WHERE match_id=${match.id} ORDER BY shirt_number_snapshot NULLS LAST,name_snapshot`;
    const [ownVote] = await db()`SELECT v.player_id,p.name_snapshot,p.image_url_snapshot FROM motm_votes v JOIN motm_match_players p ON p.match_id=v.match_id AND p.player_id=v.player_id WHERE v.match_id=${match.id} AND v.voter_discord_user_id=${session.userId}`;
    if (match.status === "draft") return errorPage("Nog niet geopend", "Deze stemming staat nog in concept.", 403, session);
    if (match.status === "closed") {
      const results = await resultsFor(match.id);
      const winner = results.find(row => row.rank === 1);
      const podium = results.map(row => `<li><span>${row.rank}</span><img src="${esc(row.image_url_snapshot)}" alt=""><strong>${esc(row.name_snapshot)}</strong><b>${row.percentage}%</b></li>`).join("");
      const winnerHero=winner?`<article class="result-winner"><div class="result-winner__copy"><p class="eyebrow">Man of the Match</p><h2>${esc(winner.name_snapshot)}</h2><p><strong>${winner.percentage}%</strong> van de stemmen</p></div><img class="winner-photo" src="${esc(winner.image_url_snapshot)}" alt=""></article>`:`<section class="empty"><h2>Geen stemmen</h2></section>`;
      return page("Uitslag", `<main class="motm-main result-page">${pageHeader("Uitslag","Man of the Match","/club/motm","Stemmen")}<section class="match-head status-closed"><span class="status">Gesloten</span>${matchHeading(match)}</section><section class="result">${winnerHero}${results.length?`<section class="result-ranking"><div class="section-heading"><h2>Volledige uitslag</h2></div><ol class="podium">${podium}</ol></section>`:""}<div class="own-vote">${ownVote ? `Jouw stem: <strong>${esc(ownVote.name_snapshot)}</strong>` : "Je hebt niet gestemd."}</div></section></main>`,"",session);
    }
    const cards = players.map((p:any) => `<label class="player-card"><input type="radio" name="playerId" value="${esc(p.player_id)}" ${ownVote?.player_id===p.player_id?"checked":""} required><span class="player-select"><img src="${esc(p.image_url_snapshot)}" alt=""><span><strong>${esc(p.name_snapshot)}</strong><small>${esc(p.position_snapshot)}${p.shirt_number_snapshot ? ` · #${p.shirt_number_snapshot}`:""}</small></span><i aria-hidden="true">✓</i></span></label>`).join("");
    const confirmation=ownVote?`<div class="vote-receipt"><a class="back" href="/club/motm">← Stemmen</a><section class="vote-confirmation" role="status"><img src="${esc(ownVote.image_url_snapshot)}" alt=""><div><p class="eyebrow">Jouw stem</p><h1>${esc(ownVote.name_snapshot)}</h1><p><strong>Stem opgeslagen</strong><span>${esc(matchTitle(match))}</span></p></div></section></div>`:"";
    const openContext=ownVote?confirmation:`${pageHeader("Stemmen","Man of the Match","/club/motm","Stemmen")}<section class="match-head"><span class="status status-open">Open</span>${matchHeading(match)}<p class="closing-time">Stemming sluit ${esc(formatMoment(match.scheduled_close_at))}</p></section>`;
    return page("Stem op jouw MOTM", `<main class="motm-main vote-page${ownVote?" vote-page--voted":""}">${openContext}<form method="post"><section><h2>${ownVote?"Stem wijzigen?":"Wie was jouw Man of the Match?"}</h2><p class="sub">Kies één speler. Je kunt je stem wijzigen zolang de stemming openstaat.</p><div class="player-grid">${cards}</div></section><div class="sticky-action"><button class="button" type="submit" onclick="return confirm('Weet je zeker dat je op deze speler wilt stemmen?')">${ownVote ? "Stem wijzigen" : "Stem bevestigen"}</button></div></form></main>`,"",session);
  } catch (error) { console.error("MOTM vote page failed", error); return errorPage("Tijdelijk niet beschikbaar", "De stemming kon niet worden geladen. Probeer het later opnieuw.", 503, session); }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorPage("Ongeldige aanvraag", "Ververs de pagina en probeer opnieuw.", 403);
  const session = await getSessionWithPermission(request, permissions.portalAccess);
  if (!session) return redirect(`/api/auth/discord-login?returnTo=${encodeURIComponent(`/club/stemmen/${slugOf(request)}`)}`);
  const slug = slugOf(request); const form = await request.formData(); const playerId = String(form.get("playerId") ?? "");
  try {
    let [match] = await db()`SELECT * FROM motm_matches WHERE slug=${slug} AND deleted_at IS NULL`;
    if (!match) return errorPage("Stemming niet gevonden", "Controleer de link.", 404);
    const now = new Date();
    match = await synchronizeMatch(match as any, now);
    if (!canVoteAt(match as any, now)) return errorPage("Stemmen niet mogelijk", "Deze stemming is niet open of de sluitingstijd is bereikt.", 409);
    const [selected] = await db()`SELECT 1 FROM motm_match_players WHERE match_id=${match.id} AND player_id=${playerId}`;
    if (!selected) return errorPage("Ongeldige speler", "Deze speler hoort niet bij deze wedstrijd.", 400);
    await db()`INSERT INTO motm_votes(match_id,voter_discord_user_id,player_id) VALUES(${match.id},${session.userId},${playerId}) ON CONFLICT(match_id,voter_discord_user_id) DO UPDATE SET player_id=excluded.player_id,updated_at=now()`;
    return redirect(`/club/stemmen/${slug}`);
  } catch (error) { console.error("MOTM vote failed", error); return errorPage("Stem niet opgeslagen", "Probeer het over een moment opnieuw.", 503); }
}
