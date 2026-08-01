import { redirect } from "../lib/discord-auth";
import { permissions } from "../lib/permissions.config";
import { getSessionWithPermission } from "../lib/server-permissions";
import { page, pageHeader } from "../lib/motm-view";

const tools=[
  {title:"Opstellingmaker",description:"Maak en deel jouw Ajax-opstelling.",href:"https://opstelling.ajaxpro.fans",external:true},
  {title:"Contractenoverzicht",description:"Bekijk de actuele selectie en contractduur.",href:"/contracten.html",external:false},
];
export async function GET(request:Request){const session=await getSessionWithPermission(request,permissions.portalAccess);if(!session)return redirect("/api/auth/discord-login?returnTo=/club/tools");const rows=tools.map(tool=>`<a class="tool-row" href="${tool.href}"${tool.external?' target="_blank" rel="noreferrer"':""}><span><strong>${tool.title}</strong><small>${tool.description}</small></span><b>Open ${tool.external?"↗":"→"}</b></a>`).join("");return page("Tools",`<main class="motm-main">${pageHeader("Tools","AjaxPro Club")}<section class="tool-list" aria-label="Beschikbare tools">${rows}</section></main>`,"",session,"tools")}
