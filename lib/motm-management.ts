import type { Session } from "./discord-auth";
import { permissions } from "./permissions.config";
import { sessionHasPermission } from "./server-permissions";

export const REVISION_CONFLICT = "Deze stemming is ondertussen door iemand anders gewijzigd. Vernieuw de pagina en controleer de laatste gegevens.";
export const canDeleteMatch = (session: Session) => sessionHasPermission(session, permissions.motmDelete);
export const parseRevision = (value: FormDataEntryValue | null) => {
  const revision = Number(value);
  return Number.isInteger(revision) && revision > 0 ? revision : null;
};
export const nullableScore = (value: FormDataEntryValue | null) => {
  if (value === null || String(value).trim() === "") return null;
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 && score <= 99 ? score : undefined;
};
export const validDeleteConfirmation = (value: string, opponent: string) => {
  const normalized = value.trim().toLocaleLowerCase("nl-NL");
  return normalized === "verwijderen" || normalized === opponent.trim().toLocaleLowerCase("nl-NL");
};
export const mayRemovePlayer = (status: string, voteCount: number, canDelete: boolean) =>
  voteCount === 0 && (status === "draft" || canDelete);
export const safeAuditData = (value: Record<string, unknown>) => {
  const forbidden = /vote|voter|token|cookie|secret|session/i;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !forbidden.test(key)));
};
