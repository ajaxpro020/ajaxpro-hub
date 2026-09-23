# AjaxPro Tools — UX-audit achter de login

Datum: 8 september 2026. Scope: huidige lokale werkboom, inclusief reeds aanwezige wijzigingen. Alleen dit auditdocument is toegevoegd; applicatiecode, configuratie, data en bestaande wijzigingen zijn niet aangepast.

## Leeswijzer en hoofdconclusie

AjaxPro heeft al een gedeelde visuele basis en navigatieshell. De ontbrekende laag is vooral een productcontract: wat bewerk ik, wanneer is iets opgeslagen, wat gebeurt er bij een contextwissel, welke status heeft het werk en welke actie past daarbij? Meer uniforme cards of animaties lossen deze vragen niet op.

Vier bevindingen verdienen voorrang: automatische overschrijving van bestaande wedstrijdvelden, het verschil tussen concept en geplande publicatie, onbetrouwbare bevestiging van impactvolle acties, en statistieken die bij een andere wedstrijd of speler blijven staan.

Naamgeving: de opdracht noemt “Match of the Day-beheer”; de gevonden interface heet **Man of the Match / MOTM-beheer**. “Social Creator” heet in navigatie en code **Socials**. Er is geen afzonderlijk Match of the Day-beheerscherm gevonden. `matchday_fixtures` is een databron, geen aangetroffen beheertool.

**Methode en grenzen.** Routeconfiguratie, server-rendered HTML, clientevents, statusregels, permissions en CSS zijn read-only onderzocht. Impeccable is gebruikt als auditkader, met nadruk op de gevraagde informatiearchitectuur en interactie. Dit is geen live gebruikerstest: er is geen ingelogde browserflow uitgevoerd, geen productieactie verstuurd en geen database geraadpleegd. Codegedrag en productmatige gevolgen worden hieronder onderscheiden; schermhoogte, contrast, focusgedrag en werkelijke foutfrequentie zijn niet in een browser gemeten. De externe tools zijn alleen als navigatiebestemming onderzocht.

De Impeccable-detector (`detect.mjs --json api-impl`) gaf `[]`, exitcode 0. Dat is geen bewijs van goede UX of volledige dekking van HTML in TypeScript-templates. De bevindingen komen uit handmatige broninspectie. Geen functionele tests gedraaid: er is niets geïmplementeerd. Prioriteiten volgen de definities uit de opdracht, niet een release- of securityclassificatie.

## 1. Inventory

### Routes en oppervlakken

De routekaart is gecontroleerd in [vercel.json](/Users/zag/Documents/ajax-pro-tools/vercel.json), de bijbehorende handlers en het [toolregister](/Users/zag/Documents/ajax-pro-tools/lib/portal-tools.config.ts:18).

| Interface | Route / toegang | Bestanden en rol |
|---|---|---|
| Club-home | `/club`; `portal.access` | [api/club.ts](/Users/zag/Documents/ajax-pro-tools/api/club.ts): begroeting, actieve stemming, eigen stem of laatste uitslag. [club.js](/Users/zag/Documents/ajax-pro-tools/club.js): delen. |
| Tooloverzicht | `/club/tools`; login, aanbod op rechten | [api/club-tools.ts](/Users/zag/Documents/ajax-pro-tools/api/club-tools.ts), `toolsForSession`, `renderToolsGrid` in toolregister. |
| MOTM-beheerlijst | `/club/motm/beheer`; `motm.manage` | [api-impl/motm/manage.ts](/Users/zag/Documents/ajax-pro-tools/api-impl/motm/manage.ts:77), via [api/motm-manage.ts](/Users/zag/Documents/ajax-pro-tools/api/motm-manage.ts). Zoeken, statusgroepen, nieuw. |
| MOTM aanmaken | `/club/motm/nieuw`; `motm.manage` | `manage.ts`, GET `view=new`, `createMatch`; [motm-admin.js](/Users/zag/Documents/ajax-pro-tools/motm-admin.js:1). |
| MOTM-detailbeheer | `/club/motm/beheer/:id`; verwijderen/herstellen daarnaast `motm.delete` | `manage.ts`, `detail`, POST-intents. Wedstrijd, planning, spelers, delen, Discord, live stemmen, resultaatvisual, log. |
| Live stemgegevens | `/club/motm/beheer/:id/live` | JSON-endpoint voor het paneel in detailbeheer; **geen afzonderlijke schermroute**. `liveVotes`, `liveVotePanel`, polling in `motm-admin.js`. |
| Socials | `/club/tools/socials`; `tools.socials` | [api-impl/socials/index.ts](/Users/zag/Documents/ajax-pro-tools/api-impl/socials/index.ts:46), [socials/main.mjs](/Users/zag/Documents/ajax-pro-tools/socials/main.mjs:1), `socials.css`. Stats, Quote en Spelerstats wisselen binnen dezelfde route. |
| Tactiekbord | Extern: `https://ajaxpro-tactics-board.vercel.app`; link vereist `tools.tactics` | Alleen registervermelding in deze codebase. Externe UI en toegangscontrole niet beoordeeld. |
| Screenshot Editor | Extern: `https://screenshot-bewerker.vercel.app`; link vereist `tools.screenshot` | Alleen registervermelding; opent net als Tactiekbord in nieuw tabblad. |
| MOTM ledenoverzicht | `/club/motm`; `portal.access` | [api-impl/motm/index.ts](/Users/zag/Documents/ajax-pro-tools/api-impl/motm/index.ts:10). Actief, gepland, recente uitslagen. |
| Stemmen / uitslag | `/club/stemmen/:slug`; `portal.access` | [api-impl/motm/vote.ts](/Users/zag/Documents/ajax-pro-tools/api-impl/motm/vote.ts:27). Statusafhankelijk stemmen, ontvangstbevestiging of uitslag. |
| Seizoenstand | `/club/stand`; `portal.access` | [api-impl/motm/stand.ts](/Users/zag/Documents/ajax-pro-tools/api-impl/motm/stand.ts:12). Seizoenkeuze, podium, ranglijst, wedstrijden, puntentelling. |
| Jeugddossiers | `/club/jeugddossiers`, `/club/jeugddossiers/speler/:id`; `portal.access` | [api-impl/jeugddossiers.ts](/Users/zag/Documents/ajax-pro-tools/api-impl/jeugddossiers.ts:17), [api/jeugddossiers.ts](/Users/zag/Documents/ajax-pro-tools/api/jeugddossiers.ts). Zoeken, uitgelichte spelers, dossier lezen. Geen bewerkinterface aangetroffen. Lokale nieuwe toevoeging; productieaanwezigheid niet vastgesteld. |
| Login / geen toegang / logout | `/api/auth/discord-login`, callback, `/geen-toegang`, `/api/auth/logout` | [lib/server-permissions.ts](/Users/zag/Documents/ajax-pro-tools/lib/server-permissions.ts), [lib/discord-auth.ts](/Users/zag/Documents/ajax-pro-tools/lib/discord-auth.ts), [geen-toegang.html](/Users/zag/Documents/ajax-pro-tools/geen-toegang.html). Ook essentieel voor hervatten van een taak. |

