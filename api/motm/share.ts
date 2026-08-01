import { noStoreHeaders, readSession, redirect } from "../../lib/discord-auth";
import { db } from "../../lib/motm-db";
import { internalVotePath, renderPublicNotFound, renderPublicShare, type PublicMatch } from "../../lib/motm-share";
import { synchronizeMatch } from "../../lib/motm-scheduling";
import type { SchedulableMatch } from "../../lib/motm-rules";

const headers={...noStoreHeaders,"Content-Type":"text/html; charset=UTF-8","Content-Security-Policy":"default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
export type ShareMatch=PublicMatch&SchedulableMatch&{id:string;opened_at:string|Date|null;closed_at:string|Date|null};
export const renderCurrentPublicShare=async(match:ShareMatch,synchronize:typeof synchronizeMatch=synchronizeMatch)=>renderPublicShare(await synchronize(match));
export async function GET(request:Request){const slug=new URL(request.url).searchParams.get("slug")?.trim()??"";const session=await readSession(request);if(session)return redirect(internalVotePath(slug));try{const [match]=await db()`SELECT id,slug,opponent,competition,kickoff_at,home_or_away,status,scheduled_open_at,scheduled_close_at,opened_at,closed_at FROM motm_matches WHERE slug=${slug}`;if(!match)return new Response(renderPublicNotFound(),{status:404,headers});return new Response(await renderCurrentPublicShare(match as ShareMatch),{status:200,headers})}catch(error){console.error("Public MOTM share failed",error);return new Response(renderPublicNotFound(),{status:503,headers})}}
