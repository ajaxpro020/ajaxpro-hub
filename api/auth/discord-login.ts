import {
  clearSessionCookie,
  createDiscordAuthorization,
  getDiscordRedirectOrigin,
  noStoreHeaders,
  redirect,
} from "../../lib/discord-auth";

export async function GET(request: Request) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: noStoreHeaders });
  }

  try {
    const requestOrigin = new URL(request.url).origin;
    const redirectOrigin = getDiscordRedirectOrigin();
    if (requestOrigin !== redirectOrigin) {
      return redirect(`${redirectOrigin}/api/auth/discord-login`);
    }

    const authorization = createDiscordAuthorization();
    return redirect(authorization.url, {
      "Set-Cookie": [authorization.stateCookie, clearSessionCookie()],
    });
  } catch (error) {
    console.error("Discord login could not be started", error);
    return redirect("/geen-toegang?reden=configuratie");
  }
}
