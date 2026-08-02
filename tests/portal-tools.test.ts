import assert from "node:assert/strict";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import { adminToolsForSession, clubIntroForSession, renderToolSections, teamToolsForSession, toolsForSession } from "../lib/portal-tools.config";

const roles={owner:"1268471493046566987",admin:"1268471493046566986",moderator:"1268471493034246376",helper:"1271472085788786718",analyst:"1422264769863221319"};
process.env.PORTAL_TEAM_TOOL_ROLE_IDS=Object.values(roles).join(",");
process.env.MOTM_MANAGER_ROLE_IDS=[roles.owner,roles.admin,roles.moderator,roles.helper].join(",");
const session=(discordRoleIds:string[]):Session=>({userId:"1",username:"Test",avatarUrl:"/avatar.png",discordRoleIds,issuedAt:1,expiresAt:2});
const ids=(roleIds:string[])=>toolsForSession(session(roleIds)).map(tool=>tool.id);

test("gewoon lid ziet geen tools of beheer",()=>assert.deepEqual(ids([]),[]));
test("analist ziet beide teamtools maar geen beheer",()=>assert.deepEqual(ids([roles.analyst]),["tactics","screenshot"]));
for(const role of ["helper","moderator","admin","owner"] as const)test(`${role} ziet Teamtools en MOTM-beheer`,()=>assert.deepEqual(new Set(ids([roles[role]])),new Set(["tactics","screenshot","motm-admin"])));
test("meerdere rollen leveren gecombineerde rechten op",()=>assert.deepEqual(new Set(ids([roles.analyst,roles.helper])),new Set(["tactics","screenshot","motm-admin"])));
test("lege Teamtools- en Beheer-secties worden volledig verborgen",()=>assert.equal(renderToolSections(toolsForSession(session([]))),""));
test("publieke tools komen niet voor in Club-config of HTML",()=>{const html=renderToolSections(toolsForSession(session([roles.owner])));for(const title of ["Opstellingmaker","Contractenoverzicht","Bingo"])assert.doesNotMatch(html,new RegExp(title))});
test("sectiehelpers houden Teamtools en Beheer contextueel gescheiden",()=>{const owner=session([roles.owner]);assert.deepEqual(teamToolsForSession(owner).map(tool=>tool.id),["tactics","screenshot"]);assert.deepEqual(adminToolsForSession(owner).map(tool=>tool.id),["motm-admin"])});
test("gewone leden krijgen geen Teamtools-tekst in de Club-intro",()=>assert.equal(clubIntroForSession(session([])),"Stem op de Man of the Match en bekijk de laatste uitslagen."));
test("Teamtool-gebruikers krijgen de Teamtools-tekst in de Club-intro",()=>assert.equal(clubIntroForSession(session([roles.analyst])),"Stem op de Man of the Match en open je teamtools vanuit één vertrouwde plek."));
