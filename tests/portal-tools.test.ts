import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import { renderToolSections, toolsForSession } from "../lib/portal-tools.config";

const roles={owner:"1268471493046566987",admin:"1268471493046566986",moderator:"1268471493034246376",helper:"1271472085788786718",analyst:"1422264769863221319"};
process.env.PORTAL_TEAM_TOOL_ROLE_IDS=Object.values(roles).join(",");
process.env.MOTM_MANAGER_ROLE_IDS=[roles.owner,roles.admin,roles.moderator,roles.helper].join(",");
const session=(discordRoleIds:string[]):Session=>({userId:"1",username:"Test",avatarUrl:"/avatar.png",discordRoleIds,issuedAt:1,expiresAt:2});
const ids=(roleIds:string[])=>toolsForSession(session(roleIds)).map(tool=>tool.id);

test("gewoon lid ziet alleen algemene tools",()=>assert.deepEqual(ids([]),["lineup","contracts"]));
test("analist ziet algemene tools en teamtools maar geen beheer",()=>assert.deepEqual(ids([roles.analyst]),["lineup","contracts","tactics","screenshot"]));
for(const role of ["helper","moderator","admin","owner"] as const)test(`${role} ziet alle secties`,()=>assert.deepEqual(new Set(ids([roles[role]])),new Set(["lineup","contracts","tactics","screenshot","motm-admin"])));
test("meerdere rollen leveren gecombineerde rechten op",()=>assert.deepEqual(new Set(ids([roles.analyst,roles.helper])),new Set(["lineup","contracts","tactics","screenshot","motm-admin"])));
test("lege secties worden inclusief kop niet gerenderd",()=>{const html=renderToolSections(toolsForSession(session([])));assert.match(html,/>Tools</);assert.doesNotMatch(html,/>Teamtools</);assert.doesNotMatch(html,/>Beheer</)});
