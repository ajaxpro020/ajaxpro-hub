import {
  clearSessionCookie,
  isSameOrigin,
  noStoreHeaders,
  redirect,
} from "../../lib/discord-auth";

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

  return redirect("/", { "Set-Cookie": clearSessionCookie() });
}
