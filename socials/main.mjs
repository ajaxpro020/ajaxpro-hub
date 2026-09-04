import { initQuote } from "/socials/formats/quote.mjs";
import { initStats } from "/socials/formats/stats.mjs";
import { initPlayerStats } from "/socials/formats/player-stats.mjs";

const root=document.querySelector("[data-socials-root]");
if(root){
  const themeInputs=[...root.querySelectorAll('[name="social-theme"]')];
  const initialTheme=themeInputs.find(input=>input.checked)??themeInputs[0];
  const sharedState={theme:initialTheme?.value??"home",themeLabel:initialTheme?.dataset.themeLabel??"Thuis"};
  const modules={stats:initStats(root,sharedState),quote:initQuote(root,sharedState),"player-stats":initPlayerStats(root,sharedState)};
  let activeId=root.querySelector('[data-format-id][aria-pressed="true"]')?.dataset.formatId;
  const activate=id=>{
    const button=root.querySelector(`[data-format-id="${id}"]`);
    if(!button||button.disabled)return;
    if(activeId&&activeId!==id)modules[activeId]?.deactivate?.();
    activeId=id;
    root.querySelectorAll("[data-format-id]").forEach(option=>{const active=option===button;option.classList.toggle("is-active",active);option.setAttribute("aria-pressed",String(active))});
    root.querySelectorAll("[data-format-workspace]").forEach(workspace=>{workspace.hidden=workspace.dataset.formatWorkspace!==id});
    modules[id]?.activate?.();
  };
  const updateTheme=input=>{
    if(!input?.checked)return;
    sharedState.theme=input.value;
    sharedState.themeLabel=input.dataset.themeLabel??input.value;
    root.dataset.socialTheme=sharedState.theme;
    modules[activeId]?.activate?.();
  };
  root.querySelectorAll("[data-format-id]").forEach(button=>button.addEventListener("click",()=>activate(button.dataset.formatId)));
  themeInputs.forEach(input=>input.addEventListener("change",()=>updateTheme(input)));
  updateTheme(initialTheme);
  if(activeId)activate(activeId);
}
