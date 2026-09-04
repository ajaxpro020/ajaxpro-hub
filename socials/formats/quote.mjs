const ALLOWED_TYPES=new Set(["image/jpeg","image/png","image/webp"]);
const MAX_PHOTO_BYTES=8*1024*1024;

export const initQuote=(root,sharedState)=>{
  const workspace=root.querySelector("[data-quote-workspace]");
  if(!workspace)return {activate(){},deactivate(){}};
  const quote=workspace.querySelector('[data-quote-field="quote"]');
  const name=workspace.querySelector('[data-quote-field="name"]');
  const role=workspace.querySelector('[data-quote-field="role"]');
  const counter=workspace.querySelector("[data-quote-count]");
  const photoInput=workspace.querySelector("[data-quote-photo]");
  const photoPreview=workspace.querySelector("[data-quote-photo-preview]");
  const photoFrame=workspace.querySelector("[data-quote-photo-frame]");
  const photoRemove=workspace.querySelector("[data-quote-photo-remove]");
  const photoError=workspace.querySelector("[data-quote-photo-error]");
  const preview=workspace.querySelector("[data-quote-preview]");
  const resetButton=workspace.querySelector("[data-quote-reset]");
  const outputInputs=[...root.querySelectorAll('[name="social-output"]')];
  const state={photoFile:null,photoUrl:null};

  const releasePhotoUrl=()=>{if(state.photoUrl){URL.revokeObjectURL(state.photoUrl);state.photoUrl=null}};
  const ensurePhotoUrl=()=>{if(state.photoFile&&!state.photoUrl)state.photoUrl=URL.createObjectURL(state.photoFile);return state.photoUrl};
  const showPhotoError=message=>{photoError.textContent=message;photoError.hidden=!message};
  const render=()=>{
    const quoteText=quote.value.trim(),nameText=name.value.trim(),roleText=role.value.trim();
    resetButton.disabled=!(quoteText||nameText||roleText||state.photoFile);
    counter.textContent=String(quote.value.length);
    workspace.querySelector("[data-quote-preview-text]").textContent=quoteText?`“${quoteText}”`:"“Vul een quote in”";
    workspace.querySelector("[data-quote-preview-name]").textContent=nameText||"Naam";
    const rolePreview=workspace.querySelector("[data-quote-preview-role]");
    rolePreview.textContent=roleText;rolePreview.hidden=!roleText;
    preview.dataset.density=quoteText.length>170?"dense":quoteText.length>95?"compact":"normal";
    const photoUrl=ensurePhotoUrl();
    if(photoUrl){photoPreview.src=photoUrl;photoFrame.hidden=false;photoRemove.hidden=false}else{photoPreview.removeAttribute("src");photoFrame.hidden=true;photoRemove.hidden=true}
    const output=outputInputs.find(input=>input.checked)??outputInputs[0];
    if(output){preview.dataset.aspect=output.value;workspace.querySelector("[data-quote-preview-ratio]").textContent=output.value==="vertical-9x16"?"9:16":"4:5";workspace.querySelector("[data-quote-preview-dimensions]").textContent=`${output.dataset.width} × ${output.dataset.height}`}
    preview.dataset.theme=sharedState.theme;
    workspace.querySelector("[data-quote-preview-theme]").textContent=`Thema: ${sharedState.themeLabel} · ${sharedState.theme}`;
  };
  [quote,name,role].forEach(input=>input.addEventListener("input",render));
  outputInputs.forEach(input=>input.addEventListener("change",render));
  photoInput.addEventListener("change",()=>{
    const [file]=photoInput.files??[];
    showPhotoError("");
    if(!file)return;
    if(!ALLOWED_TYPES.has(file.type)){photoInput.value="";showPhotoError("Kies een JPG-, PNG- of WebP-afbeelding.");return}
    if(file.size<=0||file.size>MAX_PHOTO_BYTES){photoInput.value="";showPhotoError("De foto mag maximaal 8 MB zijn.");return}
    releasePhotoUrl();state.photoFile=file;render();
  });
  const removePhoto=()=>{releasePhotoUrl();state.photoFile=null;photoInput.value="";showPhotoError("");render()};
  photoRemove.addEventListener("click",removePhoto);
  resetButton.addEventListener("click",()=>{quote.value="";name.value="";role.value="";removePhoto()});
  window.addEventListener("beforeunload",releasePhotoUrl,{once:true});
  render();
  return {activate:render,deactivate:releasePhotoUrl};
};
