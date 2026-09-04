const toggle=document.querySelector(".menu-toggle");
const menu=document.querySelector(".mobile-menu");
const closeMenu=()=>{if(!toggle||!menu)return;menu.hidden=true;toggle.setAttribute("aria-expanded","false");toggle.setAttribute("aria-label","Menu openen");document.body.classList.remove("menu-open");toggle.focus()};
const openMenu=()=>{if(!toggle||!menu)return;menu.hidden=false;toggle.setAttribute("aria-expanded","true");toggle.setAttribute("aria-label","Menu sluiten");document.body.classList.add("menu-open");menu.querySelector(".mobile-menu__close")?.focus()};
toggle?.addEventListener("click",()=>toggle.getAttribute("aria-expanded")==="true"?closeMenu():openMenu());
menu?.querySelectorAll("a,.mobile-menu__close,.mobile-menu__backdrop").forEach(element=>element.addEventListener("click",closeMenu));
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!menu?.hidden)closeMenu()});
