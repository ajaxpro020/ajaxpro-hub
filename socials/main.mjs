import { statsFormat } from "/socials/formats/stats.mjs";
import { outblinkerFormat } from "/socials/formats/outblinker.mjs";
import { topThreeFormat } from "/socials/formats/top-three.mjs";
import { quoteFormat } from "/socials/formats/quote.mjs?v=20260915-quote-variants";
import { initMatchStats } from "/socials/match-stats.mjs";

const formatDefinitions=[statsFormat,outblinkerFormat,topThreeFormat,quoteFormat];
const globalDataRequirements=["matchData","matchStats","playerStats"];
const requirementLabels={matchData:"Wedstrijddata",matchStats:"Stats",playerStats:"Spelerstats"};
const readFixtures=root=>{
  const template=root.querySelector("template[data-socials-match-context]");
  if(!template)return [];
  try{const fixtures=JSON.parse(template.content.textContent||"[]");return Array.isArray(fixtures)?fixtures:[]}catch{return []}
};

const root=document.querySelector("[data-socials-root]");
if(root){
  const sharedState={};
  const matchStats=initMatchStats(root,sharedState);
  const fixtures=readFixtures(root);
  const formats=new Map(formatDefinitions.map(definition=>[definition.id,{definition,controller:definition.init(root,sharedState)}]));
  const formatStatus=root.querySelector("[data-socials-format-status]"),resetFormat=root.querySelector("[data-socials-format-reset]"),previewControls=root.querySelector("[data-socials-preview-controls]");
  let activeId=root.querySelector('[data-format-id][aria-pressed="true"]')?.dataset.formatId;
  const globalDataStatus=()=>{
    const fixture=fixtures.find(item=>item.fixture_key===sharedState.selectedFixtureKey)??fixtures[0]??null;
    const payload=fixture?sharedState.getMatchStats?.(fixture.fixture_key):null;
    return {matchData:Boolean(fixture),matchStats:Boolean(payload),playerStats:Array.isArray(payload?.players)&&payload.players.length>0};
  };
  const renderGlobalDataStatus=()=>{
    if(!formatStatus)return;
    const states=globalDataStatus();
    formatStatus.replaceChildren(...globalDataRequirements.map((requirement,index)=>{const available=states[requirement],item=document.createElement("span");item.dataset.state=available?"available":"missing";item.textContent=`${requirementLabels[requirement]} ${available?"beschikbaar":"ontbreekt"}`;if(index)item.dataset.separated="true";return item}));
  };
  const refreshFormatStatus=()=>{
    const format=formats.get(activeId),states=format?.controller.getRequirementStatus?.()??{};
    renderGlobalDataStatus();
    const ready=Boolean(format)&&format.definition.requirements.every(requirement=>Boolean(states[requirement]));
    const workspace=root.querySelector(`[data-format-workspace="${activeId}"]`);if(workspace){workspace.dataset.formatReady=String(ready);workspace.dataset.formatDataReady=String(Boolean(states.matchData)&&(!format.definition.requirements.includes("matchStats")||Boolean(states.matchStats)))}
    if(resetFormat)resetFormat.disabled=!format;
  };
  const activate=id=>{
    const button=root.querySelector(`[data-format-id="${id}"]`);
    const next=formats.get(id);if(!button||button.disabled||!next)return;
    if(activeId&&activeId!==id)formats.get(activeId)?.controller.deactivate?.();
    activeId=id;
    root.querySelectorAll("[data-format-id]").forEach(option=>{const active=option===button;option.classList.toggle("is-active",active);option.setAttribute("aria-pressed",String(active))});
    root.querySelectorAll("[data-format-workspace]").forEach(workspace=>{workspace.hidden=workspace.dataset.formatWorkspace!==id});
    const preview=next.controller&&root.querySelector(`[data-format-workspace="${id}"] .socials-preview-panel`);if(preview&&previewControls){preview.querySelector(".socials-preview-heading")?.after(previewControls);previewControls.hidden=false}
    if(next.definition.requirements.includes("matchData"))matchStats.activate(id);
    next.controller.activate?.();
    refreshFormatStatus();
  };
  root.querySelectorAll("[data-format-id]").forEach(button=>button.addEventListener("click",()=>activate(button.dataset.formatId)));
  resetFormat?.addEventListener("click",()=>{formats.get(activeId)?.controller.reset?.();refreshFormatStatus()});
  root.addEventListener("socials:match-stats",refreshFormatStatus);
  root.addEventListener("socials:match-selection",refreshFormatStatus);
  root.addEventListener("socials:format-status-change",event=>{if(event.detail?.formatId===activeId)refreshFormatStatus()});
  if(activeId)activate(activeId);
}
