import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import { permissions } from "../lib/permissions.config";
import {
  MANAGEMENT_ROLE_MAX_AGE_MS,
  authorizeSessionPermission,
  clearManagementRoleCache,
} from "../lib/server-permissions";

const managerRole = "manager-role";
process.env.MOTM_MANAGER_ROLE_IDS = managerRole;

const session = (userId: string, roles = [managerRole]): Session => ({
  userId,
  username: "Beheerder",
  avatarUrl: "/avatar.png",
  discordRoleIds: roles,
  issuedAt: 1,
  expiresAt: 99_999_999_999,
});

test.beforeEach(() => clearManagementRoleCache());

test("beheerder met actuele geldige rol krijgt beheerrechten", async () => {
  const authorized = await authorizeSessionPermission(session("valid"), permissions.motmManage, {
    now: 1_000,
    loadMember: async () => ({ roles: [managerRole] }),
  });
  assert.ok(authorized);
});

test("controle jonger dan vijftien minuten gebruikt de centrale cache", async () => {
  let calls = 0;
  const loadMember = async () => { calls += 1; return { roles: [managerRole] }; };
  assert.ok(await authorizeSessionPermission(session("fresh"), permissions.motmManage, { now: 1_000, loadMember }));
  assert.ok(await authorizeSessionPermission(session("fresh"), permissions.motmManage, {
    now: 1_000 + MANAGEMENT_ROLE_MAX_AGE_MS - 1,
    loadMember,
  }));
  assert.equal(calls, 1);
});

test("controle van vijftien minuten oud haalt actuele rollen opnieuw op", async () => {
  let roles = [managerRole];
  let calls = 0;
  const loadMember = async () => { calls += 1; return { roles }; };
  assert.ok(await authorizeSessionPermission(session("stale"), permissions.motmManage, { now: 1_000, loadMember }));
  roles = [];
  assert.equal(await authorizeSessionPermission(session("stale"), permissions.motmManage, {
    now: 1_000 + MANAGEMENT_ROLE_MAX_AGE_MS,
    loadMember,
  }), null);
  assert.equal(calls, 2);
});

test("na login verwijderde beheerrol wordt bij hercontrole geweigerd", async () => {
  assert.equal(await authorizeSessionPermission(session("removed-role"), permissions.motmManage, {
    now: MANAGEMENT_ROLE_MAX_AGE_MS,
    loadMember: async () => ({ roles: [] }),
  }), null);
});

test("uit Discord-server verwijderde gebruiker wordt bij hercontrole geweigerd", async () => {
  assert.equal(await authorizeSessionPermission(session("removed-member"), permissions.motmManage, {
    now: MANAGEMENT_ROLE_MAX_AGE_MS,
    loadMember: async () => null,
  }), null);
});

test("Discord-storing na verlopen controle verleent geen beheerrechten", async () => {
  const user = session("outage");
  assert.ok(await authorizeSessionPermission(user, permissions.motmManage, {
    now: 1_000,
    loadMember: async () => ({ roles: [managerRole] }),
  }));
  await assert.rejects(
    authorizeSessionPermission(user, permissions.motmManage, {
      now: 1_000 + MANAGEMENT_ROLE_MAX_AGE_MS,
      loadMember: async () => { throw new Error("temporary outage"); },
    }),
  );
});

test("gewone portaltoegang behoudt de sessierollen zonder Discord-hercontrole", async () => {
  let called = false;
  const authorized = await authorizeSessionPermission(session("member", []), permissions.portalAccess, {
    now: MANAGEMENT_ROLE_MAX_AGE_MS,
    loadMember: async () => { called = true; return null; },
  });
  assert.ok(authorized);
  assert.equal(called, false);
});

test("direct beheerrequest zonder actuele beheerrol wordt centraal geweigerd", async () => {
  assert.equal(await authorizeSessionPermission(session("direct"), permissions.motmManage, {
    now: MANAGEMENT_ROLE_MAX_AGE_MS,
    loadMember: async () => ({ roles: [] }),
  }), null);
});