`/stem/:slug` is de openbare deel-ingang via `api-impl/motm/share.ts`, geen extra beheerscherm. `/api/motm/manage` is een API-alias. Publieke homepage, programma en contracten vallen buiten de login-audit. De spelersregistry is gedeelde data, geen aangetroffen zelfstandig spelersbeheerscherm. Permissions zoals `tools.lineup`, `admin.manage` en `jeugddossiers.manage` bewijzen op zichzelf geen gebouwde UI. Historische Media Watch-migraties zijn evenmin bewijs van een huidige tool; er is een verwijdermigratie en geen actuele route in de onderzochte routekaart.

### Gedeelde UI-bouwstenen en grenzen van hergebruik

| Bouwsteen | Bestaande implementatie | Wat werkelijk gedeeld is |
|---|---|---|
| Page shell | [lib/motm-view.ts](/Users/zag/Documents/ajax-pro-tools/lib/motm-view.ts:33): `page` | Document, Club-header, profiel, desktop- en mobielmenu, stylesheet en scripts, CSP. Ook Socials en Jeugddossiers gebruiken deze MOTM-genoemde module. |
| Pagina- en contextkop | `pageHeader`, `matchHeading` in hetzelfde bestand | Titel, eyebrow, teruglink, optionele headeractie; wedstrijdkop heeft daarnaast een eigen `h1`. Geen gedeelde taakstatus of opslagstatus. |
| Navigatie | `nav`, `subnav`; [portal-nav.js](/Users/zag/Documents/ajax-pro-tools/portal-nav.js:1) | Actieve hoofdsectie, MOTM-subnav, menu openen/sluiten/Escape/focusterugkeer. Geen algemeen contract voor terug naar zoekcontext of editor verlaten. |
| Toolcatalogus | [lib/portal-tools.config.ts](/Users/zag/Documents/ajax-pro-tools/lib/portal-tools.config.ts:18) | Link, titel, beschrijving, rechten, volgorde, extern. Zowel section-renderer als platte grid-renderer aanwezig; huidige toolpagina gebruikt de platte grid. |
| Visuele basis | [motm.css](/Users/zag/Documents/ajax-pro-tools/motm.css:1) | Dark kleuren, tekst, focus, spacing/radius-tokens, `.button`, `.secondary`, `.danger`, `.status`, `.empty`, `.page-heading`, forms, lijsten en panels. Later in hetzelfde bestand staan meerdere verfijningslagen. |
| Toolspecifieke werkruimte | `management-section`, `form-grid`, `admin fieldset`; [socials.css](/Users/zag/Documents/ajax-pro-tools/socials.css:1) | Beheer gebruikt losse serverforms; Socials controls + preview. Gedeelde kleuren betekenen nog geen gedeeld gedrag. |
| Social-formatcontract | [lib/socials.ts](/Users/zag/Documents/ajax-pro-tools/lib/socials.ts:1), `socials/main.mjs`, drie formatmodules | Drie vaste formats, twee uitvoerformaten, vier thema’s; actieve workspace en gedeeld thema. Formatvelden blijven gescheiden. |
| Data en domeinstatus | [lib/player-registry.ts](/Users/zag/Documents/ajax-pro-tools/lib/player-registry.ts), [lib/socials-match-context.ts](/Users/zag/Documents/ajax-pro-tools/lib/socials-match-context.ts:15), [lib/motm-rules.ts](/Users/zag/Documents/ajax-pro-tools/lib/motm-rules.ts:9), `motm-scheduling.ts` | Centrale spelers, recente/volgende wedstrijd, MOTM-statusovergangen en tijden. Geen gedeelde gebruikersinteractie voor contextwissels. |
| Fouten en feedback | `errorPage`; lokale live-error, quote-photo-error, vote-receipt | Wel losse bouwstenen, geen uniforme omvang, plaatsing, herstelactie of opslagbevestiging. |
| Preview/export | MOTM canvas in `motm-admin.js`; Socials HTML-wireframes | Verschillende volwassenheid: MOTM kan PNG maken; Socials-download is bewust uitgeschakeld. |

