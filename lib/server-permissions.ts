import { getDiscordGuildMemberRoles, readSession, type Session } from "./discord-auth";
import {
  defaultMemberPermissions,
  permissions,
  type Permission,
  rolesHavePermission,
} from "./permissions.config";

export const MANAGEMENT_SESSION_MAX_AGE_SECONDS = 60 * 60;
export const MANAGEMENT_PERMISSION_CACHE_SECONDS = 15 * 60;
const managementPermissions = new Set<Permission>([
  permissions.adminManage,
  permissions.motmManage,
  permissions.motmDelete,
  permissions.mediaWatchManage,
]);
type AuthorizationOptions = {
  nowSeconds?: number;
  fetchRoles?: (userId: string) => Promise<readonly string[]>;
};

type PermissionCacheEntry = { roleIds: readonly string[]; checkedAt: number };
const managementPermissionCache = new Map<string, PermissionCacheEntry>();

export const clearManagementPermissionCache = () => managementPermissionCache.clear();

export const authorizeSessionPermission = async (
  session: Session,
  permission: Permission,
  options: AuthorizationOptions = {},
): Promise<Session | null> => {
  if (!managementPermissions.has(permission)) {
    return defaultMemberPermissions.includes(permission) || rolesHavePermission(session.discordRoleIds, permission) ? session : null;
  }

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const managementSessionAge = now - session.issuedAt;
  if (!Number.isFinite(session.issuedAt) || managementSessionAge < 0 || managementSessionAge >= MANAGEMENT_SESSION_MAX_AGE_SECONDS) return null;
  const cacheKey = `${session.userId}:${session.issuedAt}:${session.discordRoleIds.join(",")}`;
  const cached = managementPermissionCache.get(cacheKey);
  const roleIds = cached && now - cached.checkedAt < MANAGEMENT_PERMISSION_CACHE_SECONDS
    ? cached.roleIds
    : cached
      ? await refreshManagementRoles(cacheKey, session.userId, now, options.fetchRoles)
      : session.issuedAt + MANAGEMENT_PERMISSION_CACHE_SECONDS > now
        ? (managementPermissionCache.set(cacheKey, { roleIds: session.discordRoleIds, checkedAt: session.issuedAt }), session.discordRoleIds)
        : await refreshManagementRoles(cacheKey, session.userId, now, options.fetchRoles);
  return roleIds && rolesHavePermission(roleIds, permission) ? session : null;
};

const refreshManagementRoles = async (
  cacheKey: string,
  userId: string,
  now: number,
  fetchRoles: (userId: string) => Promise<readonly string[]> = async (userId) => getDiscordGuildMemberRoles(userId),
): Promise<readonly string[] | null> => {
  try {
    const roleIds = await fetchRoles(userId);
    managementPermissionCache.set(cacheKey, { roleIds: [...roleIds], checkedAt: now });
    return roleIds;
  } catch {
    managementPermissionCache.delete(cacheKey);
    return null;
  }
};

export const getSessionWithPermission = async (
  request: Request,
  permission: Permission,
): Promise<Session | null> => {
  const session = await readSession(request);
  if (!session) return null;
  return authorizeSessionPermission(session, permission);
};

export const sessionHasPermission = (session: Session, permission: Permission) =>
  defaultMemberPermissions.includes(permission) || rolesHavePermission(session.discordRoleIds, permission);
