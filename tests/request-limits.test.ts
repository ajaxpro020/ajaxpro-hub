import assert from "node:assert/strict";
import test from "node:test";
import {
  MOTM_MANAGE_MAX_BODY_BYTES,
  MOTM_MANAGE_MAX_FORM_FIELDS,
  MOTM_VOTE_MAX_BODY_BYTES,
  MOTM_VOTE_MAX_FORM_FIELDS,
  readFormDataWithLimits,
} from "../lib/request-limits";

const requestWithBody = (body: string, contentLength?: string) => new Request("https://ajaxpro.fans/club/stemmen/test", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    ...(contentLength === undefined ? {} : { "Content-Length": contentLength }),
  },
  body,
});

test("normale en exact passende bodies worden geparsed", async () => {
  const body = "playerId=player-1";
  const result = await readFormDataWithLimits(requestWithBody(body), { maxBytes: body.length, maxFields: MOTM_VOTE_MAX_FORM_FIELDS });
  assert.ok(result instanceof FormData);
  assert.equal(result.get("playerId"), "player-1");
});

test("body boven de limiet geeft 413", async () => {
  const result = await readFormDataWithLimits(requestWithBody("playerId=" + "x".repeat(MOTM_VOTE_MAX_BODY_BYTES)), { maxBytes: MOTM_VOTE_MAX_BODY_BYTES, maxFields: MOTM_VOTE_MAX_FORM_FIELDS });
  assert.ok(result instanceof Response);
  assert.equal(result.status, 413);
});

test("een onjuiste of ontbrekende Content-Length omzeilt de streamlimiet niet", async () => {
  for (const contentLength of [undefined, "1", "onbekend"]) {
    const result = await readFormDataWithLimits(requestWithBody("playerId=" + "x".repeat(MOTM_VOTE_MAX_BODY_BYTES), contentLength), { maxBytes: MOTM_VOTE_MAX_BODY_BYTES, maxFields: MOTM_VOTE_MAX_FORM_FIELDS });
    assert.ok(result instanceof Response);
    assert.equal(result.status, 413);
  }
});

test("te veel form fields geeft 413", async () => {
  const body = Array.from({ length: MOTM_VOTE_MAX_FORM_FIELDS + 1 }, (_, index) => `field${index}=x`).join("&");
  const result = await readFormDataWithLimits(requestWithBody(body), { maxBytes: MOTM_MANAGE_MAX_BODY_BYTES, maxFields: MOTM_MANAGE_MAX_FORM_FIELDS });
  assert.ok(result instanceof FormData);

  const tooMany = Array.from({ length: MOTM_MANAGE_MAX_FORM_FIELDS + 1 }, (_, index) => `field${index}=x`).join("&");
  const limited = await readFormDataWithLimits(requestWithBody(tooMany), { maxBytes: MOTM_MANAGE_MAX_BODY_BYTES, maxFields: MOTM_MANAGE_MAX_FORM_FIELDS });
  assert.ok(limited instanceof Response);
  assert.equal(limited.status, 413);
});

test("beheerlimieten zijn groter dan stemlimieten maar blijven begrensd", () => {
  assert.ok(MOTM_MANAGE_MAX_BODY_BYTES > MOTM_VOTE_MAX_BODY_BYTES);
  assert.ok(MOTM_MANAGE_MAX_FORM_FIELDS > MOTM_VOTE_MAX_FORM_FIELDS);
});