## 2. Findings per tool

### A. MOTM-beheer

**Primaire taak:** als staf een betrouwbare stemming voorbereiden, op het juiste moment beschikbaar maken, volgen en de uitkomst delen. Incidenteel gegevens corrigeren of een stemming verwijderen.

**Huidige hoofdflow:** Tools → beheerlijst → nieuwe stemming → vier gelijktijdig zichtbare formuliersecties → concept/direct openen → detailpagina → delen/Discord/monitoren of verder corrigeren. Detailpagina’s zijn eigen URLs; de genummerde secties zijn geen wizard.

**Belasting en hiërarchie:** aanmaken toont 10 wedstrijdcontrols (inclusief datum/tijd apart, seizoen, meetellen, uitsluitreden en twee scores), 4 planningscontrols, alle spelers als aangevinkte keuzes en 2 afrondacties. Het spelersaantal is data-afhankelijk. Detailbeheer zet achtereenvolgens stemlink, Discord-mededeling, live stemmen, wedstrijdformulier, planning, spelers, eventueel verwijderen en log onder elkaar. Spelercorrecties zijn terecht ingeklapt. Er zijn meerdere primaire knoppen binnen één document en geen centrale aanduiding welk werk nog niet is opgeslagen.

| ID / prioriteit | Concreet probleem en bewijs | Gevolg voor de taak |
|---|---|---|
| M01 — **P0** | `motm-admin.js:11` haalt bij ieder aanwezig `opponent`-veld de volgende wedstrijd op en zet tegenstander, competitie, aftrap en thuis/uit zonder leegte- of wijzigingscheck. Hetzelfde script wordt geladen in `detail` (`manage.ts:74`), waar deze velden al bestaande data bevatten. | Een bestaande stemming kan na laden andere invoer tonen dan haar kop en opgeslagen gegevens. Een latere gewone opslag kan die verkeerde context vastleggen. Dit is codevastgesteld; er is geen productiecorruptie geclaimd. Ook snelle handmatige invoer bij aanmaken kan door de asynchrone respons worden overschreven. |
| M02 — **P0** | “Opslaan als concept” krijgt dezelfde planningvelden als “Direct openen” (`manage.ts:82`). `createMatch:150` bewaart openings-/sluitingstijden ook voor `draft`; `statusAt` opent zo’n draft zodra de tijd bereikt is. De lijst noemt hem Gepland, `statusLabel` op detail noemt hem Concept. | Een veilige tussenstap klinkt alsof publicatie nog niet is ingesteld, terwijl automatisch openen al is voorbereid. Voorbereidingsstatus en publicatie-intentie zijn onvoldoende onderscheiden. |
| M03 — **P0** | Discord-confirmatie staat in inline `onsubmit` (`manage.ts:69`), maar de gedeelde CSP staat alleen `script-src 'self'` toe (`motm-view.ts:33`), zonder inline-eventtoestemming. Direct sluiten heeft geen bevestiging, terwijl heropenen verboden is (`manage.ts:58,60,122`). Verwijderreden en bevestiging zijn al ingevulde hidden inputs (`manage.ts:70`). | De bedoelde extra afweging vóór een `@everyone`-bericht werkt onder deze CSP niet. Sluiten is één klik met onomkeerbare status; bij verwijderen vraagt de UI niet werkelijk om de bevestiging die de server valideert. Verwijderen zelf is wel herstelbaar. |
| M04 — **P1** | `detail` zet delen, mededeling en stemverloop vóór de correctie- en planningstaak, ongeacht draft/open/closed (`manage.ts:68–74`). Dubbele `h1` via `pageHeader` en `matchHeading`. Nummers 1–5 beschrijven rubrieken; nummer 4 ontbreekt zonder verwijderrecht. | De gebruiker moet eerst bepalen welk deel van deze lange pagina bij de actuele taak hoort. Voor een concept domineert distributie; voor een gesloten stemming blijft “Stemlink delen” de hoofdframing, met resultaatvisual erbinnen. Visuele koppen versterken een onduidelijke producthiërarchie. |
| M05 — **P1** | Iedere sectie/speler heeft een eigen POST-formulier en dezelfde revision. Succes redirect terug naar detail; geen expliciete save-receipt of terugkeer naar de betreffende sectie (`manage.ts:57–64,125–141`). Validatie/conflict vervangt de pagina via `errorPage`. | Twee secties aanpassen en er één opslaan verstuurt alleen die ene sectie; overige edits worden niet meegenomen. Er is geen dirty-statewaarschuwing of herstelcontract. De log onderaan vervangt geen directe opslagfeedback. Browser-terug kan soms helpen, maar is geen gegarandeerd herstel. |
| M06 — **P1** | Sluiting later dan aftrap +3 uur wordt bij aanmaken vooraf stil teruggezet (`manage.ts:148–150`). Defaultplanning wordt client-side alleen gezet als datumvelden leeg zijn (`motm-admin.js:6`). Opslaan van een verstreken sluiting kan direct sluiten (`manage.ts:131`). | Getoonde keuze, opgeslagen planning en statusgevolg kunnen uiteenlopen zonder expliciete toelichting vóór de actie. Tijdinvoer mist een eenduidige relatie tussen afgeleide waarde en handmatige override. |
| M07 — **P1** | Lijst haalt maximaal 100 records op en verdeelt die daarna over statusgroepen (`manage.ts:85–88`), zonder totaal/paginering/limietmelding. Alle lege groepen zeggen “Geen stemmingen”, ook bij zoeken. Teruglink van detail bevat geen zoekterm. | “Niet in deze selectie” lijkt op “bestaat niet”; overzicht en zoekcontext zijn niet betrouwbaar te interpreteren. Dit risico groeit met het archief. |
| M08 — **P1** | Generieke fouten noemen migratie 004 of webhookconfiguratie (`manage.ts:90,118,144`). Veel beheerfouten roepen `errorPage` zonder gebruiker, actieve toolssectie of concrete terugroute aan; defaults zijn MOTM ledenoverzicht (`motm-view.ts:34`). | Een beheerfout kan voelen als verlies van login/context en stuurt naar een andere taak. De herstelopdracht vraagt infrastructuurkennis van redactiestaf. |
| M09 — **P2** | Kopieeractie heeft alleen succeslabel, geen catch of statusregio (`motm-admin.js:12`). Live-paneel heeft juist handmatig verversen, laatste update en inline fout (`:18–27`). | Feedbackkwaliteit wisselt binnen één tool. Bij clipboardfalen ontbreekt uitleg; succes is minder toegankelijk dan de stem-receipt elders. |

