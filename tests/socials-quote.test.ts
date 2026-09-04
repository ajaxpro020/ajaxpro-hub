import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Session } from "../lib/discord-auth";
import { renderSocials } from "../api-impl/socials/index";
import { socialFormats, socialOutputFormats } from "../lib/socials";
import { isValidQuotePhoto, quoteFields, QUOTE_MAX_LENGTH, QUOTE_NAME_MAX_LENGTH, QUOTE_PHOTO_MAX_BYTES, QUOTE_ROLE_MAX_LENGTH } from "../lib/socials-quote";

const session:Session={userId:"staff",username:"Redactie",avatarUrl:"/avatar.png",discordRoleIds:["staff"],issuedAt:1,expiresAt:2};
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Quote staat als beschikbaar format met optionele wedstrijdcontext geregistreerd",()=>{
  const quote=socialFormats.find(format=>format.id==="quote");
  assert.deepEqual(quote&&{matchContext:quote.matchContext,availability:quote.availability},{matchContext:"optional",availability:"available"});
});

test("Quote heeft exact de vaste velden en begrensde tekstlengtes",()=>{
  assert.deepEqual(quoteFields.map(field=>field.id),["quote","name","role","photo"]);
  assert.equal(QUOTE_MAX_LENGTH,280);
  assert.equal(QUOTE_NAME_MAX_LENGTH,60);
  assert.equal(QUOTE_ROLE_MAX_LENGTH,80);
  assert.ok(QUOTE_MAX_LENGTH>QUOTE_NAME_MAX_LENGTH);
});

test("Quote valideert lokale foto's op type en maximale bestandsgrootte",()=>{
  for(const type of ["image/jpeg","image/png","image/webp"])assert.equal(isValidQuotePhoto({type,size:1024}),true);
  assert.equal(isValidQuotePhoto({type:"image/gif",size:1024}),false);
  assert.equal(isValidQuotePhoto({type:"image/jpeg",size:QUOTE_PHOTO_MAX_BYTES+1}),false);
  assert.equal(isValidQuotePhoto({type:"image/png",size:0}),false);
});

test("Quote is zonder wedstrijdcontext actief en bruikbaar",async()=>{
  const response=await renderSocials(session,async()=>[]),html=await response.text();
  assert.match(html,/data-format-id="quote"[^>]*aria-pressed="true"/);
  assert.match(html,/data-format-workspace="quote" data-quote-workspace>/);
  assert.match(html,new RegExp(`data-quote-field="quote" maxlength="${QUOTE_MAX_LENGTH}"`));
  assert.match(html,/data-quote-count>0</);
  assert.match(html,/accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(response.headers.get("content-security-policy")??"",/img-src 'self' https:\/\/cdn\.discordapp\.com blob:/);
  assert.doesNotMatch(html,/data-match-select/);
});

test("Quote gebruikt dezelfde twee outputformaten als Stats",()=>{
  assert.deepEqual(socialOutputFormats.map(({id,width,height})=>({id,width,height})),[
    {id:"portrait-4x5",width:1080,height:1350},
    {id:"vertical-9x16",width:1080,height:1920},
  ]);
});

test("Quote-foto blijft lokaal en object-URL's worden opgeruimd",()=>{
  const source=read("../socials/formats/quote.mjs");
  assert.match(source,/URL\.createObjectURL/);
  assert.match(source,/URL\.revokeObjectURL/);
  assert.match(source,/beforeunload/);
  assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|FormData|localStorage|sessionStorage/);
});

test("Stats- en Quote-state leven in afzonderlijke formatmodules",()=>{
  const main=read("../socials/main.mjs"),stats=read("../socials/formats/stats.mjs"),quote=read("../socials/formats/quote.mjs");
  assert.match(main,/stats:initStats\(root,sharedState\),quote:initQuote\(root,sharedState\)/);
  assert.doesNotMatch(stats,/data-quote-field|photoFile/);
  assert.doesNotMatch(quote,/data-stat-id|data-match-select/);
});
