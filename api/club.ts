import { redirect } from "../lib/discord-auth";
import { permissions } from "../lib/permissions.config";
import { getSessionWithPermission } from "../lib/server-permissions";
import { db, resultsFor } from "../lib/motm-db";
import { esc, formatKickoff, formatMoment, page, pageHeader, remainingTime } from "../lib/motm-view";
import { synchronizeAllMatches } from "../lib/motm-scheduling";
import { renderToolSections, toolsForSession } from "../lib/portal-tools.config";

export async function GET(request: Request) {
  const session=await getSessionWithPermission(request,permissions.portalAccess); if(!session)return redirect("/api/auth/discord-login");
  let spotlight=`<section class="club-spotlight unavailable"><div><span class="status">Geen stemming</span><p class="eyebrow">Man of the Match</p><h2>Nog geen stemming</h2><p>Zodra er een stemming klaarstaat, verschijnt die hier.</p></div></section>`;
  try {
    await synchronizeAllMatches();
    const [open]=await db()`SELECT * FROM motm_matches WHERE status='open' ORDER BY opened_at DESC LIMIT 1`;
    if(open){const [vote]=await db()`SELECT p.name_snapshot FROM motm_votes v JOIN motm_match_players p ON p.match_id=v.match_id AND p.player_id=v.player_id WHERE v.match_id=${open.id} AND v.voter_discord_user_id=${session.userId}`;spotlight=`<section class="club-spotlight"><div><span class="status status-open">Open</span><p class="eyebrow">Man of the Match</p><h2>Ajax — ${esc(open.opponent)}</h2><p>Sluit ${esc(formatMoment(open.scheduled_close_at))} · nog ${esc(remainingTime(open.scheduled_close_at))}</p>${vote?`<p class="own">Jouw keuze: <strong>${esc(vote.name_snapshot)}</strong></p>`:""}</div><div class="spotlight-actions"><a class="button" href="/club/stemmen/${esc(open.slug)}">Stem nu</a></div></section>`}
    else {const [planned]=await db()`SELECT * FROM motm_matches WHERE status='draft' AND scheduled_open_at IS NOT NULL ORDER BY scheduled_open_at LIMIT 1`;if(planned){spotlight=`<section class="club-spotlight"><div><span class="status status-planned">Gepland</span><p class="eyebrow">Man of the Match</p><h2>Ajax — ${esc(planned.opponent)}</h2><p>Opent ${esc(formatMoment(planned.scheduled_open_at))}</p></div></section>`}else{const [last]=await db()`SELECT * FROM motm_matches WHERE status='closed' ORDER BY closed_at DESC LIMIT 1`;if(last){const results=await resultsFor(last.id), winners=results.filter(row=>row.rank===1), winner=winners[0];spotlight=`<section class="club-spotlight result-spotlight"><div>${winner?`<img src="${esc(winner.image_url_snapshot)}" alt="">`:""}</div><div><span class="status status-closed">Gesloten</span><p class="eyebrow">Laatste winnaar</p><h2>${winners.length?esc(winners.map(row=>row.name_snapshot).join(" & ")):"Geen stemmen"}</h2><p>Ajax — ${esc(last.opponent)}${winner?` · ${winner.votes} ${winner.votes===1?"stem":"stemmen"} · ${winner.percentage}%`:""}</p></div><div class="spotlight-actions"><a class="button secondary" href="/club/stemmen/${esc(last.slug)}">Bekijk uitslag</a></div></section>`}}}
  }catch(error){console.error("Club MOTM spotlight failed",error);spotlight=`<section class="club-spotlight unavailable"><div><p class="eyebrow">Man of the Match</p><h2>Tijdelijk niet beschikbaar</h2><p>Probeer het later opnieuw.</p></div></section>`}
  const body=`<main class="motm-main club-main">${pageHeader("Club","AjaxPro Club")} ${spotlight}${renderToolSections(toolsForSession(session),{overviewLink:true})}</main>`;
  return page("Club",body,"",session,"home");
}