**Wat behouden moet blijven:** statusgroepering in de lijst, centrale tijdconversie, revisiecontrole en auditlog, servermatige rechten, blokkade op verwijderen van spelers met stemmen, ingeklapte spelercorrecties, live-verversing met foutfeedback en echte canvas-downloadstatus. Het probleem is hoe deze garanties worden gecommuniceerd en samengebracht, niet hun aanwezigheid.

### B. Social Creator / Socials

**Primaire taak:** een vast AjaxPro-socialformat invullen en inhoudelijk controleren. De huidige productscope stopt bewust bij een wireframe; een publiceerbaar bestand maken is nog niet beschikbaar.

**Huidige flow:** Tools → Socials → Stats (of Quote zonder wedstrijdcontext) → format/uitvoer/thema → wedstrijd en eventueel speler → invoer → live preview. Er is geen afronding, opslaan of exportactie die de taak definitief afsluit. Formats wisselen in-place; URL en browsergeschiedenis onderscheiden die states niet.

**Belasting en hiërarchie:** drie formatopties, twee uitvoeropties en vier themaopties staan boven de inhoud, als drie aparte keuzegroepen. Stats heeft 6 statistieken × 2 teams = 12 velden; Spelerstats 8 velden plus speler- en eventuele wedstrijdselectie; Quote 3 tekstvelden en optionele foto. Dit zijn geen negen gelijkwaardige opties in één keuze. De opeenstapeling van instellingen vóór invoer is de belasting. Desktop heeft vanaf 920px een sticky preview naast de controls; daaronder volgt de preview na de controls. Er is geen previewmodal of vrije editor.

