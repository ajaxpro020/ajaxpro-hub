import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import { readFileSync } from "node:fs";
import { permissions } from "../lib/permissions.config";
import {
  clearManagementPermissionCache,
  MANAGEMENT_PERMISSION_CACHE_SECONDS,
  MANAGEMENT_SESSION_MAX_AGE_SECONDS,
  authorizeSessionPermission,
} from "../lib/server-permissions";

const managerRole = "manager-role";
process.env.MOTM_MANAGER_ROLE_IDS = managerRole;

const session = (roles = [managerRole], issuedAt = 1_000, userId = "user"): Session => ({
  userId,
  username: "Beheerder",
  avatarUrl: "/avatar.png",
  discordRoleIds: roles,
  issuedAt,
  expiresAt: issuedAt + 8 * 60 * 60,
});

clearManagementPermissionCache();

test("Discord-rolrefresh gebruikt het Bot-schema en lekt de token niet", () => {
  const source = readFileSync(new URL("../lib/discord-auth.ts", import.meta.url), "utf8");
  assert.match(source, /Authorization: `Bot \$\{botToken\}`/);
  assert.match(source, /requiredEnv\("DISCORD_BOT_TOKEN"\)/);
  assert.doesNotMatch(source, /Authorization: `Bearer \$\{botToken\}`/);
});

test("beheerder met geldige loginrol krijgt binnen één uur beheerrechten", async () => {
  assert.ok(await authorizeSessionPermission(session([managerRole], 1_000, "valid"), permissions.motmManage, { nowSeconds: 1_001 }));
});

test("beheerrechten blijven geldig tot vlak voor de grens van één uur", async () => {
  assert.ok(await authorizeSessionPermission(session([managerRole], 1_000, "boundary"), permissions.motmManage, {
    nowSeconds: 1_000 + MANAGEMENT_SESSION_MAX_AGE_SECONDS - 1,
    fetchRoles: async () => [managerRole],
  }));
});

test("beheerrechten vervallen exact één uur na Discord-login", async () => {
  assert.equal(await authorizeSessionPermission(session([managerRole], 1_000, "expired"), permissions.motmManage, {
    nowSeconds: 1_000 + MANAGEMENT_SESSION_MAX_AGE_SECONDS,
  }), null);
});

test("een oude sessierol kan na één uur geen beheerpagina of mutatie autoriseren", async () => {
  for (const permission of [permissions.motmManage, permissions.motmDelete, permissions.adminManage]) {
    assert.equal(await authorizeSessionPermission(session([managerRole], 1_000, "old"), permission, {
      nowSeconds: 1_000 + MANAGEMENT_SESSION_MAX_AGE_SECONDS,
    }), null);
  }
});

test("gebruiker zonder beheerrol krijgt ook binnen één uur geen beheerrechten", async () => {
  assert.equal(await authorizeSessionPermission(session([], 1_000, "no-role"), permissions.motmManage, { nowSeconds: 1_001 }), null);
});

test("bestaande environment-permissionmapping blijft leidend", async () => {
  assert.ok(await authorizeSessionPermission(session([managerRole], 1_000, "mapping-manager"), permissions.motmManage, { nowSeconds: 1_001 }));
  assert.equal(await authorizeSessionPermission(session(["unknown"], 1_000, "mapping-unknown"), permissions.motmManage, { nowSeconds: 1_001 }), null);
});

test("beheerrechten verversen Discord-rollen na maximaal vijftien minuten", async () => {
  let calls = 0;
  const fetchRoles = async () => { calls += 1; return [managerRole]; };
  assert.ok(await authorizeSessionPermission(session([managerRole], 10_000), permissions.motmManage, { nowSeconds: 10_001, fetchRoles }));
  assert.equal(calls, 0, "de recente login-snapshot mag als korte cache dienen");
  assert.ok(await authorizeSessionPermission(session([managerRole], 10_000), permissions.motmManage, { nowSeconds: 10_000 + MANAGEMENT_PERMISSION_CACHE_SECONDS, fetchRoles }));
  assert.equal(calls, 1);
});

test("verloren Discord-rol wordt na cacheverval geweigerd", async () => {
  const fetchRoles = async () => [];
  assert.ok(await authorizeSessionPermission(session([managerRole], 20_000), permissions.motmManage, { nowSeconds: 20_001, fetchRoles }));
  assert.equal(await authorizeSessionPermission(session([managerRole], 20_000), permissions.motmManage, { nowSeconds: 20_000 + MANAGEMENT_PERMISSION_CACHE_SECONDS, fetchRoles }), null);
  assert.equal(await authorizeSessionPermission(session([managerRole], 20_000), permissions.motmDelete, { nowSeconds: 20_000 + MANAGEMENT_PERMISSION_CACHE_SECONDS, fetchRoles }), null);
});

test("verlopen cache plus Discord-storing weigert beheerrechten fail-closed", async () => {
  const fetchRoles = async () => { throw new Error("Discord unavailable"); };
  assert.ok(await authorizeSessionPermission(session([managerRole], 30_000), permissions.motmManage, { nowSeconds: 30_001, fetchRoles }));
  assert.equal(await authorizeSessionPermission(session([managerRole], 30_000), permissions.motmManage, { nowSeconds: 30_000 + MANAGEMENT_PERMISSION_CACHE_SECONDS, fetchRoles }), null);
});

test("portal.access gebruikt geen Discord permission refresh", async () => {
  let called = false;
  const fetchRoles = async () => { called = true; return []; };
  assert.ok(await authorizeSessionPermission(session([], 40_000), permissions.portalAccess, { nowSeconds: 40_001, fetchRoles }));
  assert.equal(called, false);
});

test("gewone portaltoegang behoudt de acht uur geldige sessie", async () => {
  assert.ok(await authorizeSessionPermission(session([], 1_000), permissions.portalAccess, {
    nowSeconds: 1_000 + 7 * 60 * 60,
  }));
});

test("ongeldige issuedAt kan nooit beheerrechten verlenen", async () => {
  assert.equal(await authorizeSessionPermission({ ...session([managerRole], 1_000, "nan"), issuedAt: Number.NaN }, permissions.motmManage, {
    nowSeconds: 1_001,
  }), null);
  assert.equal(await authorizeSessionPermission({ ...session([managerRole], 1_000, "future"), issuedAt: 2_000 }, permissions.motmManage, {
    nowSeconds: 1_001,
  }), null);
});
