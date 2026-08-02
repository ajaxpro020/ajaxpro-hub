import assert from "node:assert/strict";
import test from "node:test";
import { internalVotePath, renderPublicNotFound, renderPublicShare, shareMetadata, type PublicMatch } from "../lib/motm-share";
import { renderCurrentPublicShare, type ShareMatch } from "../api/motm/share";
import { statusAt } from "../lib/motm-rules";

const match=(status:PublicMatch["status"]):PublicMatch=>({slug:"fc-volendam-2026-08-02-494eca",opponent:"FC Volendam",competition:"Eredivisie",kickoff_at:"2026-08-02T12:30:00Z",home_or_away:"home",status});
test("openbare pagina bevat volledige dynamische metadata",()=>{const html=renderPublicShare(match("open")),meta=shareMetadata(match("open"));for(const value of [meta.title,meta.description,meta.url,meta.image])assert.ok(html.includes(value));assert.match(html,/og:locale/);assert.match(html,/twitter:card/);assert.match(html,/noindex,follow/)});
test("openbare share- en niet-gevondenpagina laden stylesheetversie 4",()=>{for(const html of [renderPublicShare(match("open")),renderPublicNotFound()]){assert.match(html,/\/motm\.css\?v=4/);assert.doesNotMatch(html,/\/motm\.css\?v=3/)}});
test("openbare pagina lekt geen persoonlijke stemdata",()=>{const html=renderPublicShare(match("open"));for(const value of ["userId","discordRoleIds","voter_discord_user_id","Jouw stem"])assert.ok(!html.includes(value))});
test("concept toont geen inhoudelijke wedstrijdpreview",()=>{const html=renderPublicShare(match("draft"));assert.match(html,/Deze stemming is nog niet beschikbaar/);assert.doesNotMatch(html,/FC Volendam/);assert.doesNotMatch(html,/Inloggen met Discord en stemmen/)});
test("login-CTA gebruikt veilige interne returnTo",()=>{const html=renderPublicShare(match("open"));assert.ok(html.includes(`returnTo=${encodeURIComponent(internalVotePath(match("open").slug))}`))});
test("onbekende route krijgt nette neutrale 404-inhoud",()=>{const html=renderPublicNotFound();assert.match(html,/Stemming niet gevonden/);assert.doesNotMatch(html,/database|Discord user/i)});
test("gesloten stemming gebruikt uitslagmetadata",()=>assert.equal(shareMetadata(match("closed")).title,"Bekijk de AjaxPro Man of the Match"));
const scheduled=(status:PublicMatch["status"],openAt:string,closeAt:string):ShareMatch=>({...match(status),id:"match-1",scheduled_open_at:openAt,scheduled_close_at:closeAt,opened_at:null,closed_at:null});
const at=(now:string)=>async<T extends ShareMatch>(value:T)=>({...value,status:statusAt(value,new Date(now))} as T);
test("/stem toont een verstreken concept als Open en gebruikt open metadata",async()=>{const html=await renderCurrentPublicShare(scheduled("draft","2026-08-01T12:00:00Z","2026-08-03T12:00:00Z"),at("2026-08-02T12:00:00Z"));assert.match(html,/status-open">Open/);assert.match(html,/og:title" content="Stem op de AjaxPro Man of the Match"/)});
test("/stem toont een verstreken open stemming als Gesloten en gebruikt gesloten metadata",async()=>{const html=await renderCurrentPublicShare(scheduled("open","2026-08-01T12:00:00Z","2026-08-02T12:00:00Z"),at("2026-08-03T12:00:00Z"));assert.match(html,/status-closed">Gesloten/);assert.match(html,/og:title" content="Bekijk de AjaxPro Man of the Match"/);assert.match(html,/Bekijk de uitslag van Ajax tegen FC Volendam/)});