| ID / prioriteit | Concreet probleem en bewijs | Gevolg voor de taak |
|---|---|---|
| S01 — **P0** | In [stats.mjs](/Users/zag/Documents/ajax-pro-tools/socials/formats/stats.mjs:26) en [player-stats.mjs](/Users/zag/Documents/ajax-pro-tools/socials/formats/player-stats.mjs:15) veranderen selecties alleen de context en render; de bestaande inputwaarden blijven staan. | Vul wedstrijd A / speler A in en kies B: dezelfde cijfers verschijnen onder een nieuwe identiteit. De preview lijkt geldig. Er is geen zichtbare beslissing over meenemen, resetten of gescheiden concepten. Export is nu geblokkeerd, maar de inhoudelijke controle is al onbetrouwbaar. |
| S02 — **P1** | Waarden leven in DOM/modulegeheugen. Geen `localStorage`, `sessionStorage` of herstelpad; de `beforeunload` in Quote ruimt alleen de foto-URL op. Resetknoppen wissen direct. [quote.mjs](/Users/zag/Documents/ajax-pro-tools/socials/formats/quote.mjs:18), `stats.mjs`, `player-stats.mjs`. | Formatwisselen bewaart werk binnen de pagina, verlaten/herladen heeft geen gegarandeerde bewaring. Die grens staat niet uitgelegd. “Blijft op dit apparaat” bij de foto kan als opslagbelofte worden gelezen. Wisacties hebben geen undo of tweede afweging. Dit vereist niet automatisch backendopslag. |
| S03 — **P1** | Alle previews hebben “Download PNG · template volgt” disabled; de introductie zegt alleen invullen en controleren (`socials/index.ts:33,41,44,54`). Registry noemt formats beschikbaar. | De tool is bruikbaar als voorbereiding, maar de eindgrens wordt pas in de preview concreet. Een redacteur met de taak “social maken” kan tijd investeren vóór duidelijk is dat er geen overdraagbaar eindresultaat is. Ontbrekende templates zijn expliciete scope, geen reden om ze in deze stap te ontwerpen. |
| S04 — **P1** | Invoer krijgt `aria-invalid` en een rode rand; de preview vervangt ongeldige waarden door hetzelfde “—” als lege velden. Geen fouttekst met bereik/reden bij statistieken. Fototype en bestandsgrootte hebben wel concrete inline fouttekst (`quote.mjs:43–48`). | Het is onduidelijk of data ontbreekt of is afgekeurd. De gebruiker kan een foutieve waarde niet gericht herstellen vanuit de preview. Formatvalidatie is productmatig niet gelijkwaardig. |
| S05 — **P1** | Format-, uitvoer- en themakeuzes blijven boven iedere workspace; op mobiel komt de preview ná alle invoer (`socials/index.ts:52–69`, `socials.css`, `.socials-workspace`). | De eerste inhoudelijke handeling zit na algemene keuzes. Tijdens mobiel controleren moeten gebruiker en aandacht tussen invoer en verderop gelegen preview bewegen. Dit volgt uit DOM/CSS; exacte scrollafstand is niet gemeten. |
| S06 — **P1** | Zonder fixtures zijn Stats/Spelerstats disabled; uitgebreidere unavailable-secties blijven `hidden`. Op mobiel verbergt `.socials-format small` ook de blokkeerreden. Fixturefouten worden opgevangen, maar `playerLoader()` niet; de spelerpreview gebruikt onvoorwaardelijk `players[0].imageUrl` (`socials/index.ts:15–20,28,37–49`). | Mobiel is niet duidelijk waarom een format niet kiesbaar is. Bij een fout in spelersdata kan ook de onafhankelijke Quote-flow uitvallen; bij een lege spelerslijst met fixtures is er een renderfoutpad. Er ontbreekt een consistente afbakening van gedeeltelijke beschikbaarheid. |
| S07 — **P1** | Stats en Spelerstats hebben aparte wedstrijdselecties; thema en uitvoer zijn wél gedeeld. Loader haalt alleen laatste verstreken en eerste komende wedstrijd op ([socials-match-context.ts](/Users/zag/Documents/ajax-pro-tools/lib/socials-match-context.ts:15)). | Wisselen van format kan een andere wedstrijd tonen dan verwacht. “Recente en aankomende wedstrijden” beschrijft de feitelijke beperkte selectie niet precies; geen onderscheid tussen niet-selecteerbaar en niet-bestaand. |
| S08 — **P2** | Preview toont technische themasleutels zoals `home` naast “Thuis”; de keuze verandert dataset/label, zonder uitgewerkte templatekleuren. Foto-input heeft een losse `span` als titel, geen gekoppeld label (`socials/index.ts:44`). | Implementatietaal voegt ruis toe; de bestandskiezer mist een productspecifieke toegankelijke naam. Wireframe-esthetiek op zichzelf is conform de bestaande scope. |

**Wat behouden moet blijven:** drie vaste formats, onafhankelijke modules, één actieve workspace, centrale thema-/uitvoerkeuzes, read-only wedstrijddata, live inhoudsfeedback, native inputs met min/max en zichtbare focus, lokale fotobewerking en expliciete exportblokkade. Geen vrije editor nodig om de genoemde problemen op te lossen.

### C. Overige Club-interfaces

