import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../programma.html", import.meta.url), "utf8");
const script = readFileSync(new URL("../programma.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../programma.css", import.meta.url), "utf8");

test("programma geeft de eerstvolgende drie wedstrijden aflopende visuele prioriteit", () => {
  assert.match(html, /<h1 id="program-title">Programma<\/h1>/);
  assert.match(html, /programma\.css\?v=20260830-priority3/);
  assert.match(script, /featuredFixture\(fixtures\[0\]\)/);
  assert.match(script, /fixtures\.slice\(1, 3\)/);
  assert.match(script, /fixtures\.slice\(3\)/);
  assert.match(styles, /\.program-previews\s*{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /rgba\(179, 15, 36, 0\.1\)/);
  assert.doesNotMatch(script, /list\.innerHTML/);
});

test("clublogo's voor het actuele programma worden lokaal geladen", () => {
  for (const logo of ["ajax", "telstar", "psv", "fortuna-sittard", "willem-ii", "excelsior", "nec"]) {
    assert.equal(existsSync(new URL(`../assets/clubs/${logo}.png`, import.meta.url)), true, `${logo}.png ontbreekt`);
  }
});
