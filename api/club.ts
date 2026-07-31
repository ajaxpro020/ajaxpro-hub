import { noStoreHeaders, readSession, redirect } from "../lib/discord-auth";

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

export async function GET(request: Request) {
  const session = await readSession(request);
  if (!session) return redirect("/api/auth/discord-login");

  const username = escapeHtml(session.username);
  const avatarUrl = escapeHtml(session.avatarUrl);
  const html = `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="#000000">
    <title>AjaxPro Club</title>
    <link rel="icon" href="/Favicon/favicon.ico" sizes="any">
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body class="gate-page">
    <main class="gate-card" aria-labelledby="club-title">
      <a class="gate-brand" href="/" aria-label="Ajax Pro home">
        <img src="/assets/ajaxpro-logo.png" alt="Ajax Pro">
      </a>
      <img class="gate-avatar" src="${avatarUrl}" alt="Profielfoto van ${username}">
      <p class="eyebrow">Discord-toegang actief</p>
      <h1 id="club-title">Welkom, ${username}</h1>
      <p>Je bent lid van de AjaxPro Discord-server en hebt een toegestane rol. De toegang werkt.</p>
      <form action="/api/auth/logout" method="post">
        <button class="gate-button" type="submit">Uitloggen</button>
      </form>
    </main>
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