| ID / prioriteit | Tool, taak en flow | Bevinding en bewijs |
|---|---|---|
| C01 — **P1** | Club-home en Tools: juiste tool vinden → openen. Home benadrukt stemmen/uitslag; Tools toont rechtenafhankelijke kaarten. | Home-intro noemt tools zonder directe toolactie in de body (`api/club.ts`). Tools vlakt team/admin-categorieën af via `renderToolsGrid`, hoewel het register ze kent. De hoofdnav plaatst MOTM-consumptie en Tools naast elkaar; MOTM-beheer valt onder Tools. Die rolgrens is verdedigbaar, maar taakoriëntatie leunt op voorkennis. Geen nieuwe dashboardmodules nodig; eerst de navigatiebetekenis vaststellen. |
| C02 — **P1** | Stemmen: wedstrijd → speler kiezen → bevestigen → “Stem opgeslagen”; daarna wijzigen mogelijk. | De inline stemconfirmatie botst eveneens met CSP (`vote.ts:32`, `motm-view.ts:33`). Positief voorbeeld: expliciete receipt met `role=status` en sticky primaire actie. Het ledenoverzicht bouwt de titel altijd als “Ajax — tegenstander”, ook voor uitwedstrijden (`index.ts:10`), terwijl detail en beheer `matchTitle` gebruiken. Contextnaam is dus niet overal dezelfde. |
| C03 — **P1** | Jeugddossiers: uitgelicht/zoeken → dossier → bronnen. | Teruglink naar `/club/jeugddossiers` bewaart zoekterm niet (`jeugddossiers.ts:39`). De standaardlijst toont alleen featured, terwijl zoeken de brede dataset doorloopt; de kop “Uitgelichte spelers” maakt dat goed zichtbaar. Dossier toont 8 feiten vóór redactionele context en bronnen; passend voor naslag, maar feitversheid staat pas onderaan. `last_checked_at` gebruikt generieke stringweergave in plaats van gedeelde datumformattering. |
| C04 — **P2** | Seizoenstand: seizoen kiezen → ranglijst begrijpen → wedstrijduitslag. | Uitleg is terecht optioneel in `details`, maar “1 / 2 / 3” vraagt interpretatie; ranglijst is een div-grid zonder tabelsemantiek (`stand.ts:25`). Podium, volledige ranglijst en laatste ronde herhalen deels dezelfde informatie. Geen vastgestelde taakblokkade; wel scan- en toegankelijkheidspolish. |
| C05 — **P1** | Mobiele navigatie: menu openen → bestemming kiezen → verder werken. | `portal-nav.js` zet focus op sluiten en ondersteunt Escape; er is geen focusbegrenzing of `inert` voor achterliggende inhoud. Shell gebruikt een `aside`, geen dialog-contract. Toetsenbordgebruikers kunnen volgens de implementatie buiten de geopende menulaag terechtkomen. Werkelijk focuspad nog in browser bevestigen. |

Voor Tactiekbord en Screenshot Editor is alleen de expliciete “Open extern ↗”-overgang bevestigd. Beweren dat hun forms, modals, savegedrag of visuals inconsistent zijn zou zonder broncode of sessie speculatief zijn.

## 3. Cross-tool inconsistencies

| Patroon / gebruikersvraag | Huidige verschillende oplossingen | Gerelateerde bevindingen |
|---|---|---|
| Wat bewerk ik? | MOTM-kop en auto-ingevulde velden kunnen verschillen; Socials verandert context zonder cijfers te scheiden; ledenlijst gebruikt afwijkende wedstrijdtitel. | M01, S01, S07, C02 |
| Wanneer is mijn werk bewaard? | MOTM sectie-POST + redirect; ledenstem expliciete receipt; Socials tijdelijk DOM-geheugen; reset wist direct. | M05, S02, C02 |
| Wat is mijn volgende stap? | MOTM genummerde rubrieken én distributie bovenaan; Socials instellingen + input + preview zonder afronding; lezen heeft gewone detailroutes. | M02, M04, S03, S05 |
| Wat is primair of risicovol? | Stemmen sticky bevestigingsactie; beheer meerdere `.button`-acties; verwijderen `.secondary`, sluiten `.danger`; Socials wissen brede `.secondary` onder invoer. | M03, M04, S02 |
| Hoe bevestig ik impact? | Inline browserconfirmatie, hidden bevestigingsvelden, directe statusmutaties, direct lokaal wissen. Geen operationeel gedeeld contract. | M03, S02, C02 |
| Hoe herstel ik een fout? | Globale errorPage met soms verkeerde context; Socials kleur/“—”; Quote specifieke inline fout; live stemmen retry en timestamp. | M08, M09, S04, S06 |
| Waar ben ik na teruggaan? | Beheer/Jeugddossier vaste bovenliggende link zonder zoekstate; Socials formats zonder URL-state; externe tools nieuw tabblad. | M07, S07, C01, C03 |
| Wat betekent preview? | MOTM definitief canvas met laadstatus en echte download; Socials HTML-wireframe met toekomstige export; deels identieke downloadtaal. | M04, S03, S08 |
| Wat betekent leeg/niet beschikbaar? | MOTM lege statusgroepen en afgekapt archief; Socials disabled format; Jeugddossiers maakt zoeken/featured expliciet; lokale datafout kan grotere tool blokkeren. | M07, S06, C03 |
| Waarom krijgt iets een panel? | MOTM gebruikt hetzelfde section-panel voor communicatie, formulier en log; Socials selectorkaarten, inputpanels en uitgeklede preview; mobiel verdwijnen veel panelgrenzen. | M04, S05 |

