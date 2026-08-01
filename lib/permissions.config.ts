export const permissions = {
  portalAccess: "portal.access",
  toolsLineup: "tools.lineup",
  toolsTactics: "tools.tactics",
  adminManage: "admin.manage",
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];

export const defaultMemberPermissions: readonly Permission[] = [
  permissions.portalAccess,
];

export const discordRolePermissions: ReadonlyMap<
  string,
  readonly Permission[]
> = new Map();

export const rolesHavePermission = (
  roleIds: readonly string[],
  permission: Permission,
) => {
  return roleIds.some((roleId) =>
    discordRolePermissions.get(roleId)?.includes(permission),
  );
};
