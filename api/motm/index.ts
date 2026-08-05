import { redirect } from "../../lib/discord-auth";
import { permissions } from "../../lib/permissions.config";
import { getSessionWithPermission, sessionHasPermission } from "../../lib/server-permissions";
import { db } from "../../lib/motm-db";
import { esc, formatKickoff, formatMoment, page, pageHeader } from "../../lib/motm-view";
import { synchronizeAllMatches } from "../../lib/motm-scheduling";
import { statusLabel } from "../../lib/motm-rules";

const matchRow=(match:any)=>`<a class="match-row${match.own_vote?" match-row--with-vote":""}" href="/club/stemmen/${esc(match.slug)}"><span class="status status-${match.status==="draft"?"planned":esc(match.status)}">${match.status==="draft"?"Gepland":esc(statusLabel(match.status))}</span><span class="match-row__copy"><strong>Ajax — ${esc(match.opponent)}</strong><small>${esc(formatKickoff(match.kickoff_at))}</small>${match.own_vote?`<span class="match-row__vote"><img src="${esc(match.own_vote_image)}" alt=""><span><small>Jouw stem</small><strong>${esc(match.own_vote)}</strong></span></span>`:""}</span><b>Bekijk →</b></a>`;

export async function GET(request:Request){
  const session=await getSessionWithPermission(request,permissions.portalAccess);
  if(!session)return redirect("/api/auth/discord-login?returnTo=/club/motm");
  try{
    await synchronizeAllMatches();
    const matches=await db()`SELECT m.*,(SELECT p.name_snapshot FROM motm_votes v JOIN motm_match_players p ON p.match_id=v.match_id AND p.player_id=v.player_id WHERE v.match_id=m.id AND v.voter_discord_user_id=${session.userId}) own_vote,(SELECT p.image_url_snapshot FROM motm_votes v JOIN motm_match_players p ON p.match_id=v.match_id AND p.player_id=v.player_id WHERE v.match_id=m.id AND v.voter_discord_user_id=${session.userId}) own_vote_image FROM motm_matches m WHERE m.deleted_at IS NULL AND (m.status <> 'draft' OR m.scheduled_open_at IS NOT NULL) ORDER BY COALESCE(m.opened_at,m.scheduled_open_at,m.created_at) DESC LIMIT 20`;
    const open=matches.filter((m:any)=>m.status==="open"),planned=matches.filter((m:any)=>m.status==="draft"),closed=matches.filter((m:any)=>m.status==="closed");
    const section=(title:string,items:any[],note="")=>items.length?`<section class="match-section"><div class="section-heading"><div><p class="eyebrow">${note}</p><h2>${title}</h2></div></div><div class="match-list">${items.map((m:any)=>matchRow(m)).join("")}</div></section>`:"";
    const action=sessionHasPermission(session,permissions.motmManage)?`<a class="button secondary" href="/club/motm/beheer">Beheer stemmingen</a>`:"",empty=!matches.length?`<section class="empty"><h2>Nog geen stemmingen</h2><p>Nieuwe en afgeronde stemmingen verschijnen hier.</p></section>`:"";
    return page("Stemmen",`<main class="motm-main">${pageHeader("Stemmen","Man of the Match",undefined,undefined,action)}${section("Actieve stemming",open,"Nu stemmen")}${section("Geplande stemming",planned,planned[0]?`Opent ${formatMoment(planned[0].scheduled_open_at)}`:"")}${section("Recente uitslagen",closed,"Gesloten")}${empty}</main>`,"",session,"motm");
  }catch(error){console.error("MOTM overview failed",error);return page("Stemmen",`<main class="motm-main">${pageHeader("Stemmen","Man of the Match")}<section class="empty"><h2>Tijdelijk niet beschikbaar</h2><p>Probeer het later opnieuw.</p></section></main>`,"",session,"motm");}
}
