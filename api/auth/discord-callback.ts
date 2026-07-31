import {
  clearStateCookie,
  consumeAndValidateState,
  createSessionCookie,
  exchangeDiscordCode,
  getDiscordRedirectOrigin,
  getDiscordGuildMember,
  getOAuthStateDebug,
  getDiscordUser,
  hasAllowedRole,
  redirect,
} from "../../lib/discord-auth";

const fail = (reason: string) =>
  redirect(`/geen-toegang?reden=${encodeURIComponent(reason)}`, {
    "Set-Cookie": clearStateCookie(),
  });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const stateDebug = await getOAuthStateDebug(request, state);
  console.info("Discord OAuth state callback", {
    requestOrigin: url.origin,
    redirectOrigin: getDiscordRedirectOrigin(),
    stateCookiePresent: stateDebug.cookiePresent,
    stateQueryPresent: stateDebug.queryPresent,
    stateMatches: stateDebug.matches,
    stateCookieHash: stateDebug.cookieHash,
    stateQueryHash: stateDebug.queryHash,
  });

  if (url.searchParams.get("error")) return fail("geannuleerd");
  if (!consumeAndValidateState(request, state)) {
    return fail("ongeldige-state");
  }

  const code = url.searchParams.get("code");
  if (!code) return fail("geen-code");

  try {
    const accessToken = await exchangeDiscordCode(code);
    const [user, member] = await Promise.all([
      getDiscordUser(accessToken),
      getDiscordGuildMember(accessToken),
    ]);

    if (!hasAllowedRole(member)) return fail("geen-rol");

    return redirect("/club", {
      "Set-Cookie": [clearStateCookie(), await createSessionCookie(user)],
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404) return fail("geen-lid");

    console.error("Discord callback failed", error);
    return fail("discord-fout");
  }
}
