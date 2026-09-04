import assert from "node:assert/strict";
import test from "node:test";
import * as publicHandler from "../api/motm-public";
import * as manageHandler from "../api/motm-manage";

test("publieke MOTM-router weigert ontbrekende en onbekende acties netjes",async()=>{
  for(const url of ["https://ajaxpro.fans/api/motm-public","https://ajaxpro.fans/api/motm-public?action=unknown"]){
    const response=await publicHandler.GET(new Request(url));
    assert.equal(response.status,404);
    assert.equal(response.headers.get("cache-control"),"no-store");
  }
});

test("publieke MOTM-router staat POST uitsluitend voor stemmen toe",async()=>{
  for(const action of ["index","stand","share"]){
    const response=await publicHandler.POST(new Request(`https://ajaxpro.fans/api/motm-public?action=${action}`,{method:"POST"}));
    assert.equal(response.status,405);
    assert.equal(response.headers.get("allow"),"GET");
  }
  assert.equal("PUT" in publicHandler,false);
});

test("beheer blijft een afzonderlijke handler met GET en POST",()=>{
  assert.equal(typeof manageHandler.GET,"function");
  assert.equal(typeof manageHandler.POST,"function");
  assert.equal("GET" in publicHandler,true);
  assert.equal("POST" in publicHandler,true);
});
