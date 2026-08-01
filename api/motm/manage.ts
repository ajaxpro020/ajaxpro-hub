import { isSameOrigin, redirect } from "../../lib/discord-auth";
import { permissions } from "../../lib/permissions.config";
import { getSessionWithPermission } from "../../lib/server-permissions";
import { players } from "../../data/players";
import { db, resultsFor } from "../../lib/motm-db";
import { esc, errorPage, formatKickoff, matchHeading, page } from "../../lib/motm-view";

const params = (request: Request) => new URL(request.url).searchParams;
const manager = (request: Request) => getSessionWithPermission(request, permissions.motmManage);
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,50);
const playerPicker = () => `<div class="admin-players">${players.filter(p=>p.active).map(p=>`<label class="admin-player"><input type="checkbox" name="players" value="${esc(p.id)}" checked><span><img src="${esc(p.imageUrl)}" alt=""><b>${esc(p.name)}</b><small>${esc(p.position)}${p.shirtNumber ? ` · #${p.shirtNumber}`:""}</small></span></label>`).join("")}</div>`;

export async function GET(request: Request) {
  const session = await manager(request);
  if (!session) return errorPage("Geen beheerrecht", "Je hebt motm.manage nodig om stemmingen te beheren.", 403);
  const view = params(request).get("view") ?? "list"; const id = params(request).get("id");
  try {
    if (view === "new") return page("Nieuwe stemming", `<main class="motm-main admin"><a class="back" href="/club/motm/beheer">← Beheer</a><p class="eyebrow">Nieuwe stemming</p><h1>Wedstrijd instellen</h1><p class="sub">De volgende wedstrijd wordt voorgesteld. Controleer alles voor je opent.</p><form method="post" action="/club/motm/nieuw"><div class="form-grid"><label>Tegenstander<input required name="opponent" autocomplete="off"></label><label>Competitie<input required name="competition" value="Eredivisie"></label><label>Aftrap<input required type="datetime-local" name="kickoffAt"></label><label>Thuis of uit<select name="homeOrAway"><option value="home">Thuis</option><option value="away">Uit</option></select></label><label>Seizoen<input required name="season" value="2026/27"></label><label>Eindstand Ajax<input min="0" type="number" name="ajaxScore"></label><label>Eindstand tegenstander<input min="0" type="number" name="opponentScore"></label></div><h2>Selecteer spelers</h2>${playerPicker()}<div class="sticky-action admin-actions"><button class="button secondary" name="intent" value="draft">Opslaan als concept</button><button class="button" name="intent" value="open">Stemming openen</button></div></form></main>`, "/motm-admin.js");
    if (id) {
      const [match] = await db()`SELECT * FROM motm_matches WHERE id=${id}`; if (!match) return errorPage("Niet gevonden","Deze stemming bestaat niet.",404);
      const [{count}] = await db()`SELECT count(*)::int count FROM motm_votes WHERE match_id=${id}`;
      const results = match.status === "closed" ? await resultsFor(id) : [];
      return page("Stemming beheren", `<main class="motm-main admin"><a class="back" href="/club/motm/beheer">← Beheer</a><section class="match-head"><span class="status status-${match.status}">${match.status}</span>${matchHeading(match)}</section><section class="manage-panel"><p><strong>${count}</strong> stemmen</p><label>Deelbare URL<input id="share-url" readonly value="${esc(new URL(`/club/stemmen/${match.slug}`,request.url).href)}"></label><div class="share-actions"><button class="button secondary" type="button" data-copy>Kopieer link</button><button class="button secondary" type="button" data-share>Delen</button></div>${match.status === "draft" ? `<form method="post"><button class="button" name="intent" value="open">Stemming openen</button></form>`:""}${match.status === "open" ? `<form method="post"><button class="button danger" name="intent" value="close" onclick="return confirm('Stemming definitief sluiten?')">Stemming sluiten</button></form>`:""}${match.status === "closed" ? `<div class="closed-summary"><h2>Winnaar: ${esc(results[0]?.name_snapshot ?? "Geen stemmen")}</h2><p>${results[0]?.votes ?? 0} stemmen · ${results[0]?.percentage ?? 0}%</p><ol>${results.slice(0,3).map((r:any)=>`<li>${esc(r.name_snapshot)} <b>${r.votes} · ${r.percentage}%</b></li>`).join("")}</ol><a class="button" href="/club/stemmen/${esc(match.slug)}">Publieke uitslag</a></div>`:""}</section></main>`, "/motm-admin.js");
    }
    const matches = await db()`SELECT m.*,(SELECT count(*)::int FROM motm_votes v WHERE v.match_id=m.id) votes FROM motm_matches m ORDER BY created_at DESC LIMIT 30`;
    return page("MOTM-beheer", `<main class="motm-main admin"><div class="title-row"><div><p class="eyebrow">AjaxPro staf</p><h1>MOTM-beheer</h1></div><a class="button" href="/club/motm/nieuw">Nieuwe stemming</a></div><div class="manage-list">${matches.length ? matches.map((m:any)=>`<a href="/club/motm/beheer/${m.id}"><span class="status status-${m.status}">${m.status}</span><strong>Ajax — ${esc(m.opponent)}</strong><small>${esc(formatKickoff(m.kickoff_at))} · ${m.votes} stemmen</small></a>`).join("") : `<div class="empty"><h2>Nog geen stemmingen</h2><p>Maak de eerste Man of the Match-stemming.</p></div>`}</div></main>`);
  } catch (error) { console.error("MOTM admin failed",error); return errorPage("Database niet beschikbaar","Probeer het later opnieuw.",503); }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return errorPage("Ongeldige aanvraag","Ververs de pagina.",403);
  const session = await manager(request); if (!session) return errorPage("Geen beheerrecht","Je hebt motm.manage nodig.",403);
  const id=params(request).get("id"); const form=await request.formData(); const intent=String(form.get("intent")??"");
  try {
    if (id) {
      const [match]=await db()`SELECT status FROM motm_matches WHERE id=${id}`; if(!match)return errorPage("Niet gevonden","Deze stemming bestaat niet.",404);
      if(intent==="open"&&match.status==="draft") await db()`UPDATE motm_matches SET status='open',opened_at=now() WHERE id=${id} AND status='draft'`;
      else if(intent==="close"&&match.status==="open") await db()`UPDATE motm_matches SET status='closed',closed_at=now() WHERE id=${id} AND status='open'`;
      else return errorPage("Ongeldige statusovergang","Alleen concept → open → gesloten is toegestaan.",409);
      return redirect(`/club/motm/beheer/${id}`);
    }
    if(!["draft","open"].includes(intent)) return errorPage("Ongeldige actie","Kies opslaan of openen.");
    const opponent=String(form.get("opponent")??"").trim(),competition=String(form.get("competition")??"").trim(),kickoffAt=String(form.get("kickoffAt")??""),homeOrAway=String(form.get("homeOrAway")??""),season=String(form.get("season")??"").trim();
    const selected=[...new Set(form.getAll("players").map(String))]; const selectedPlayers=players.filter(p=>selected.includes(p.id)&&p.active);
    if(!opponent||!competition||!kickoffAt||!season||!["home","away"].includes(homeOrAway)||selectedPlayers.length<1)return errorPage("Controleer de invoer","Vul de wedstrijd in en selecteer minimaal één speler.");
    const ajaxScore=form.get("ajaxScore")===""?null:Number(form.get("ajaxScore")),oppScore=form.get("opponentScore")===""?null:Number(form.get("opponentScore"));
    const homeScore=homeOrAway==="home"?ajaxScore:oppScore,awayScore=homeOrAway==="home"?oppScore:ajaxScore;
    const slug=`${slugify(opponent)}-${new Date(kickoffAt).toISOString().slice(0,10)}-${crypto.randomUUID().slice(0,6)}`;
    const sql=db(); const [created]=await sql.begin(async tx=>{const [m]=await tx`INSERT INTO motm_matches(slug,opponent,competition,kickoff_at,home_or_away,home_score,away_score,season,status,created_by_discord_user_id,opened_at) VALUES(${slug},${opponent},${competition},${kickoffAt},${homeOrAway},${homeScore},${awayScore},${season},${intent},${session.userId},${intent==="open"?new Date():null}) RETURNING id`; for(const p of selectedPlayers)await tx`INSERT INTO motm_match_players(match_id,player_id,name_snapshot,shirt_number_snapshot,position_snapshot,image_url_snapshot) VALUES(${m.id},${p.id},${p.name},${p.shirtNumber},${p.position},${p.imageUrl})`; return [m];});
    return redirect(`/club/motm/beheer/${created.id}`);
  } catch(error){console.error("MOTM mutation failed",error);return errorPage("Opslaan mislukt","Controleer of de database klaarstaat en probeer opnieuw.",503);}
}
