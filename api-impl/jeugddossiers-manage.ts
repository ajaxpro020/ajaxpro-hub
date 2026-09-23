import { isSameOrigin, redirect } from "../lib/discord-auth";
import { getSessionWithPermission } from "../lib/server-permissions";
import { permissions } from "../lib/permissions.config";
import { db } from "../lib/motm-db";
import { esc, errorPage, page, pageHeader } from "../lib/motm-view";

const manager=(request:Request)=>getSessionWithPermission(request,permissions.jeugddossiersManage);
const asText=(v:unknown)=>v==null||v===""?null:String(v);
const date=(v:unknown)=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null;
const obj=(v:unknown)=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,any>:{};
const array=(v:unknown)=>Array.isArray(v)?v:[];
const validPhoto=(v:unknown,id:string,name:string)=>{const p=obj(v);return Object.keys(p).every(k=>["url","alt","credit","sourceId"].includes(k))&&typeof p.url==="string"&&p.url===`/jeugddossiers/players/${id}.webp`&&(p.alt==null||typeof p.alt==="string")&&(p.credit==null||typeof p.credit==="string")&&(p.sourceId==null||typeof p.sourceId==="string")&&(!p.alt||p.alt===name)};
const canonical=(rows:any[],meta:any)=>({schemaVersion:meta.schema_version,datasetRevision:String(meta.dataset_revision),datasetAsOf:meta.dataset_as_of?String(meta.dataset_as_of):null,players:rows.map(row=>({id:row.id,name:row.name,aliases:row.aliases,birthYear:row.birth_year,careerStatus:row.career_status,featured:row.featured,featuredOrder:row.featured_order,ajaxHistory:row.ajax_history,departureType:row.departure_type,departureReason:row.departure_reason,currentSituation:row.current_situation,careerEvents:row.career_events,sources:row.sources,editorial:{summary:row.editorial_summary,tags:row.editorial_tags,photo:row.photo},lastCheckedAt:row.last_checked_at}))});
const prompt=(dataset:any)=>`Je doet een periodieke researchupdate voor Ajax Pro Jeugddossiers.

Je ontvangt hieronder de huidige volledige Jeugddossiers-dataset. Jeugddossiers volgt opvallende Ajax-jeugdspelers die vroeg of bewust een andere route kozen.

Deze researchrun heeft twee onlosmakelijk verbonden doelen:
1. ACTUALISEREN: controleer of bestaande informatie sinds lastCheckedAt is veranderd.
2. VERRIJKEN: onderzoek actief of het dossier met betrouwbare, relevante informatie completer kan worden gemaakt, ook als de huidige club of carrièrestatus hetzelfde is.

Een speler is dus niet automatisch ongewijzigd wanneer hij nog bij dezelfde club speelt.

Selectieregels:
- speler kwam uit de Ajax-jeugdopleiding; tijdelijke verhuur vanuit Ajax telt niet als vertrek
- reguliere transfers van gevestigde Ajax 1-spelers vallen buiten scope
- zelf vertrekken, contract afwijzen, een andere opleidingsroute kiezen en opvallend vroeg vertrekken zijn relevante cases
- spelers die Ajax liet gaan alleen wanneer de verdere carrière redactioneel relevant is
- gebruik geen harde jeugdteamgrens als een jongere speler duidelijk relevant is

WERKWIJZE PER BESTAANDE ACTIEVE OF ONZEKERE SPELER

Werk per speler in één researchstroom: controleer eerst de kernsituatie en zoek vervolgens actief naar relevante dossierverrijking. Onderzoek niet alleen of iets veranderd is, maar ook wat de ontwikkeling van de speler sinds zijn Ajax-vertrek beter verklaart.

Controleer de bestaande kerngegevens:
- huidige club, team, competitie, land en niveau
- transfers, verhuurperiodes en terugkeer na verhuur
- carrièrestatus
- betrouwbare transfersommen

Zoek daarnaast gericht naar relevante verrijking, voor zover dit met bestaande ondersteunde velden, facts, careerEvents en sources kan worden vastgelegd:
- contractduur of contractverlenging
- promotie naar een hoger jeugdteam, beloften of eerste elftal
- officieel debuut, structurele betrokkenheid bij het eerste elftal, basisplaats of een veranderde sportieve rol
- recente wedstrijden, prestaties, doelpunten of assists wanneer die redactioneel iets over de ontwikkeling vertellen
- interlandselecties en jeugdinterlands
- blessures of langdurige afwezigheid wanneer die relevant zijn voor de carrièreontwikkeling
- onderscheidingen of andere opvallende prestaties
- relevante uitspraken van speler, trainer of club; interviews over ontwikkeling of carrièrekeuzes
- aanvullende betrouwbare context over eerdere transfers of een expliciete vertrekreden bij Ajax
- betrouwbare transferinteresse of transferontwikkelingen; maak duidelijk wanneer deze onbevestigd zijn
- andere aantoonbare ontwikkelingen die het dossier inhoudelijk completer maken

Het doel is geen statistiekendatabase. Voeg alleen feiten toe die redactioneel iets vertellen over de ontwikkeling van de speler sinds zijn vertrek bij Ajax.

RESEARCHGEDRAG

Gebruik openbare online bronnen wanneer externe research nodig is. Doe per speler meerdere gerichte zoekpogingen; beperk research niet tot alleen de spelersnaam. Kies zoekopdrachten die bij het dossier passen, bijvoorbeeld:
- naam + huidige club
- naam + contract
- naam + transfer
- naam + loan
- naam + debut
- naam + interview
- naam + injury
- naam + international
- naam + huidige seizoen
- naam + vorige club

Zoek waar nuttig ook in de taal van het land waar de speler actief is. Lees relevante gevonden pagina's daadwerkelijk; baseer geen nieuw feit uitsluitend op een zoeksnippet.

BRONNEN

Gebruik bronnen in deze volgorde van voorkeur:
1. officiële club
2. officiële competitie, bond of nationale ploeg
3. betrouwbare landelijke of lokale journalistieke bron
4. gespecialiseerde betrouwbare voetbalmedia
5. databases alleen ondersteunend

Officiële bronnen hebben voorkeur, maar beperk research daar niet toe. Een goed journalistiek interview, lokaal nieuwsartikel of betrouwbare sportbron kan waardevolle dossierverrijking opleveren.

FOTO-BACKFILL

Begin altijd met foto-backfill: controleer iedere bestaande speler zonder editorial.photo of zonder bruikbare photo.url. Zoek in deze volgorde: officiële huidige club, officiële recente vorige club, officiële competitie- of spelerspagina, daarna een betrouwbare voetbalbron. Bij een bruikbare foto: neem de speler op in updatedPlayers met lege facts, voeg zo nodig de bron toe via sourcesToAdd en gebruik uitsluitend editorialPhotoUpdate. Een speler mag dus alleen wegens een foto-update worden bijgewerkt. Zonder bruikbare foto blijft hij unchanged; verzin nooit een lokaal pad. Voer dezelfde fotozoektocht uit voor iedere newPlayer en voeg editorial.photo alleen toe wanneer het lokale asset daadwerkelijk bestaat.

NIEUWE SPELERS

Zoek daarnaast zelfstandig naar nieuwe relevante Ajax-jeugdvertrekkers sinds de vorige researchdatum. Pas alle selectieregels hierboven toe.

WANNEER IS IEMAND ONGEWIJZIGD?

Neem een speler alleen op in unchangedPlayerIds wanneer:
- de bestaande kernsituatie nog klopt;
- er geen correctie nodig is;
- én bredere research geen relevante nieuwe dossierinformatie heeft opgeleverd.

Een speler die nog bij dezelfde club speelt maar bijvoorbeeld debuteerde, promoveerde naar het eerste elftal, international werd, een nieuw contract tekende of nieuwe betrouwbare context over zijn carrière heeft, hoort dus in updatedPlayers en niet in unchangedPlayerIds.

REGELS DIE ALTIJD GELDEN

- verzin niets; onbekend is null; onbekende transfersom is nooit 0
- departureReason alleen bij expliciete bron
- iedere gewijzigde of nieuwe feitelijke claim heeft minstens één sourceId
- behoud player IDs en event IDs; verwijder nooit spelers, careerEvents of sources
- wijzig geen editorial data, behalve de beperkte foto-contracten hieronder
- beëindigde spelers hoeven normaal niet opnieuw uitgebreid onderzocht te worden
- laat bestaande feiten staan bij onvoldoende bewijs
- verander het JSON-contract niet en voeg geen nieuwe top-level velden toe

Geef uitsluitend geldig JSON terug, zonder markdown, in exact dit formaat:
{
  "schemaVersion":"1.0",
  "baseRevision":"${dataset.datasetRevision}",
  "researchAsOf":"YYYY-MM-DD",
  "updatedPlayers":[{"id":"bestaande-player-id","lastCheckedAt":"YYYY-MM-DD","sourcesToAdd":[],"facts":{},"careerEventsToAdd":[],"careerEventsToUpdate":[],"editorialPhotoUpdate":{"url":"/jeugddossiers/players/bestaande-player-id.webp","alt":"Spelernaam","credit":"Club of bron","sourceId":null}}],
  "newPlayers":[{"id":"nieuwe-speler-id","name":"Spelernaam","editorial":{"photo":{"url":"/jeugddossiers/players/nieuwe-speler-id.webp","alt":"Spelernaam","credit":"Club of bron","sourceId":null}}}],
  "unchangedPlayerIds":[]
}

Iedere bestaande speler moet in updatedPlayers of unchangedPlayerIds staan. facts bevat alleen opnieuw gecontroleerde of verrijkte ondersteunde velden. newPlayers bevat de volledige feitelijke dossierstructuur en mag optioneel uitsluitend editorial.photo bevatten. updatedPlayers mag optioneel uitsluitend editorialPhotoUpdate bevatten. Gebruik alleen lokale projectpaden; geen externe hotlinks. Laat foto weg als geen bruikbaar beeld beschikbaar is. alt is de spelersnaam, credit is bron of club wanneer bekend en sourceId verwijst waar mogelijk naar een bestaande of nieuwe bron. Summary, tags en featured mogen nooit worden gewijzigd. Bestaande bronverwijzingen blijven geldig.

HUIDIGE DATASET:
${JSON.stringify(dataset,null,2)}`;

