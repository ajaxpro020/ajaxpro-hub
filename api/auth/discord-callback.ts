import {
  clearStateCookie,
  consumeAndValidateState,
  createSessionCookie,
  exchangeDiscordCode,
  getDiscordGuildMember,
  getDiscordUser,
  redirect,
} from "../../lib/discord-auth";

const fail = (reason: string) =>
  redirect(`/geen-toegang?reden=${encodeURIComponent(reason)}`, {
    "Set-Cookie": clearStateCookie(),
  });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");

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

    return redirect("/club", {
      "Set-Cookie": [clearStateCookie(), await createSessionCookie(user, member)],
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404) return fail("geen-lid");

    console.error("Discord callback failed", error);
    return fail("discord-fout");
  }
}
