export const permissions = {
  portalAccess: "portal.access",
  toolsLineup: "tools.lineup",
  toolsTactics: "tools.tactics",
  adminManage: "admin.manage",
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];

const environment = () =>
  (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;

const configuredPortalRoleIds = () =>
  (environment()?.DISCORD_ALLOWED_ROLE_IDS ?? "")
    .split(",")
    .map((roleId) => roleId.trim())
    .filter(Boolean);

export const discordRolePermissions = (): ReadonlyMap<
  string,
  readonly Permission[]
> =>
  new Map(
    configuredPortalRoleIds().map((roleId) => [
      roleId,
      [permissions.portalAccess] as const,
    ]),
  );

export const rolesHavePermission = (
  roleIds: readonly string[],
  permission: Permission,
) => {
  const rolePermissions = discordRolePermissions();
  return roleIds.some((roleId) =>
    rolePermissions.get(roleId)?.includes(permission),
  );
};
