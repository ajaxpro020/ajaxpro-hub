import type { Session } from "./discord-auth";

const roleLabels: readonly [string,string][] = [
  ["1268471493046566987","Owner"],
  ["1268471493046566986","Admin"],
  ["1268471493034246376","Moderator"],
  ["1271472085788786718","Helper"],
  ["1422264769863221319","Analist"],
];

export const clubRoleLabel = (roleIds: readonly string[]) => roleLabels.find(([id])=>roleIds.includes(id))?.[1] ?? "Lid";

export const verifiedClubStatus = (session: Pick<Session,"discordRoleIds">) => `<section class="club-verified" aria-label="AjaxPro-verificatie"><span class="club-verified__mark" aria-hidden="true">✓</span><span><strong>AjaxPro Verified</strong><small>Geverifieerd via Discord · ${clubRoleLabel(session.discordRoleIds)}</small></span></section>`;