Consistentie betekent hier dezelfde betekenis en voorspelbaar gedrag, niet overal hetzelfde scherm. Een stemformulier, naslagpagina en grafische preview hebben terecht verschillende taakstructuren.

## 4. Root causes

| Oorzaak | Aard | Onderbouwing en betekenis |
|---|---|---|
| Geen expliciet contextcontract | Structureel/productmatig | Match/player-id, ingevulde waarden, afgeleide data en handmatige overrides hebben geen gezamenlijke gebruikersregel. M01 en S01 lijken verschillende bugs, maar breken dezelfde belofte: data hoort bij de getoonde context. |
| Domeinstatus is direct UI-taal geworden | Structureel/productmatig | `draft` kan gepland zijn; een formulieropslaan kan sluiten; Socials “available” betekent invulbaar maar niet exporteerbaar. De gebruiker moet implementatiestates vertalen naar publicatiegevolgen. |
| Pagina’s groeperen functionaliteit zonder taakprioriteit per status | Structureel/productmatig | Detailbeheer stapelt serveracties; Socials stapelt instellingen vóór de werkruimte. Bestaande functionaliteit is aanwezig, maar dagelijkse taak, correctie en uitzondering krijgen onvoldoende verschillende plaats. |
| State en feedback zijn lokaal per handler gemaakt | Structureel/interactie | POST/redirect, DOM-state, receipts, clipboardlabels en errors hebben elk hun eigen levensduur. Geen gedeelde afspraken over bewaren, dirty state, focus na actie of hervatten. |
| Visuele intentie is geen gedragsgarantie | Structureel met technische oorzaak | Een confirm-attribuut oogt in broncode veilig maar werkt niet onder CSP. Een hidden confirmation biedt geen menselijke afweging. Een dangerkleur vervangt geen uitleg van onomkeerbaarheid. |
| Tokens delen vooral uiterlijk | Visueel én organisatorisch | `motm.css` biedt bruikbare tokens, maar ook opeenvolgende overrides; Socials heeft eigen panel- en veldregels. Dit maakt lokale polish mogelijk zonder action hierarchy of workspacecontract vast te leggen. Geen aanleiding voor een complete componentlibrary. |
| Merkambitie en werktaak zijn nog niet scherp gescheiden | Productmatig met visuele gevolgen | Premium dark en sportmedia zijn aanwezig in richting en styling. De werkinterfaces worden echter vooral bepaald door forms/panels; meer editorial expressie mag de ontbrekende taakhelderheid niet maskeren. |

**Visueel:** kopcompetitie, veel soortgelijke panelgrenzen, wisselende knopaccenten, technische previewlabels en CSS-drift. **Structureel:** contextintegriteit, concept/publicatie, opslaggrenzen, statusafhankelijke hoofdtaak, foutisolatie en terugkeer. Motion kan statusverandering ondersteunen; animatie lost geen van de P0-bevindingen op. Contrast, exacte spacing en animatiekwaliteit vragen later een visuele verificatiepass en zijn hier geen gemeten tekortkomingen.

## 5. Priority

P0 = fundamenteel UX-probleem; P1 = duidelijke kwaliteitswinst; P2 = polish. In totaal **22 gegroepeerde bevindingen: 4 P0, 15 P1, 3 P2**.

| Prioriteit | Bevindingen | Waarom deze volgorde |
|---|---|---|
| **P0** | M01 bestaande wedstrijdcontext; M02 concept versus planning; M03 impactvolle bevestiging; S01 contextwissel met cijfers | Betrouwbaarheid van identiteit, publicatie-intentie en menselijke controle moet vóór een gedeelde UI-laag vaststaan. |
| **P1 — eerst** | M05, M06, M08, S02, S04, S06 | Bewaren, tijdgevolgen, fout-/sessieherstel en gedeeltelijke beschikbaarheid bepalen of de taak veilig kan worden afgerond. |
| **P1 — daarna** | M04, M07, S03, S05, S07, C01, C02, C03, C05 | Werkruimte, oriëntatie, eindverwachting en toegankelijk navigeren verbeteren gebruikskwaliteit; ze bouwen voort op de gedragsafspraken. |
| **P2** | M09, S08, C04 | Microfeedback, terminologie en naslagsemantiek verfijnen zodra de basis duidelijk is. |

P0 betekent hier niet dat alle tools onbruikbaar zijn. Socials heeft bijvoorbeeld nu geen actieve export waarmee verkeerde cijfers automatisch gepubliceerd worden. Het contextprobleem blijft fundamenteel voor de betrouwbaarheid van de preview.

## 6. Product UI opportunities

