import { redirect } from "../lib/discord-auth";
import { permissions } from "../lib/permissions.config";
import { getSessionWithPermission } from "../lib/server-permissions";
import { errorPage, page, pageHeader } from "../lib/motm-view";
import { renderToolSections, teamToolsForSession } from "../lib/portal-tools.config";

export async function GET(request:Request){const session=await getSessionWithPermission(request,permissions.portalAccess);if(!session)return redirect("/api/auth/discord-login?returnTo=/club/tools");const tools=teamToolsForSession(session);if(!tools.length)return errorPage("Geen toegang","Teamtools zijn alleen beschikbaar voor leden met een redactierol.",403,session,"/club","home");return page("Teamtools",`<main class="motm-main">${pageHeader("Teamtools","AjaxPro Club")}<p class="page-intro">Interne hulpmiddelen voor analyses en AjaxPro-publicaties.</p>${renderToolSections(tools)}</main>`,"",session,"tools")}
