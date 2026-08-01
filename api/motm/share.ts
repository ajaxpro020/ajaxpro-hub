import { noStoreHeaders, readSession, redirect } from "../../lib/discord-auth";
import { db } from "../../lib/motm-db";
import { internalVotePath, renderPublicNotFound, renderPublicShare, type PublicMatch } from "../../lib/motm-share";

const headers={...noStoreHeaders,"Content-Type":"text/html; charset=UTF-8","Content-Security-Policy":"default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
export async function GET(request:Request){const slug=new URL(request.url).searchParams.get("slug")?.trim()??"";const session=await readSession(request);if(session)return redirect(internalVotePath(slug));try{const [match]=await db()`SELECT slug,opponent,competition,kickoff_at,home_or_away,status FROM motm_matches WHERE slug=${slug}`;if(!match)return new Response(renderPublicNotFound(),{status:404,headers});return new Response(renderPublicShare(match as PublicMatch),{status:200,headers})}catch(error){console.error("Public MOTM share failed",error);return new Response(renderPublicNotFound(),{status:503,headers})}}
