export const permissions = {
  portalAccess: "portal.access",
  toolsLineup: "tools.lineup",
  toolsTactics: "tools.tactics",
  adminManage: "admin.manage",
  motmManage: "motm.manage",
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
  if (permission === permissions.motmManage) {
    const allowed = new Set((process.env.MOTM_MANAGER_ROLE_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean));
    return roleIds.some(roleId => allowed.has(roleId));
  }
  return roleIds.some((roleId) => discordRolePermissions.get(roleId)?.includes(permission));
};
