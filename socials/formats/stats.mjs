const readFixtures=root=>{
  const template=root.querySelector("template[data-socials-match-context]");
  if(!template)return [];
  try{const parsed=JSON.parse(template.content.textContent||"[]");return Array.isArray(parsed)?parsed:[]}catch{return []}
};

const ajaxIsHome=fixture=>String(fixture.home_team).toLocaleLowerCase("nl-NL").includes("ajax");
const contextFor=fixture=>{
  const home=ajaxIsHome(fixture);
  return {
    ajax:"Ajax",
    opponent:home?fixture.away_team:fixture.home_team,
    ajaxScore:home?fixture.goals_home:fixture.goals_away,
    opponentScore:home?fixture.goals_away:fixture.goals_home,
    competition:fixture.competition,
    kickoff:fixture.kickoff_at,
  };
};
const formatDate=value=>new Intl.DateTimeFormat("nl-NL",{weekday:"short",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Amsterdam"}).format(new Date(value));
const displayValue=input=>{
  if(!input||input.value.trim()===""||!input.validity.valid)return "—";
  const suffix=input.dataset.statId==="possession"?"%":"";
  return `${input.value.replace(".",",")}${suffix}`;
};

export const initStats=(root,sharedState)=>{
  const workspace=root.querySelector("[data-stats-workspace]");
  const fixtures=readFixtures(root);
  if(!workspace||!fixtures.length)return {activate(){},deactivate(){}};
  const matchSelect=workspace.querySelector("[data-match-select]");
  const inputs=[...workspace.querySelectorAll("[data-stat-id][data-team]")];
  const outputInputs=[...root.querySelectorAll('[name="social-output"]')];
  const preview=workspace.querySelector("[data-stats-preview]");
  const resetButton=workspace.querySelector("[data-stats-reset]");
  const fixtureForSelection=()=>fixtures.find(fixture=>fixture.fixture_key===matchSelect?.value)??fixtures[0];
  const render=()=>{
    const context=contextFor(fixtureForSelection());
    workspace.querySelector('[data-preview-team="ajax"]').textContent=context.ajax;
    workspace.querySelector('[data-preview-team="opponent"]').textContent=context.opponent;
    workspace.querySelector("[data-preview-meta]").textContent=`${context.competition} · ${formatDate(context.kickoff)}`;
    const hasScore=context.ajaxScore!==null&&context.opponentScore!==null;
    workspace.querySelector("[data-preview-score]").textContent=hasScore?`${context.ajaxScore} – ${context.opponentScore}`:"–";
    inputs.forEach(input=>{
      const hasValue=input.value.trim()!=="";
      input.setAttribute("aria-invalid",String(hasValue&&!input.validity.valid));
      const target=workspace.querySelector(`[data-preview-value="${input.dataset.statId}-${input.dataset.team}"]`);
      if(target)target.textContent=displayValue(input);
    });
    resetButton.disabled=!inputs.some(input=>input.value.trim()!=="");
    const output=outputInputs.find(input=>input.checked)??outputInputs[0];
    if(output){preview.dataset.aspect=output.value;workspace.querySelector("[data-preview-ratio]").textContent=output.value==="vertical-9x16"?"9:16":"4:5";workspace.querySelector("[data-preview-dimensions]").textContent=`${output.dataset.width} × ${output.dataset.height}`}
    preview.dataset.theme=sharedState.theme;
    workspace.querySelector("[data-preview-theme]").textContent=`Thema: ${sharedState.themeLabel} · ${sharedState.theme}`;
  };
  inputs.forEach(input=>input.addEventListener("input",render));
  outputInputs.forEach(input=>input.addEventListener("change",render));
  matchSelect?.addEventListener("change",render);
  resetButton?.addEventListener("click",()=>{inputs.forEach(input=>{input.value="";input.setCustomValidity("");input.removeAttribute("aria-invalid")});render()});
  render();
  return {activate:render,deactivate(){}};
};
