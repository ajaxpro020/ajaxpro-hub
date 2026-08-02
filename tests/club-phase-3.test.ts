import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("Club-home is een rustige communitypagina zonder tool- of rolsecties",()=>{const source=read("../api/club.ts");assert.match(source,/Stem op de Man of the Match en bekijk de uitslagen\./);for(const text of ["renderToolSections","Tactiekbord","Screenshot Editor","MOTM-stemmingen beheren","Voor analisten","Voor staf"])assert.doesNotMatch(source,new RegExp(text))});
test("beheer slaat seizoen en meetellen op en neemt beide op in audit snapshots",()=>{const source=read("../api/motm/manage.ts");for(const value of ["season_key","counts_for_season","season_exclusion_reason","Telt mee voor Ajacied van het Jaar","matchSnapshot"])assert.ok(source.includes(value));assert.match(source,/audit\(tx,id,session,"match_updated",before,matchSnapshot\(updated\)\)/)});
test("openbare sharecode kent de interne uitsluitreden niet",()=>{assert.doesNotMatch(read("../lib/motm-share.ts"),/season_exclusion_reason|Reden voor uitsluiting/)});
