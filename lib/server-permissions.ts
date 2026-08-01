import { readSession, type Session } from "./discord-auth";
import {
  defaultMemberPermissions,
  type Permission,
  rolesHavePermission,
} from "./permissions.config";

export const getSessionWithPermission = async (
  request: Request,
  permission: Permission,
): Promise<Session | null> => {
  const session = await readSession(request);
  if (!session) return null;
  const hasPermission = sessionHasPermission(session, permission);
  if (!hasPermission) return null;
  return session;
};

export const sessionHasPermission = (
  session: Session,
  permission: Permission,
) =>
  defaultMemberPermissions.includes(permission) ||
  rolesHavePermission(session.discordRoleIds, permission);
