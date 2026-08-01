export const permissions = {
  portalAccess: "portal.access",
  toolsLineup: "tools.lineup",
  toolsTactics: "tools.tactics",
  toolsScreenshot: "tools.screenshot",
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

const idsFromEnv = (name: string) => new Set((process.env[name] ?? "").split(",").map(id => id.trim()).filter(Boolean));

export const rolesHavePermission = (
  roleIds: readonly string[],
  permission: Permission,
) => {
  if (permission === permissions.motmManage) {
    const allowed = idsFromEnv("MOTM_MANAGER_ROLE_IDS");
    return roleIds.some(roleId => allowed.has(roleId));
  }
  if (permission === permissions.toolsTactics || permission === permissions.toolsScreenshot) {
    const allowed = idsFromEnv("PORTAL_TEAM_TOOL_ROLE_IDS");
    return roleIds.some(roleId => allowed.has(roleId));
  }
  return roleIds.some((roleId) => discordRolePermissions.get(roleId)?.includes(permission));
};
