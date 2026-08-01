import { redirect } from "../lib/discord-auth";
import { permissions } from "../lib/permissions.config";
import { getSessionWithPermission } from "../lib/server-permissions";
import { page, pageHeader } from "../lib/motm-view";
import { renderToolSections, toolsForSession } from "../lib/portal-tools.config";

export async function GET(request:Request){const session=await getSessionWithPermission(request,permissions.portalAccess);if(!session)return redirect("/api/auth/discord-login?returnTo=/club/tools");return page("Tools",`<main class="motm-main">${pageHeader("Tools","AjaxPro Club")}${renderToolSections(toolsForSession(session))}</main>`,"",session,"tools")}
