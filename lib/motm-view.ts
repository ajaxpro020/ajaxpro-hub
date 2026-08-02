import { noStoreHeaders } from "./discord-auth";
import { permissions, rolesHavePermission } from "./permissions.config";

export type ClubUser = { username: string; avatarUrl: string; discordRoleIds?: readonly string[] };
export type ClubSection = "home" | "motm" | "stand" | "tools";

export const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export const formatKickoff = (value: string | Date) => new Intl.DateTimeFormat("nl-NL", { weekday:"long", day:"numeric", month:"long", hour:"2-digit", minute:"2-digit", timeZone:"Europe/Amsterdam" }).format(new Date(value));
export const formatMoment = (value: string | Date) => new Intl.DateTimeFormat("nl-NL", { day:"numeric", month:"long", hour:"2-digit", minute:"2-digit", timeZone:"Europe/Amsterdam" }).format(new Date(value));
export const remainingTime = (value: string | Date, now = new Date()) => { const ms=Math.max(0,new Date(value).getTime()-now.getTime()); const hours=Math.floor(ms/3600000); const minutes=Math.ceil((ms%3600000)/60000); return hours ? `${hours} uur${minutes ? ` en ${minutes} min.`:""}` : `${minutes} min.`; };
export const matchTitle = (match: { opponent?: unknown; home_or_away?: unknown }) => match.home_or_away === "home" ? `Ajax — ${String(match.opponent ?? "")}` : `${String(match.opponent ?? "")} — Ajax`;

const nav = (active: ClubSection, user?: ClubUser) => {
  const hasTools = Boolean(user?.discordRoleIds && (
    rolesHavePermission(user.discordRoleIds, permissions.toolsTactics) ||
    rolesHavePermission(user.discordRoleIds, permissions.toolsScreenshot) ||
    rolesHavePermission(user.discordRoleIds, permissions.motmManage)
  ));
  return [["home","/club","Home"],["motm","/club/motm","Stemmen"],["stand","/club/stand","Stand"],...(hasTools?[["tools","/club/tools","Tools"]]:[])].map(([key,href,label]) => `<a href="${href}"${active===key ? ' class="active" aria-current="page"' : ""}><span aria-hidden="true" class="nav-icon nav-icon--${key}"></span>${label}</a>`).join("");
};

export const page = (title: string, body: string, script = "", user?: ClubUser, active: ClubSection = "motm") => new Response(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#05070d"><title>${esc(title)} | AjaxPro</title><link rel="icon" href="/Favicon/favicon.ico"><link rel="stylesheet" href="/motm.css?v=6"></head><body><header class="portal-header"><div class="portal-header__inner"><a class="portal-brand" href="/club"><img src="/assets/ajaxpro-logo.png" alt="AjaxPro"><span>Club</span></a><nav class="desktop-nav" aria-label="Club-navigatie">${nav(active,user)}</nav>${user ? `<details class="profile-menu"><summary><img src="${esc(user.avatarUrl)}" alt=""><span>${esc(user.username)}</span></summary><div><strong>${esc(user.username)}</strong><form action="/api/auth/logout" method="post"><button type="submit">Uitloggen</button></form></div></details>` : `<a class="profile-login" href="/api/auth/discord-login">Inloggen</a>`}</div></header>${body}<nav class="mobile-nav" aria-label="Club-navigatie">${nav(active,user)}</nav>${script ? `<script src="${script}" defer></script>` : ""}</body></html>`, { headers: { ...noStoreHeaders, "Content-Type":"text/html; charset=UTF-8", "Content-Security-Policy":"default-src 'none'; style-src 'self'; img-src 'self' https://cdn.discordapp.com; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" } });
export const errorPage = (title: string, message: string, status = 400, user?: ClubUser, backHref="/club/motm", active: ClubSection="motm") => { const response = page(title, `<main class="motm-main"><section class="empty"><a class="back" href="${backHref}">← Terug</a><p class="eyebrow">AjaxPro Club</p><h1>${esc(title)}</h1><p>${esc(message)}</p></section></main>`, "", user, active); return new Response(response.body, { status, headers: response.headers }); };
export const pageHeader = (title: string, eyebrow: string, backHref?: string, backLabel?: string, action?: string) => `<header class="page-heading">${backHref ? `<a class="back" href="${backHref}">← ${esc(backLabel ?? "Terug")}</a>` : ""}<div class="page-heading__row"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1></div>${action ?? ""}</div></header>`;
export const matchHeading = (match: any) => `<p class="eyebrow">${esc(match.competition)} · ${match.home_or_away === "home" ? "Thuis" : "Uit"}</p><h1>${esc(matchTitle(match))}</h1><p class="match-date">${esc(formatKickoff(match.kickoff_at))}${match.home_score != null ? ` · ${match.home_score}–${match.away_score}` : ""}</p>`;
