import assert from "node:assert/strict";
import test from "node:test";
import { loadSocialPlayerStats, mapApiFootballPlayerStats, SocialPlayerStatsProviderError } from "../lib/socials-player-stats-provider";

const providerResponse=[
  {team:{id:194,name:"Ajax"},players:[{player:{id:101,name:"Ajax Speler",photo:"https://media.example/player.png"},statistics:[{games:{minutes:90,rating:"8.1"},goals:{total:1,assists:1},shots:{total:4,on:2},passes:{total:48,key:3,accuracy:"88%"},duels:{total:11,won:7},cards:{yellow:1}}]}]},
  {team:{id:999,name:"Tegenstander"},players:[{player:{id:202,name:"Andere Speler"},statistics:[{games:{minutes:90}}]}]},
];

test("provider mapping houdt alleen Ajax en de acht gekozen cardvelden over",()=>{
  assert.deepEqual(mapApiFootballPlayerStats(providerResponse),[{
    providerPlayerId:101,
    name:"Ajax Speler",
    photo:"https://media.example/player.png",
    stats:{minutes:90,goals:1,assists:1,shots:4,shotsOnTarget:2,chancesCreated:3,passAccuracy:88,duelsWon:7},
  }]);
});

test("player-stats loader gebruikt alleen het fixture players-endpoint en lekt de sleutel niet",async()=>{
  let requestedUrl="",requestedKey="";
  const result=await loadSocialPlayerStats("ajax-psv",{
    apiKey:"secret-key",
    fixtureLoader:async()=>({fixture_key:"ajax-psv",provider_fixture_id:123,home_team:"Ajax",away_team:"PSV",competition:"Eredivisie",kickoff_at:"2026-08-08T18:00:00Z",provider_status:"FT"}),
    fetcher:async(url,init)=>{
      requestedUrl=String(url);
      requestedKey=new Headers(init?.headers).get("x-apisports-key")??"";
      return new Response(JSON.stringify({response:providerResponse,errors:[]}));
    },
  });
  assert.equal(requestedUrl,"https://v3.football.api-sports.io/fixtures/players?fixture=123");
  assert.equal(requestedKey,"secret-key");
  assert.equal(JSON.stringify(result).includes("secret-key"),false);
  assert.equal(result.players.length,1);
});

test("een nog niet gekoppelde fixture wordt read-only op team en datum gevonden",async()=>{
  const urls:string[]=[];
  const result=await loadSocialPlayerStats("ajax-psv",{
    apiKey:"secret-key",
    fixtureLoader:async()=>({fixture_key:"ajax-psv",provider_fixture_id:null,home_team:"Ajax",away_team:"PSV",competition:"Eredivisie",kickoff_at:"2026-08-08T18:00:00Z",provider_status:null}),
    fetcher:async(url)=>{
      urls.push(String(url));
      if(String(url).includes("/fixtures?"))return new Response(JSON.stringify({errors:[],response:[{fixture:{id:123,date:"2026-08-08T18:00:00Z"},teams:{home:{name:"Ajax"},away:{name:"PSV"}}}]}));
      return new Response(JSON.stringify({errors:[],response:providerResponse}));
    },
  });
  assert.deepEqual(urls,[
    "https://v3.football.api-sports.io/fixtures?team=194&season=2026&date=2026-08-08&timezone=Europe%2FAmsterdam",
    "https://v3.football.api-sports.io/fixtures/players?fixture=123",
  ]);
  assert.equal(result.fixture.providerFixtureId,123);
  assert.equal(result.players.length,1);
});
