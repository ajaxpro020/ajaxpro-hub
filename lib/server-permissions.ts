import { DiscordGuildCheckUnavailableError, getCurrentDiscordGuildMember, readSession, type Session } from "./discord-auth";
import {
  defaultMemberPermissions,
  permissions,
  type Permission,
  rolesHavePermission,
} from "./permissions.config";

export const MANAGEMENT_ROLE_MAX_AGE_MS = 15 * 60 * 1000;
const managementPermissions = new Set<Permission>([
  permissions.adminManage,
  permissions.motmManage,
  permissions.motmDelete,
]);
type RoleCheck = { roleIds: string[]; checkedAt: number };
const roleChecks = new Map<string, RoleCheck>();

type AuthorizationOptions = {
  now?: number;
  loadMember?: (userId: string) => Promise<{ roles: string[] } | null>;
};

export const clearManagementRoleCache = () => roleChecks.clear();

export const authorizeSessionPermission = async (
  session: Session,
  permission: Permission,
  options: AuthorizationOptions = {},
): Promise<Session | null> => {
  if (!managementPermissions.has(permission)) {
    return defaultMemberPermissions.includes(permission) || rolesHavePermission(session.discordRoleIds, permission) ? session : null;
  }

  const now = options.now ?? Date.now();
  let check = roleChecks.get(session.userId);
  if (!check || now - check.checkedAt >= MANAGEMENT_ROLE_MAX_AGE_MS) {
    let member: { roles: string[] } | null;
    try {
      member = await (options.loadMember ?? getCurrentDiscordGuildMember)(session.userId);
    } catch (error) {
      if (error instanceof DiscordGuildCheckUnavailableError) throw error;
      throw new DiscordGuildCheckUnavailableError();
    }
    if (!member) {
      roleChecks.delete(session.userId);
      return null;
    }
    check = { roleIds: [...member.roles], checkedAt: now };
    roleChecks.set(session.userId, check);
  }

  const currentSession = { ...session, discordRoleIds: [...check.roleIds] };
  return rolesHavePermission(currentSession.discordRoleIds, permission) ? currentSession : null;
};

export const isDiscordAuthorizationUnavailable = (error: unknown) =>
  error instanceof DiscordGuildCheckUnavailableError;

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
