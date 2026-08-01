import type { Session } from "./discord-auth";
import { esc } from "./motm-view";
import { permissions, type Permission } from "./permissions.config";
import { sessionHasPermission } from "./server-permissions";

export type ToolSection = "team" | "admin";
export type PortalTool = {
  id: string;
  title: string;
  description: string;
  href: string;
  section: ToolSection;
  external: boolean;
  requiredPermission?: Permission;
  status?: string;
  order: number;
};

export const portalTools: readonly PortalTool[] = [
  {id:"tactics",title:"Tactiekbord",description:"Werk wedstrijdideeën uit op het digitale tactiekbord.",href:"https://ajaxpro-tactics-board.vercel.app",section:"team",external:true,requiredPermission:permissions.toolsTactics,order:10},
  {id:"screenshot",title:"Screenshot Editor",description:"Maak screenshots klaar voor AjaxPro-publicaties.",href:"https://screenshot-bewerker.vercel.app",section:"team",external:true,requiredPermission:permissions.toolsScreenshot,order:20},
  {id:"motm-admin",title:"MOTM-stemmingen beheren",description:"Plan, open en beheer Man of the Match-stemmingen.",href:"/club/motm/beheer",section:"admin",external:false,requiredPermission:permissions.motmManage,order:10},
];

const sectionOrder:Record<ToolSection,number>={team:0,admin:1};
export const toolsForSession = (session: Session) => portalTools.filter(tool => !tool.requiredPermission || sessionHasPermission(session,tool.requiredPermission)).sort((a,b)=>sectionOrder[a.section]-sectionOrder[b.section]||a.order-b.order);
export const teamToolsForSession = (session: Session) => toolsForSession(session).filter(tool => tool.section === "team");
export const adminToolsForSession = (session: Session) => toolsForSession(session).filter(tool => tool.section === "admin");
export const sectionTitles: Record<ToolSection,string>={team:"Teamtools",admin:"Beheer"};
export const renderToolSections = (tools: readonly PortalTool[]) => (["team","admin"] as const).map(section=>{
  const items=tools.filter(tool=>tool.section===section);if(!items.length)return "";
  const rows=items.map(tool=>`<a class="tool-card tool-card--${esc(tool.id)}" href="${esc(tool.href)}"${tool.external?' target="_blank" rel="noreferrer"':""}><span class="tool-card__icon" aria-hidden="true"></span><span class="tool-card__copy"><strong>${esc(tool.title)}</strong><small>${esc(tool.description)}</small>${tool.status?`<em>${esc(tool.status)}</em>`:""}</span><b>${tool.external?"Open extern ↗":"Open →"}</b></a>`).join("");
  return `<section class="tool-section tool-section--${section}"><div class="section-heading"><div><p class="eyebrow">${section==="team"?"Voor de redactie":"Voor staf"}</p><h2>${sectionTitles[section]}</h2></div></div><div class="tool-grid">${rows}</div></section>`;
}).join("");