type Validation={errors:string[];value:any|null;summary:{newPlayers:string[];updatedPlayers:{name:string;items:string[]}[];unchanged:number}};
const validate=(raw:string,rows:any[],revision:string):Validation=>{let value:any;const errors:string[]=[];try{value=JSON.parse(raw)}catch{ return {errors:["Het bestand bevat geen geldige JSON."],value:null,summary:{newPlayers:[],updatedPlayers:[],unchanged:0}}}const ids=new Map(rows.map(r=>[r.id,r]));if(value?.schemaVersion!=="1.0")errors.push("schemaVersion moet 1.0 zijn.");if(String(value?.baseRevision??"")!==revision)errors.push("baseRevision komt niet overeen met de huidige dataset.");if(!date(value?.researchAsOf))errors.push("researchAsOf moet YYYY-MM-DD zijn.");for(const key of ["updatedPlayers","newPlayers","unchangedPlayerIds"])if(!Array.isArray(value?.[key]))errors.push(`${key} moet een array zijn.`);const seen=new Set<string>();for(const update of array(value?.updatedPlayers)){if(!ids.has(update?.id))errors.push(`Onbekend dossier: ${update?.id??"zonder id"}.`);else if(seen.has(update.id))errors.push(`Dossier dubbel opgenomen: ${update.id}.`);else seen.add(update.id);if(!date(update?.lastCheckedAt))errors.push(`lastCheckedAt ontbreekt voor ${update?.id??"dossier"}.`);for(const key of ["sourcesToAdd","careerEventsToAdd","careerEventsToUpdate"])if(!Array.isArray(update?.[key]))errors.push(`${key} moet een array zijn voor ${update?.id??"dossier"}.`);if(update?.facts&&typeof update.facts!=="object")errors.push(`facts moet een object zijn voor ${update?.id}.`);if(update?.editorial||update?.photo)errors.push(`Alleen editorialPhotoUpdate is toegestaan in update ${update?.id}.`);if(update?.editorialPhotoUpdate&&!validPhoto(update.editorialPhotoUpdate,String(update.id),String(ids.get(update.id)?.name??"")))errors.push(`Ongeldige foto-update voor ${update?.id}.`)}for(const id of array(value?.unchangedPlayerIds)){if(!ids.has(id)||seen.has(id))errors.push(`Ongeldige of dubbele unchangedPlayerId: ${id}.`);else seen.add(id)}if(seen.size!==ids.size)errors.push("Iedere bestaande speler moet bijgewerkt of ongewijzigd zijn opgenomen.");for(const player of array(value?.newPlayers)){if(!player?.id||ids.has(player.id)||!player.name)errors.push("Elke nieuwe speler heeft een nieuw id en naam nodig.");if(player?.photo)errors.push(`Nieuwe speler ${player?.id??""} bevat een ongeldig top-level photo-veld.`);if(player?.editorial&&(!Object.keys(obj(player.editorial)).every(k=>k==="photo")||!validPhoto(obj(player.editorial).photo,String(player.id),String(player.name))))errors.push(`Nieuwe speler ${player?.id??""} bevat ongeldige editorial data.`)}const summary={newPlayers:array(value?.newPlayers).map((p:any)=>`${String(p.name??p.id)}${obj(p.editorial).photo?" + foto":""}`),updatedPlayers:array(value?.updatedPlayers).map((u:any)=>{const r=ids.get(u.id),f=obj(u.facts),items=[...Object.keys(f).map(k=>`${k} gewijzigd`),array(u.careerEventsToAdd).length?`${array(u.careerEventsToAdd).length} nieuw carrière-event`:"",array(u.sourcesToAdd).length?`${array(u.sourcesToAdd).length} nieuwe bron`:"",u.editorialPhotoUpdate?"foto bijgewerkt":""].filter(Boolean);return {name:r?.name??u.id,items}}),unchanged:array(value?.unchangedPlayerIds).length};return {errors,value:errors.length?null:value,summary}};
const preview=(v:Validation,raw:string)=>`<section class="jeugd-manage__section jeugd-manage__preview"><div class="jeugd-manage__section-head"><div><p class="eyebrow">Update importeren</p><h2>Preview</h2></div><span class="status ${v.errors.length?"status-draft":"status-open"}">${v.errors.length?"Validatiefouten":"Klaar voor publicatie"}</span></div>${v.errors.length?`<ul>${v.errors.map(e=>`<li>${esc(e)}</li>`).join("")}</ul>`:`<p>${v.summary.newPlayers.length} nieuwe spelers · ${v.summary.updatedPlayers.length} bijgewerkte spelers · ${v.summary.unchanged} ongewijzigd.</p><ul>${v.summary.newPlayers.map(n=>`<li><strong>${esc(n)}</strong> · nieuw dossier</li>`).join("")}${v.summary.updatedPlayers.map(u=>`<li><strong>${esc(u.name)}</strong>${u.items.length?` · ${esc(u.items.join(", "))}`:" · alleen controle bijgewerkt"}</li>`).join("")}</ul><form method="post"><input type="hidden" name="intent" value="publish"><textarea class="sr-only" name="updateJson">${esc(raw)}</textarea><button class="button">Publiceer update</button></form>`}</section>`;

