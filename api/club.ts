import { noStoreHeaders, redirect } from "../lib/discord-auth";
import { permissions } from "../lib/permissions.config";
import { portalModules, type PortalModule } from "../lib/portal-modules.config";
import {
  getSessionWithPermission,
  sessionHasPermission,
} from "../lib/server-permissions";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );

const moduleLinkAttributes = (module: PortalModule) =>
  module.external ? ' target="_blank" rel="noreferrer"' : "";

const renderTool = (module: PortalModule, index: number) => `
  <a class="club-tool club-tool--${index === 0 ? "featured" : "standard"}" href="${escapeHtml(module.link)}"${moduleLinkAttributes(module)}>
    <span class="club-tool__number" aria-hidden="true">0${index + 1}</span>
    <span class="club-tool__copy">
      <span class="club-tool__status">${module.status === "available" ? "Beschikbaar" : "Binnenkort"}</span>
      <strong>${escapeHtml(module.title)}</strong>
      <span>${escapeHtml(module.description)}</span>
    </span>
    <span class="club-tool__action">Open <span aria-hidden="true">↗</span></span>
  </a>`;

export async function GET(request: Request) {
  const session = await getSessionWithPermission(request, permissions.portalAccess);
  if (!session) return redirect("/api/auth/discord-login");

  // This is the only visibility decision: modules never reach the HTML without
  // their configured server-side permission.
  const visibleModules = portalModules.filter((module) =>
    sessionHasPermission(session, module.requiredPermission),
  );
  const tools = visibleModules.filter((module) => module.kind === "tool");
  const community = visibleModules.find((module) => module.kind === "community");
  const username = escapeHtml(session.username);
  const avatarUrl = escapeHtml(session.avatarUrl);
  const html = `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="#05070d">
    <title>Club | AjaxPro</title>
    <link rel="icon" href="/Favicon/favicon.ico" sizes="any">
    <link rel="stylesheet" href="/styles.css?v=20260801-portal-shell">
  </head>
  <body class="club-page">
    <header class="club-header">
      <div class="club-header__inner">
        <a class="club-brand" href="/" aria-label="Terug naar AjaxPro">
          <img src="/assets/ajaxpro-logo.png" alt="AjaxPro">
          <span>Club</span>
        </a>
        <div class="club-account">
          <img src="${avatarUrl}" alt="Profielfoto van ${username}">
          <span class="club-account__name"><small>Ingelogd als</small><strong>${username}</strong></span>
          <form action="/api/auth/logout" method="post">
            <button type="submit">Uitloggen</button>
          </form>
        </div>
      </div>
    </header>

    <main class="club-main">
      <section class="club-hero" aria-labelledby="club-title">
        <div class="club-hero__copy">
          <p class="club-kicker">Jouw plek binnen AjaxPro</p>
          <h1 id="club-title">Welkom in de Club,<br><span>${username}.</span></h1>
          <p>Alles wat AjaxPro voor jou maakt, verzameld op één plek. Van tools voor de wedstrijd tot de gesprekken die daarna doorgaan.</p>
        </div>
        <div class="club-access-note">
          <span class="club-access-note__mark" aria-hidden="true">✓</span>
          <div><strong>Toegang bevestigd</strong><span>Via de AjaxPro Discord-server</span></div>
        </div>
      </section>

      <section class="club-tools" aria-labelledby="tools-title">
        <div class="club-section-heading">
          <div><p class="club-kicker">Voor de Ajacied</p><h2 id="tools-title">Jouw tools</h2></div>
          <p>Direct aan de slag met de tools van AjaxPro.</p>
        </div>
        <div class="club-tools__list">
          ${tools.map(renderTool).join("")}
        </div>
      </section>

      ${community ? `
      <section class="club-community" aria-labelledby="community-title">
        <div class="club-community__copy">
          <p class="club-kicker">De tribune is altijd open</p>
          <h2 id="community-title">Praat verder op Discord.</h2>
          <p>${escapeHtml(community.description)}</p>
        </div>
        <a href="${escapeHtml(community.link)}" target="_blank" rel="noreferrer">Naar de AjaxPro Discord <span aria-hidden="true">↗</span></a>
      </section>` : ""}
    </main>

    <footer class="club-footer">
      <p>AjaxPro Club</p>
      <a href="/">Terug naar de publieke homepage</a>
    </footer>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      ...noStoreHeaders,
      "Content-Type": "text/html; charset=UTF-8",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'self'; img-src 'self' https://cdn.discordapp.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}
