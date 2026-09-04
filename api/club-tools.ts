import { redirect } from "../lib/discord-auth";
import { permissions } from "../lib/permissions.config";
import { getSessionWithPermission } from "../lib/server-permissions";
import { errorPage, page, pageHeader } from "../lib/motm-view";
import { renderToolsGrid, toolsForSession } from "../lib/portal-tools.config";
import { renderSocials } from "../api-impl/socials/index";
import { GET as getMediaWatch, POST as postMediaWatch } from "../api-impl/media-watch/index";

export async function GET(request:Request){
  const view=new URL(request.url).searchParams.get("view");
  const returnTo=view==="socials"?"/club/tools/socials":view==="media-watch"?"/club/tools/media-watch":"/club/tools";
  const session=await getSessionWithPermission(request,permissions.portalAccess);
  if(!session)return redirect(`/api/auth/discord-login?returnTo=${returnTo}`);
  if(view==="socials"){
    const allowed=await getSessionWithPermission(request,permissions.toolsSocials);
    if(!allowed)return errorPage("Geen toegang","Voor jouw Club-account is Socials niet beschikbaar.",403,session,"/club/tools","tools");
    return renderSocials(allowed);
  }
  if(view==="media-watch"){
    return getMediaWatch(request);
  }
  const tools=toolsForSession(session);
  if(!tools.length)return errorPage("Geen toegang","Voor jouw Club-account zijn geen interne tools beschikbaar.",403,session,"/club","home");
  return page("Tools",`<main class="motm-main">${pageHeader("Tools","Intern")}<p class="page-intro">Hulpmiddelen die bij jouw rechten horen.</p>${renderToolsGrid(tools)}</main>`,"",session,"tools");
}

export async function POST(request:Request){
  const view=new URL(request.url).searchParams.get("view");
  if(view==="media-watch")return postMediaWatch(request);
  return new Response("Method not allowed",{status:405,headers:{Allow:"GET"}});
}
