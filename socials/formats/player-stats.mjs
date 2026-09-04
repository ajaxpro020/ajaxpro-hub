const readTemplate=(root,selector,fallback=[])=>{
  const template=root.querySelector(selector);
  if(!template)return fallback;
  try{const parsed=JSON.parse(template.content.textContent||"[]");return Array.isArray(parsed)?parsed:fallback}catch{return fallback}
};

const ajaxIsHome=fixture=>String(fixture.home_team).toLocaleLowerCase("nl-NL").includes("ajax");
const contextFor=fixture=>{
  const home=ajaxIsHome(fixture);
  return {opponent:home?fixture.away_team:fixture.home_team,ajaxScore:home?fixture.goals_home:fixture.goals_away,opponentScore:home?fixture.goals_away:fixture.goals_home,competition:fixture.competition,kickoff:fixture.kickoff_at};
};
const formatDate=value=>new Intl.DateTimeFormat("nl-NL",{weekday:"short",day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Amsterdam"}).format(new Date(value));

export const initPlayerStats=(root,sharedState)=>{
  const workspace=root.querySelector("[data-player-stats-workspace]");
  const fixtures=readTemplate(root,"template[data-socials-match-context]");
  const players=readTemplate(root,"template[data-socials-players]");
  if(!workspace||!fixtures.length)return {activate(){},deactivate(){}};
  const playerSelect=workspace.querySelector("[data-player-select]");
  const matchSelect=workspace.querySelector("[data-player-match-select]");
  const inputs=[...workspace.querySelectorAll("[data-player-stat-id]")];
  const outputInputs=[...root.querySelectorAll('[name="social-output"]')];
  const preview=workspace.querySelector("[data-player-stats-preview]");
  const resetButton=workspace.querySelector("[data-player-stats-reset]");
  const playerForSelection=()=>players.find(player=>player.id===playerSelect?.value)??players[0];
  const fixtureForSelection=()=>fixtures.find(fixture=>fixture.fixture_key===matchSelect?.value)??fixtures[0];
  const render=()=>{
    const player=playerForSelection(),context=contextFor(fixtureForSelection());
    workspace.querySelector("[data-player-preview-name]").textContent=player?.name??"Speler";
    workspace.querySelector("[data-player-preview-details]").textContent=player?[`#${player.shirtNumber??"–"}`,player.position].filter(Boolean).join(" · "):"Ajax-speler";
    workspace.querySelector("[data-player-preview-meta]").textContent=`${context.competition} · ${formatDate(context.kickoff)} · Ajax – ${context.opponent}`;
    const photo=workspace.querySelector("[data-player-preview-photo]"),placeholder=workspace.querySelector("[data-player-preview-placeholder]");
    if(player?.imageUrl){photo.src=player.imageUrl;photo.alt=`Foto van ${player.name}`;photo.hidden=false;placeholder.hidden=true}else{photo.removeAttribute("src");photo.alt="";photo.hidden=true;placeholder.hidden=false}
    inputs.forEach(input=>{const hasValue=input.value.trim()!=="";input.setAttribute("aria-invalid",String(hasValue&&!input.validity.valid));const target=workspace.querySelector(`[data-player-preview-value="${input.dataset.playerStatId}"]`);if(target)target.textContent=input.validity.valid&&hasValue?`${input.value}${input.dataset.playerStatId==="passAccuracy"?"%":""}`:"—"});
    resetButton.disabled=!inputs.some(input=>input.value.trim()!=="");
    const output=outputInputs.find(input=>input.checked)??outputInputs[0];
    if(output){preview.dataset.aspect=output.value;workspace.querySelector("[data-player-preview-ratio]").textContent=output.value==="vertical-9x16"?"9:16":"4:5";workspace.querySelector("[data-player-preview-dimensions]").textContent=`${output.dataset.width} × ${output.dataset.height}`}
    preview.dataset.theme=sharedState.theme;workspace.querySelector("[data-player-preview-theme]").textContent=`Thema: ${sharedState.themeLabel} · ${sharedState.theme}`;
  };
  playerSelect?.addEventListener("change",render);matchSelect?.addEventListener("change",render);inputs.forEach(input=>input.addEventListener("input",render));outputInputs.forEach(input=>input.addEventListener("change",render));
  resetButton?.addEventListener("click",()=>{inputs.forEach(input=>{input.value="";input.removeAttribute("aria-invalid")});render()});
  render();
  return {activate:render,deactivate(){}};
};
