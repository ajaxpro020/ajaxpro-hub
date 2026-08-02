import { redirect } from "../lib/discord-auth";
import { permissions } from "../lib/permissions.config";
import { getSessionWithPermission } from "../lib/server-permissions";
import { errorPage, page, pageHeader } from "../lib/motm-view";
import { renderToolsGrid, toolsForSession } from "../lib/portal-tools.config";

export async function GET(request:Request){const session=await getSessionWithPermission(request,permissions.portalAccess);if(!session)return redirect("/api/auth/discord-login?returnTo=/club/tools");const tools=toolsForSession(session);if(!tools.length)return errorPage("Geen toegang","Voor jouw Club-account zijn geen interne tools beschikbaar.",403,session,"/club","home");return page("Tools",`<main class="motm-main">${pageHeader("Tools","AjaxPro Club")}<p class="page-intro">Interne hulpmiddelen die bij jouw rechten horen.</p>${renderToolsGrid(tools)}</main>`,"",session,"tools")}
