import {
  clearSessionCookie,
  createDiscordAuthorization,
  getDiscordRedirectOrigin,
  hashOAuthState,
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
      console.info("Discord OAuth state login", {
        requestOrigin,
        redirectOrigin,
        stateCookieSet: false,
        stateHash: null,
      });
      return redirect(`${redirectOrigin}/api/auth/discord-login`);
    }

    const authorization = createDiscordAuthorization();
    const state = new URL(authorization.url).searchParams.get("state");
    console.info("Discord OAuth state login", {
      requestOrigin,
      redirectOrigin,
      stateCookieSet: true,
      stateHash: await hashOAuthState(state),
    });
    return redirect(authorization.url, {
      "Set-Cookie": [authorization.stateCookie, clearSessionCookie()],
    });
  } catch (error) {
    console.error("Discord login could not be started", error);
    return redirect("/geen-toegang?reden=configuratie");
  }
}
