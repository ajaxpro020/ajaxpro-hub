import { GET as overviewGET } from "../api-impl/motm/index";
import { GET as voteGET, POST as votePOST } from "../api-impl/motm/vote";
import { GET as standGET } from "../api-impl/motm/stand";
import { GET as shareGET } from "../api-impl/motm/share";
import { loadPlayers } from "../lib/player-registry";

export type PublicMotmAction = "index" | "vote" | "stand" | "share" | "players";

const actionFor = (request:Request):PublicMotmAction|null => {
  const action=new URL(request.url).searchParams.get("action");
  return action==="index"||action==="vote"||action==="stand"||action==="share"||action==="players"?action:null;
};

const notFound=()=>new Response("MOTM-actie niet gevonden.",{status:404,headers:{"Content-Type":"text/plain; charset=UTF-8","Cache-Control":"no-store"}});
const methodNotAllowed=(allow:string)=>new Response("Methode niet toegestaan.",{status:405,headers:{Allow:allow,"Content-Type":"text/plain; charset=UTF-8","Cache-Control":"no-store"}});
const allowedRosterOrigin=(request:Request)=>{const origin=request.headers.get("origin");return origin==="https://opstelling.ajaxpro.fans"?origin:""};
const playersGET=async(request:Request)=>{const includeInactive=new URL(request.url).searchParams.get("include")==="contracts",players=await loadPlayers({includeInactive});const origin=allowedRosterOrigin(request);return new Response(JSON.stringify({players,updatedAt:players.reduce((latest,player)=>player.updatedAt>latest?player.updatedAt:latest,"")}),{headers:{"Content-Type":"application/json; charset=UTF-8","Cache-Control":"public, max-age=60, stale-while-revalidate=300","X-Content-Type-Options":"nosniff",...(origin?{"Access-Control-Allow-Origin":origin,"Vary":"Origin"}:{})}})};

export async function GET(request:Request){
  const action=actionFor(request);
  if(action==="index")return overviewGET(request);
  if(action==="vote")return voteGET(request);
  if(action==="stand")return standGET(request);
  if(action==="share")return shareGET(request);
  if(action==="players")return playersGET(request);
  return notFound();
}

export async function POST(request:Request){
  const action=actionFor(request);
  if(action==="vote")return votePOST(request);
  if(action==="index"||action==="stand"||action==="share"||action==="players")return methodNotAllowed("GET");
  return notFound();
}
