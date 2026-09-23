import {
  clearSessionCookie,
  isSameOrigin,
  noStoreHeaders,
  readSession,
  redirect,
} from "../../lib/discord-auth";
import { clearPermissionCacheForUser } from "../../lib/server-permissions";

export async function POST(request: Request) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { ...noStoreHeaders, Allow: "POST" },
    });
  }

  if (!isSameOrigin(request)) {
    return new Response("Ongeldige uitlogaanvraag.", {
      status: 403,
      headers: noStoreHeaders,
    });
  }

  const session = await readSession(request);
  if (session) clearPermissionCacheForUser(session.userId);
  return redirect("/", { "Set-Cookie": clearSessionCookie() });
}