Deze tien patronen moeten worden **gedefinieerd**, nog niet ontworpen of gebouwd. Elk patroon beschrijft de ontbrekende afspraak, bestaande aanknopingspunten en noodzakelijke varianten; geen voorschrift voor een library, nieuwe route of wizard.

| Gedeeld patroon | Wat moet worden vastgelegd en waarom | Bestaande basis / dekking |
|---|---|---|
| **1. Page shell en toolnavigatie** | Betekenis van Club, ledeninhoud, Tools en beheer; actieve locatie, interne/externe overgang, terugkeer met zoekcontext en hervatten na login. | `page`, `nav`, `subnav`, toolregister. C01, C03, C05, M07–M08. |
| **2. Tool header en objectcontext** | Eén hoofdtitel; herkenbare tool versus wedstrijd/speler; actuele status en broncontext. Afgeleide data mag bestaande invoer niet stil vervangen. | `pageHeader`, `matchHeading`, match/playerselecties. M01, M04, S01, S07, C02. |
| **3. Primary workspace** | Wat de dominante werktaak is per scherm/status; wat ondersteuning, monitoring, correctie of geschiedenis is. Relatie invoer/preview op mobiel en desktop. | `management-section`, `socials-workspace`, ingeklapte player-editor. M04, S05. |
| **4. Taakfasen en lifecycle** | Concept, gepland, open, gesloten, verwijderd; in Socials leeg/ingevuld/gecontroleerd en exportbeschikbaarheid. Definieer gevolg en volgende stap, zonder automatisch iedere taak in een wizard te stoppen. | `statusAt`, `statusLabel`, format availability. M02, M06, S03. |
| **5. Action hierarchy** | Eén herkenbare hoofdactie per taakcontext; plaats en nadruk van secundaire acties, sectie-opslag en onomkeerbare acties; beschikbaarheid tijdens verwerken. | `.button`, `.secondary`, `.danger`, sticky vote action. M03–M05, S02. |
| **6. Formulier, defaults en validatie** | Verplicht/optioneel, bronwaarde versus override, datum/tijd en tijdzone, veldfout met reden, focus/herstel na validatie. Afspreken wat een contextwissel met afhankelijke waarden doet. | `dateTimeFields`, native inputs, statsregistries, quote-photo-error. M01, M06, S01, S04. |
| **7. Bewaren en hervatten** | Levensduur van werk: tijdelijk in pagina, lokaal bewaard of serveropslag; sectie versus gehele taak; dirty state, refresh/verlaten en conflictgedrag. Geen automatische keuze voor database of autosave. | MOTM revision/POST, Social-formatmodules, vote-receipt. M05, S02. |
| **8. Preview en output** | Verschil tussen wireframe, inhoudelijk geldig, definitieve render en exporteerbaar; context, laden, assetfout en beperking zichtbaar. Duidelijk eindpunt van de huidige taak. | Socials previews, MOTM canvas/status/download. S03–S04, S08, M04. |
| **9. Statusfeedback en herstelstates** | Succes, laden, leeg, geen zoekresultaat, gedeeltelijk beschikbaar, verouderde gegevens, fout en sessieverloop; juiste scope, tekst, retry en toegankelijke aankondiging. | `errorPage`, live-votes, quote-photo-error, receipts. M07–M09, S06, C03. |
| **10. Bevestigen, wissen en herstellen** | Risicoafhankelijke menselijke bevestiging; object, gevolg en herstelbaarheid vóór actie. Onderscheid lokaal wissen, stem wijzigen, stemming sluiten, soft delete en extern bericht. Inclusief toetsenbord-/focusgedrag van eventuele dialogen. | Bestaande serverguards, restore-intent, resetacties; inline confirm is geen bruikbaar gedeeld fundament. M03, S02, C02, C05. |

### Beslisgrenzen voor de volgende productstap

De eerstvolgende stap is een compact gedragscontract voor deze patronen met de bevinding-ID’s als acceptatiebasis. Daarvoor moet worden besloten wat “concept” belooft, wat bij contextwisselen met invoer gebeurt, welke bewaargrens Socials communiceert en welke acties een extra afweging nodig hebben. De repository hoeft daarvoor niet opnieuw breed onderzocht te worden; bovenstaande route-/bestandskaart wijst de implementatieplaatsen aan.

Niet nodig in deze fase: vrije social-editor, nieuwe componentlibrary, herbouw van de Club-shell, backendopslag voor alle drafts of meer motion. Externe-toolgedrag en live responsive/focuscontrole blijven expliciete verificatiepunten vóór een latere implementatie wordt geaccepteerd.

**Contextnotitie:** `PRODUCT.md` beschrijft de bruikbare bestaande richting, maar gebruikt een legacy Impeccable-schema en een verouderde `Register`-sectie; `DESIGN.md` ontbreekt. Dit is documentatiedrift, geen reden om de bestaande visuele identiteit te vervangen. Eventuele actualisatie via Impeccable `init` is een afzonderlijke opdracht; hier is niets daarvan aangepast.
