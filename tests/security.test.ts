import assert from "node:assert/strict";
import test from "node:test";
import { safeClubReturnTo } from "../lib/discord-auth";
import { permissions, rolesHavePermission } from "../lib/permissions.config";

test("OAuth returnTo accepteert alleen interne Club-paden", () => {
  assert.equal(safeClubReturnTo("/club/stemmen/ajax-psv"), "/club/stemmen/ajax-psv");
  for (const unsafe of ["https://evil.test/club/", "//evil.test/club", "/api/club", "/club\\evil.test", null]) {
    assert.equal(safeClubReturnTo(unsafe), "/club");
  }
});

test("motm.manage komt alleen uit de geconfigureerde rol-ID's", () => {
  process.env.MOTM_MANAGER_ROLE_IDS = "111, 222";
  assert.equal(rolesHavePermission(["222"], permissions.motmManage), true);
  assert.equal(rolesHavePermission(["Admin", "unknown", "22"], permissions.motmManage), false);
});

test("onbekende rollen krijgen geen andere aanvullende rechten", () => {
  assert.equal(rolesHavePermission(["unknown"], permissions.adminManage), false);
});