export async function GET(request:Request){const session=await manager(request);if(!session)return errorPage("Geen toegang","Dit beheeronderdeel is alleen beschikbaar voor Ajax Pro-staf.",403);try{const sql=db();const rows=await sql`SELECT * FROM youth_dossiers ORDER BY name`;let [meta]=await sql`SELECT * FROM youth_dossier_dataset WHERE singleton=true`;if(!meta)throw new Error("MIGRATION");const dataset=canonical(rows,meta);if(new URL(request.url).searchParams.get("download")==="1")return new Response(JSON.stringify(dataset,null,2),{headers:{"content-type":"application/json; charset=utf-8","content-disposition":"attachment; filename=jeugddossiers-dataset.json"}});const active=rows.filter(r=>r.career_status==="active").length,retired=rows.filter(r=>r.career_status==="retired").length;return page("Jeugddossiers beheren",`<main class="motm-main admin jeugd-manage"><header class="jeugd-manage__header">${pageHeader("Jeugddossiers beheren","AjaxPro staf","/club/tools","Tools")}<p>Werk de volledige dataset gecontroleerd bij via één research-updatebestand.</p></header><section class="jeugd-manage__section jeugd-manage__dataset"><div><p class="eyebrow">Huidige dataset</p><h2>Overzicht</h2></div><dl class="jeugd-manage__stats"><div><dt>Dossiers</dt><dd>${rows.length}</dd></div><div><dt>Actief</dt><dd>${active}</dd></div><div><dt>Beëindigd</dt><dd>${retired}</dd></div><div><dt>Laatst gecontroleerd</dt><dd>${esc(dataset.datasetAsOf??"Onbekend")}</dd></div><div><dt>Datasetrevision</dt><dd>${esc(dataset.datasetRevision)}</dd></div></dl><a class="button secondary" href="/club/tools/jeugddossiers?download=1">Download huidige dataset</a></section><section class="jeugd-manage__section jeugd-manage__research"><div class="jeugd-manage__section-head"><div><p class="eyebrow">Nieuwe researchrun</p><h2>Researchprompt</h2><p>Gebruik deze volledige, actuele opdracht in de LLM van je keuze.</p></div><button class="button secondary" type="button" data-copy-researchprompt>Kopieer researchprompt</button></div><textarea readonly rows="18">${esc(prompt(dataset))}</textarea></section><section class="jeugd-manage__section jeugd-manage__import"><div><p class="eyebrow">Update importeren</p><h2>Valideer eerst, publiceer daarna</h2><p>Een upload wijzigt niets totdat alle controles slagen.</p></div><form method="post" enctype="multipart/form-data"><input type="hidden" name="intent" value="preview"><label>Research-update JSON<input required type="file" name="updateFile" accept="application/json,.json"></label><button class="button">Valideer en bekijk preview</button></form></section></main>`,`/jeugddossiers-manage.js`,session,"tools",undefined,{stylesheets:["/jeugddossiers.css"]});}catch(e){console.error(e);return errorPage("Dataset niet beschikbaar","Voer eerst migratie 031 uit.",503,session,"/club/tools","tools")}}
export async function POST(request:Request){if(!isSameOrigin(request))return errorPage("Ongeldige aanvraag","Ververs de pagina.",403);const session=await manager(request);if(!session)return errorPage("Geen toegang","Dit beheeronderdeel is alleen beschikbaar voor Ajax Pro-staf.",403);const form=await request.formData(),intent=String(form.get("intent")??"");const raw=intent==="preview"?await (form.get("updateFile") as File)?.text():String(form.get("updateJson")??"");if(!raw)return errorPage("Geen bestand","Kies een research-updatebestand.",400,session,"/club/tools/jeugddossiers","tools");try{const sql=db(),rows=await sql`SELECT * FROM youth_dossiers ORDER BY name`,[meta]=await sql`SELECT * FROM youth_dossier_dataset WHERE singleton=true`;const v=validate(raw,rows,String(meta.dataset_revision));if(intent==="preview")return page("Updatepreview",`<main class="motm-main admin jeugd-manage">${pageHeader("Updatepreview","Jeugddossiers","/club/tools/jeugddossiers","Terug")}${preview(v,raw)}</main>`,``,session,"tools",undefined,{stylesheets:["/jeugddossiers.css"]});if(intent!=="publish"||v.errors.length)return errorPage("Update niet gepubliceerd","De update is ongeldig.",400,session,"/club/tools/jeugddossiers","tools");await sql.begin(async tx=>{const [locked]=await tx`SELECT * FROM youth_dossier_dataset WHERE singleton=true FOR UPDATE`;if(String(locked.dataset_revision)!==String(v.value.baseRevision))throw new Error("REVISION");for(const u of v.value.updatedPlayers){const old=rows.find(r=>r.id===u.id)!,facts=obj(u.facts),events=array(old.career_events),byId=new Map(events.map((e:any)=>[e.id,e]));for(const e of array(u.careerEventsToUpdate)){if(!e?.id||!byId.has(e.id))throw new Error("EVENT");byId.set(e.id,{...byId.get(e.id),...e})}const mergedEvents=[...byId.values(),...array(u.careerEventsToAdd)],sources=[...array(old.sources),...array(u.sourcesToAdd)];await tx`UPDATE youth_dossiers SET aliases=COALESCE(${facts.aliases??null},aliases),birth_year=COALESCE(${facts.birthYear??null},birth_year),career_status=COALESCE(${facts.careerStatus??null},career_status),ajax_history=COALESCE(${facts.ajaxHistory?tx.json(facts.ajaxHistory):null},ajax_history),departure_type=COALESCE(${facts.departureType??null},departure_type),departure_reason=COALESCE(${facts.departureReason?tx.json(facts.departureReason):null},departure_reason),current_situation=COALESCE(${facts.currentSituation?tx.json(facts.currentSituation):null},current_situation),career_events=${tx.json(mergedEvents)},sources=${tx.json(sources)},photo=${u.editorialPhotoUpdate?tx.json(u.editorialPhotoUpdate):old.photo},last_checked_at=${u.lastCheckedAt},updated_at=now() WHERE id=${u.id}`;}for(const p of v.value.newPlayers){await tx`INSERT INTO youth_dossiers(id,name,aliases,birth_year,career_status,ajax_history,departure_type,departure_reason,current_situation,career_events,sources,photo,last_checked_at) VALUES(${p.id},${p.name},${array(p.aliases)},${p.birthYear??null},${p.careerStatus??"unknown"},${tx.json(obj(p.ajaxHistory))},${p.departureType??"unknown"},${p.departureReason?tx.json(p.departureReason):null},${tx.json(obj(p.currentSituation))},${tx.json(array(p.careerEvents))},${tx.json(array(p.sources))},${obj(p.editorial).photo?tx.json(obj(p.editorial).photo):null},${p.lastCheckedAt??v.value.researchAsOf})`;}await tx`UPDATE youth_dossier_dataset SET dataset_revision=dataset_revision+1,dataset_as_of=${v.value.researchAsOf},updated_at=now() WHERE singleton=true`;});return redirect("/club/tools/jeugddossiers?published=1");}catch(e){console.error(e);return errorPage("Update niet gepubliceerd",e instanceof Error&&["REVISION","EVENT"].includes(e.message)?"De dataset veranderde of bevat een onbekend carrière-event. Vernieuw de researchrun.":"Er ging iets mis; de dataset is niet gewijzigd.",409,session,"/club/tools/jeugddossiers","tools")}}
