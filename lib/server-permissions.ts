import { readSession, type Session } from "./discord-auth";
import {
  type Permission,
  rolesHavePermission,
} from "./permissions.config";

export const getSessionWithPermission = async (
  request: Request,
  permission: Permission,
): Promise<Session | null> => {
  const session = await readSession(request);
  if (!session) return null;
  if (!rolesHavePermission(session.discordRoleIds, permission)) return null;
  return session;
};
