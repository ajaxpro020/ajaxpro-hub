import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");

test("MOTM-homekaart heeft stabiele copy- en media-kolommen zonder geforceerde woordbreuk",()=>{
  const club=read("../api/club.ts"),css=read("../motm.css");
  assert.match(club,/result-copy/);assert.match(club,/result-spotlight--with-media/);
  const polish=css.slice(css.indexOf("Phase 2.1 responsive polish"));
  assert.match(polish,/overflow-wrap:normal;word-break:normal/);
  assert.doesNotMatch(polish,/overflow-wrap:anywhere|word-break:break-all/);
});

test("beheer gebruikt afzonderlijke datum- en tijdvelden en geen datetime-local",()=>{
  const manage=read("../api/motm/manage.ts");
  for(const prefix of ["kickoff","scheduledOpen","scheduledClose"])assert.ok(manage.includes(`dateTimeFields(\"${prefix}\"`));
  assert.match(manage,/\$\{prefix\}Date/);assert.match(manage,/\$\{prefix\}Time/);
  assert.doesNotMatch(manage,/datetime-local/);
});

test("alle relevante HTML-renderers gebruiken stylesheetversie 6",()=>{
  for(const file of ["../lib/motm-view.ts","../lib/motm-share.ts"]){const source=read(file);assert.match(source,/motm\.css\?v=6/);assert.doesNotMatch(source,/motm\.css\?v=5/);}
});
