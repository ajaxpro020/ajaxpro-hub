import { isSameOrigin, redirect } from "../../lib/discord-auth";
import { permissions } from "../../lib/permissions.config";
import { getSessionWithPermission } from "../../lib/server-permissions";
import { players } from "../../data/players";
import { db, resultsFor } from "../../lib/motm-db";
import { esc, errorPage, formatKickoff, formatMoment, matchHeading, page, pageHeader, remainingTime } from "../../lib/motm-view";
import { synchronizeAllMatches, synchronizeMatch } from "../../lib/motm-scheduling";
import { amsterdamInputToUtc, defaultSchedule, statusLabel, toAmsterdamInput, voteLabel, winnerLabel } from "../../lib/motm-rules";

const params = (request: Request) => new URL(request.url).searchParams;
const manager = (request: Request) => getSessionWithPermission(request, permissions.motmManage);
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,50);
const activePlayers=players.filter(p=>p.active);
const playerPicker = () => `<div class="selection-count" aria-live="polite"><strong data-player-count>${activePlayers.length}</strong> spelers geselecteerd</div><div class="admin-players">${activePlayers.map(p=>`<label class="admin-player"><input type="checkbox" name="players" value="${esc(p.id)}" checked><span><img src="${esc(p.imageUrl)}" alt=""><b>${esc(p.name)}</b><small>${esc(p.position)}${p.shirtNumber ? ` · #${p.shirtNumber}`:""}</small></span></label>`).join("")}</div>`;
const scheduleFields = (openValue="",closeValue="") => `<label>Stemming opent<input required type="datetime-local" name="scheduledOpenAt" value="${esc(openValue)}"></label><label>Stemming sluit<input required type="datetime-local" name="scheduledCloseAt" value="${esc(closeValue)}"></label>`;

