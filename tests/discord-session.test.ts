import assert from "node:assert/strict";
import test from "node:test";
import {
  SESSION_MAX_AGE_SECONDS,
  clearSessionCookie,
  createSessionCookie,
  readSession,
} from "../lib/discord-auth";

process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters-long";
process.env.DISCORD_REDIRECT_URI = "https://ajaxpro.example/api/auth/discord-callback";

const user = { id: "123456789", username: "ajaxpro", global_name: "AjaxPro Lid", avatar: null };
const member = { roles: ["member-role"] };
const cookieValue = (setCookie: string) => setCookie.split(";", 1)[0];

test("Discord-login maakt een persistente sessiecookie voor dertig dagen", async () => {
  const before = Math.floor(Date.now() / 1000);
  const setCookie = await createSessionCookie(user, member);
  const request = new Request("https://ajaxpro.example/club", { headers: { cookie: cookieValue(setCookie) } });
  const session = await readSession(request);
  assert.ok(session);
  assert.equal(SESSION_MAX_AGE_SECONDS, 30 * 24 * 60 * 60);
  assert.match(setCookie, /Max-Age=2592000/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /Secure/);
  assert.ok(session.issuedAt >= before);
  assert.equal(session.expiresAt - session.issuedAt, SESSION_MAX_AGE_SECONDS);
  assert.equal(session.userId, user.id);
});

test("dezelfde sessiecookie werkt bij een nieuwe request zonder OAuth", async () => {
  const setCookie = await createSessionCookie(user, member);
  const reopenedRequest = new Request("https://ajaxpro.example/club", { headers: { cookie: cookieValue(setCookie) } });
  assert.ok(await readSession(reopenedRequest));
});

test("een volledig verlopen dertigdaagse sessie wordt geweigerd", async () => {
  const originalNow = Date.now;
  const loginTime = 2_000_000_000_000;
  try {
    Date.now = () => loginTime;
    const setCookie = await createSessionCookie(user, member);
    Date.now = () => loginTime + SESSION_MAX_AGE_SECONDS * 1000;
    const expiredRequest = new Request("https://ajaxpro.example/club", { headers: { cookie: cookieValue(setCookie) } });
    assert.equal(await readSession(expiredRequest), null);
  } finally {
    Date.now = originalNow;
  }
});

test("een gemanipuleerde sessiecookie wordt geweigerd", async () => {
  const setCookie = await createSessionCookie(user, member);
  const original = cookieValue(setCookie);
  const tampered = `${original.slice(0, -1)}${original.endsWith("a") ? "b" : "a"}`;
  assert.equal(await readSession(new Request("https://ajaxpro.example/club", { headers: { cookie: tampered } })), null);
});

test("logout-cookie verwijdert de volledige browsersessie", () => {
  const setCookie = clearSessionCookie();
  assert.match(setCookie, /^ajaxpro_session=;/);
  assert.match(setCookie, /Max-Age=0/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /Secure/);
});
