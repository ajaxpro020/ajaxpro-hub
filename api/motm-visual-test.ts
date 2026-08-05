import { players } from "../data/players";
import { esc } from "../lib/motm-view";
import { MOTM_VISUAL_HEIGHT, MOTM_VISUAL_TEMPLATE_URL, MOTM_VISUAL_WIDTH, splitPlayerName } from "../lib/motm-visual";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const availablePlayers = players.filter(player => player.active);
  const selectedPlayer = availablePlayers.find(player => player.id === params.get("playerId"))
    ?? availablePlayers.find(player => player.id === "brandt")
    ?? availablePlayers[0];
  if (!selectedPlayer) return new Response("Geen spelers beschikbaar.", { status: 404 });

  const matchTitle = (params.get("matchTitle") || "AJAX-SHELBOURNE FC").replace(/\+/g," ").replace(/\s+/g," ").trim().slice(0, 100);
  const requestedShirt = Number(params.get("shirtNumber"));
  const shirtNumber = params.has("shirtNumber") && Number.isInteger(requestedShirt) && requestedShirt >= 0 && requestedShirt <= 99
    ? requestedShirt
    : selectedPlayer.shirtNumber ?? 0;
  const requestedPercentage = Number(params.get("percentage"));
  const percentage = params.has("percentage") && Number.isFinite(requestedPercentage)
    ? Math.max(0, Math.min(100, Math.round(requestedPercentage)))
    : 67;
  const { firstName, lastName } = splitPlayerName(selectedPlayer.name);

  const playerOptions = availablePlayers.map(player => `<option value="${esc(player.id)}" data-shirt-number="${player.shirtNumber ?? 0}"${player.id === selectedPlayer.id ? " selected" : ""}>${esc(player.name)}</option>`).join("");
  const html = `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex,nofollow">
    <title>MOTM visualtest</title>
    <link rel="stylesheet" href="/motm.css?v=28">
  </head>
  <body>
    <main class="motm-main admin">
      <header class="page-heading"><p class="eyebrow">Tijdelijke testpagina</p><h1>MOTM visualtest</h1></header>
      <section class="management-section">
        <form method="get" action="/motm-visual-test">
          <div class="form-grid">
            <label>Speler<select name="playerId">${playerOptions}</select></label>
            <label>Wedstrijdnaam<input name="matchTitle" maxlength="100" value="${esc(matchTitle)}"></label>
            <label>Rugnummer<input name="shirtNumber" type="number" min="0" max="99" value="${shirtNumber}"></label>
            <label>Stempercentage<input name="percentage" type="number" min="0" max="100" value="${percentage}"></label>
          </div>
          <button class="button" type="submit">Visual opnieuw renderen</button>
        </form>
      </section>
      <section class="management-section">
        <div
          class="admin-winner-visual"
          data-winner-visual
          data-template-url="${MOTM_VISUAL_TEMPLATE_URL}"
          data-match-title="${esc(matchTitle.toLocaleUpperCase("nl-NL"))}"
          data-first-name="${esc(firstName.toLocaleUpperCase("nl-NL"))}"
          data-last-name="${esc(lastName.toLocaleUpperCase("nl-NL"))}"
          data-shirt-number="${shirtNumber}"
          data-percentage="${percentage}"
          data-player-id="${esc(selectedPlayer.id)}"
          data-player-image="${esc(selectedPlayer.imageUrl)}"
          data-filename="ajaxpro-motm-test-${esc(selectedPlayer.id)}.png"
        >
          <figure class="winner-visual-frame">
            <canvas width="${MOTM_VISUAL_WIDTH}" height="${MOTM_VISUAL_HEIGHT}" aria-label="MOTM-testvisual voor ${esc(selectedPlayer.name)}"></canvas>
            <figcaption data-visual-status>Template, lettertypen en spelersfoto laden…</figcaption>
          </figure>
          <button class="button secondary" type="button" data-download-visual disabled>Download PNG</button>
        </div>
      </section>
    </main>
    <script src="/motm-visual-test.js" defer></script>
    <script src="/motm-admin.js" defer></script>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