export async function GET(request: Request) {
  const session = await manager(request);
  if (!session) return errorPage("Geen beheerrecht", "Je hebt motm.manage nodig om stemmingen te beheren.", 403);
  const view=params(request).get("view")??"list", id=params(request).get("id");
  try {
    await synchronizeAllMatches();
    if(view==="new") return page("Nieuwe stemming",`<main class="motm-main admin new-poll">${pageHeader("Nieuwe stemming","MOTM-beheer","/club/motm/beheer","Beheer")}<p class="sub">Tijden zijn Nederlandse tijd. Controleer alles voor je de stemming opent.</p><form method="post" action="/club/motm/nieuw"><fieldset><legend><span>1</span> Wedstrijd</legend><div class="form-grid"><label>Tegenstander<input required name="opponent" autocomplete="off"></label><label>Competitie<input required name="competition" value="Eredivisie"></label><label>Aftrap<input required type="datetime-local" name="kickoffAt"></label><label>Thuis of uit<select name="homeOrAway"><option value="home">Thuis</option><option value="away">Uit</option></select></label><label>Seizoen<input required name="season" value="2026/27"></label><label>Eindstand Ajax<input min="0" type="number" name="ajaxScore"></label><label>Eindstand tegenstander<input min="0" type="number" name="opponentScore"></label></div></fieldset><fieldset><legend><span>2</span> Planning</legend><div class="form-grid">${scheduleFields()}</div></fieldset><fieldset><legend><span>3</span> Spelers</legend>${playerPicker()}</fieldset><fieldset class="finish"><legend><span>4</span> Afronden</legend><p>Sla veilig op als concept, of open de stemming direct voor leden.</p><div class="admin-actions"><button class="button secondary" name="intent" value="draft">Opslaan als concept</button><button class="button" name="intent" value="open">Direct openen <small>Aanbevolen na controle</small></button></div></fieldset></form></main>`,"/motm-admin.js",session);
    if(id){
      let [match]=await db()`SELECT * FROM motm_matches WHERE id=${id}`; if(!match)return errorPage("Niet gevonden","Deze stemming bestaat niet.",404);
      match=await synchronizeMatch(match as any);
      const [{count}]=await db()`SELECT count(*)::int count FROM motm_votes WHERE match_id=${id}`;
      const results=match.status==="closed"?await resultsFor(id):[]; const winners=results.filter(row=>row.rank===1);
      const timing=match.status==="draft"?`<form class="schedule-form" method="post"><div class="form-grid">${scheduleFields(toAmsterdamInput(match.scheduled_open_at),toAmsterdamInput(match.scheduled_close_at))}</div><button class="button secondary" name="intent" value="schedule">Planning opslaan</button><button class="button" name="intent" value="open">Direct openen</button></form>`:match.status==="open"?`<div class="timing"><p><span>Geopend op</span><strong>${formatMoment(match.opened_at)}</strong></p><p><span>Sluit automatisch op</span><strong>${formatMoment(match.scheduled_close_at)}</strong></p><p><span>Resterende tijd</span><strong>${remainingTime(match.scheduled_close_at)}</strong></p></div><form method="post"><button class="button danger" name="intent" value="close" onclick="return confirm('Stemming definitief sluiten?')">Direct sluiten</button></form>`:`<div class="timing"><p><span>Gesloten op</span><strong>${formatMoment(match.closed_at)}</strong></p></div>`;
      const closed=match.status==="closed"?`<div class="closed-summary"><h2>${winners.length>1?"Gedeelde winnaars":"Winnaar"}: ${winners.length?esc(winners.map(row=>row.name_snapshot).join(" & ")):"Geen stemmen"}</h2>${winners.length?`<p>${winnerLabel(winners.length)} · ${voteLabel(winners[0].votes)} · ${winners[0].percentage}%</p>`:""}<ol>${results.map(row=>`<li><span>${row.rank}. ${esc(row.name_snapshot)}</span><b>${voteLabel(row.votes)} · ${row.percentage}%</b></li>`).join("")}</ol><a class="button" href="/club/stemmen/${esc(match.slug)}">Publieke uitslag</a></div>`:"";
      return page("Stemming beheren",`<main class="motm-main admin">${pageHeader("Wedstrijdbeheer","MOTM-beheer","/club/motm/beheer","Beheer")}<section class="match-head"><span class="status status-${match.status}">${statusLabel(match.status)}</span>${matchHeading(match)}</section><section class="manage-panel"><p><strong>${voteLabel(Number(count))}</strong></p><label>Openbare deel-URL<input id="share-url" readonly value="${esc(new URL(`/stem/${match.slug}`,request.url).href)}" data-share-title="${esc(match.status==="closed"?"Bekijk de AjaxPro Man of the Match":"Stem op de AjaxPro Man of the Match")}" data-share-text="${esc(`Ajax tegen ${match.opponent}.`)}"></label><div class="share-actions"><button class="button secondary" type="button" data-copy>Kopieer link</button><button class="button secondary" type="button" data-share>Delen</button></div>${timing}${closed}</section></main>`,"/motm-admin.js",session);
    }
    const matches=await db()`SELECT m.*,(SELECT count(*)::int FROM motm_votes v WHERE v.match_id=m.id) votes FROM motm_matches m ORDER BY created_at DESC LIMIT 30`;
    const groups=[{key:"draft",title:"Concept"},{key:"open",title:"Open"},{key:"closed",title:"Gesloten"}];const planned=matches.filter((m:any)=>m.status==="draft"&&m.scheduled_open_at);const grouped=[{key:"planned",title:"Gepland",items:planned},...groups.map(group=>({...group,items:matches.filter((m:any)=>m.status===group.key&&(group.key!=="draft"||!m.scheduled_open_at))}))];const groupHtml=grouped.map(group=>`<section class="manage-group"><div class="section-heading"><h2>${group.title}</h2><span>${group.items.length}</span></div>${group.items.length?`<div class="manage-list">${group.items.map((m:any)=>`<a href="/club/motm/beheer/${m.id}"><span class="status status-${m.status}">${group.title}</span><span><strong>Ajax — ${esc(m.opponent)}</strong><small>Opent ${esc(formatMoment(m.scheduled_open_at))} · sluit ${esc(formatMoment(m.scheduled_close_at))} · ${voteLabel(Number(m.votes))}</small></span><b>Beheren →</b></a>`).join("")}</div>`:`<p class="group-empty">Geen stemmingen</p>`}</section>`).join("");
    return page("MOTM-beheer",`<main class="motm-main admin">${pageHeader("MOTM-beheer","AjaxPro staf","/club/motm","Stemmen",'<a class="button" href="/club/motm/nieuw">Nieuwe stemming</a>')}${groupHtml}</main>`,"",session);
  }catch(error){console.error("MOTM admin failed",error);return errorPage("Database niet beschikbaar","Probeer het later opnieuw.",503);}
}

