import assert from "node:assert/strict";
import test from "node:test";
import { internalVotePath, renderPublicNotFound, renderPublicShare, shareMetadata, type PublicMatch } from "../lib/motm-share";

const match=(status:PublicMatch["status"]):PublicMatch=>({slug:"fc-volendam-2026-08-02-494eca",opponent:"FC Volendam",competition:"Eredivisie",kickoff_at:"2026-08-02T12:30:00Z",home_or_away:"home",status});
test("openbare pagina bevat volledige dynamische metadata",()=>{const html=renderPublicShare(match("open")),meta=shareMetadata(match("open"));for(const value of [meta.title,meta.description,meta.url,meta.image])assert.ok(html.includes(value));assert.match(html,/og:locale/);assert.match(html,/twitter:card/);assert.match(html,/noindex,follow/)});
test("openbare pagina lekt geen persoonlijke stemdata",()=>{const html=renderPublicShare(match("open"));for(const value of ["userId","discordRoleIds","voter_discord_user_id","Jouw stem"])assert.ok(!html.includes(value))});
test("concept toont geen inhoudelijke wedstrijdpreview",()=>{const html=renderPublicShare(match("draft"));assert.match(html,/Deze stemming is nog niet beschikbaar/);assert.doesNotMatch(html,/FC Volendam/);assert.doesNotMatch(html,/Inloggen met Discord en stemmen/)});
test("login-CTA gebruikt veilige interne returnTo",()=>{const html=renderPublicShare(match("open"));assert.ok(html.includes(`returnTo=${encodeURIComponent(internalVotePath(match("open").slug))}`))});
test("onbekende route krijgt nette neutrale 404-inhoud",()=>{const html=renderPublicNotFound();assert.match(html,/Stemming niet gevonden/);assert.doesNotMatch(html,/database|Discord user/i)});
test("gesloten stemming gebruikt uitslagmetadata",()=>assert.equal(shareMetadata(match("closed")).title,"Bekijk de AjaxPro Man of the Match"));
