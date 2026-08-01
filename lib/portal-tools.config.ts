import type { Session } from "./discord-auth";
import { esc } from "./motm-view";
import { permissions, type Permission } from "./permissions.config";
import { sessionHasPermission } from "./server-permissions";

export type ToolSection = "general" | "team" | "admin";
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
  {id:"lineup",title:"Opstellingmaker",description:"Maak en deel jouw Ajax-opstelling.",href:"https://opstelling.ajaxpro.fans",section:"general",external:true,order:10},
  {id:"contracts",title:"Contractenoverzicht",description:"Bekijk de actuele selectie en contractduur.",href:"/contracten.html",section:"general",external:false,order:20},
  {id:"tactics",title:"Tactiekbord",description:"Werk wedstrijdideeën uit op het digitale tactiekbord.",href:"https://ajaxpro-tactics-board.vercel.app",section:"team",external:true,requiredPermission:permissions.toolsTactics,order:10},
  {id:"screenshot",title:"Screenshot Editor",description:"Maak screenshots klaar voor AjaxPro-publicaties.",href:"https://screenshot-bewerker.vercel.app",section:"team",external:true,requiredPermission:permissions.toolsScreenshot,order:20},
  {id:"motm-admin",title:"MOTM-stemmingen beheren",description:"Plan, open en beheer Man of the Match-stemmingen.",href:"/club/motm/beheer",section:"admin",external:false,requiredPermission:permissions.motmManage,order:10},
];

const sectionOrder:Record<ToolSection,number>={general:0,team:1,admin:2};
export const toolsForSession = (session: Session) => portalTools.filter(tool => !tool.requiredPermission || sessionHasPermission(session,tool.requiredPermission)).sort((a,b)=>sectionOrder[a.section]-sectionOrder[b.section]||a.order-b.order);
export const sectionTitles: Record<ToolSection,string>={general:"Tools",team:"Teamtools",admin:"Beheer"};
export const renderToolSections = (tools: readonly PortalTool[], options:{overviewLink?:boolean}={}) => (["general","team","admin"] as const).map(section=>{
  const items=tools.filter(tool=>tool.section===section);if(!items.length)return "";
  const rows=items.map(tool=>`<a class="tool-row" href="${esc(tool.href)}"${tool.external?' target="_blank" rel="noreferrer"':""}><span><strong>${esc(tool.title)}</strong><small>${esc(tool.description)}</small>${tool.status?`<em>${esc(tool.status)}</em>`:""}</span><b>Open ${tool.external?"↗":"→"}</b></a>`).join("");
  const link=options.overviewLink&&section==="general"?'<a class="button tertiary" href="/club/tools">Alle tools →</a>':"";
  return `<section class="tool-section"><div class="section-heading"><div><p class="eyebrow">AjaxPro Club</p><h2>${sectionTitles[section]}</h2></div>${link}</div>${rows}</section>`;
}).join("");