export async function POST(request: Request) {
  if(!isSameOrigin(request))return errorPage("Ongeldige aanvraag","Ververs de pagina.",403);
  const session=await manager(request);if(!session)return errorPage("Geen beheerrecht","Je hebt motm.manage nodig.",403);
  const id=params(request).get("id"),form=await request.formData(),intent=String(form.get("intent")??"");
  try{
    await synchronizeAllMatches();
    if(id){
      let [match]=await db()`SELECT * FROM motm_matches WHERE id=${id}`;if(!match)return errorPage("Niet gevonden","Deze stemming bestaat niet.",404);match=await synchronizeMatch(match as any);
      if(intent==="schedule"&&match.status==="draft"){
        const openAt=amsterdamInputToUtc(String(form.get("scheduledOpenAt")??"")),closeAt=amsterdamInputToUtc(String(form.get("scheduledCloseAt")??""));
        if(!openAt||!closeAt||closeAt<=openAt)return errorPage("Controleer de planning","De sluiting moet na de opening liggen.");
        await db()`UPDATE motm_matches SET scheduled_open_at=${openAt},scheduled_close_at=${closeAt} WHERE id=${id} AND status='draft'`;
      }else if(intent==="open"&&match.status==="draft")await db()`UPDATE motm_matches SET status='open',opened_at=now() WHERE id=${id} AND status='draft'`;
      else if(intent==="close"&&match.status==="open")await db()`UPDATE motm_matches SET status='closed',closed_at=now() WHERE id=${id} AND status='open'`;
      else return errorPage("Ongeldige statusovergang","Alleen Concept → Open → Gesloten is toegestaan.",409);
      return redirect(`/club/motm/beheer/${id}`);
    }
    if(!["draft","open"].includes(intent))return errorPage("Ongeldige actie","Kies opslaan of direct openen.");
    const opponent=String(form.get("opponent")??"").trim(),competition=String(form.get("competition")??"").trim(),homeOrAway=String(form.get("homeOrAway")??""),season=String(form.get("season")??"").trim();
    const kickoffAt=amsterdamInputToUtc(String(form.get("kickoffAt")??"")); if(!kickoffAt)return errorPage("Controleer de aftrap","Gebruik een geldige Nederlandse datum en tijd.");
    const defaults=defaultSchedule(kickoffAt),openInput=String(form.get("scheduledOpenAt")??""),closeInput=String(form.get("scheduledCloseAt")??"");
    const scheduledOpenAt=openInput?amsterdamInputToUtc(openInput):defaults.openAt,scheduledCloseAt=closeInput?amsterdamInputToUtc(closeInput):defaults.closeAt;
    const selected=[...new Set(form.getAll("players").map(String))],selectedPlayers=players.filter(p=>selected.includes(p.id)&&p.active);
    if(!opponent||!competition||!season||!["home","away"].includes(homeOrAway)||!scheduledOpenAt||!scheduledCloseAt||scheduledCloseAt<=scheduledOpenAt||!selectedPlayers.length)return errorPage("Controleer de invoer","Vul de wedstrijd en geldige planning in en selecteer minimaal één speler.");
    const ajaxScore=form.get("ajaxScore")===""?null:Number(form.get("ajaxScore")),oppScore=form.get("opponentScore")===""?null:Number(form.get("opponentScore")),homeScore=homeOrAway==="home"?ajaxScore:oppScore,awayScore=homeOrAway==="home"?oppScore:ajaxScore;
    const slug=`${slugify(opponent)}-${kickoffAt.toISOString().slice(0,10)}-${crypto.randomUUID().slice(0,6)}`,sql=db();
    const [created]=await sql.begin(async tx=>{const [m]=await tx`INSERT INTO motm_matches(slug,opponent,competition,kickoff_at,home_or_away,home_score,away_score,season,status,created_by_discord_user_id,opened_at,scheduled_open_at,scheduled_close_at) VALUES(${slug},${opponent},${competition},${kickoffAt},${homeOrAway},${homeScore},${awayScore},${season},${intent},${session.userId},${intent==="open"?new Date():null},${scheduledOpenAt},${scheduledCloseAt}) RETURNING id`;for(const p of selectedPlayers)await tx`INSERT INTO motm_match_players(match_id,player_id,name_snapshot,shirt_number_snapshot,position_snapshot,image_url_snapshot) VALUES(${m.id},${p.id},${p.name},${p.shirtNumber},${p.position},${p.imageUrl})`;return[m];});
    return redirect(`/club/motm/beheer/${created.id}`);
  }catch(error){console.error("MOTM mutation failed",error);return errorPage("Opslaan mislukt","Controleer of migratie 002 is uitgevoerd en probeer opnieuw.",503);}
}
