export const permissions = {
  portalAccess: "portal.access",
  toolsLineup: "tools.lineup",
  toolsTactics: "tools.tactics",
  toolsScreenshot: "tools.screenshot",
  toolsSocials: "tools.socials",
  adminManage: "admin.manage",
  motmManage: "motm.manage",
  motmDelete: "motm.delete",
  mediaWatchManage: "media-watch.manage",
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
  if (permission === permissions.motmDelete) {
    const allowed = idsFromEnv("MOTM_DELETE_ROLE_IDS");
    return roleIds.some(roleId => allowed.has(roleId));
  }
  if (permission === permissions.mediaWatchManage) {
    const allowed = idsFromEnv("MEDIA_WATCH_ADMIN_ROLE_IDS");
    return roleIds.some(roleId => allowed.has(roleId));
  }
  if (permission === permissions.toolsTactics || permission === permissions.toolsScreenshot || permission === permissions.toolsSocials) {
    const allowed = idsFromEnv("PORTAL_TEAM_TOOL_ROLE_IDS");
    return roleIds.some(roleId => allowed.has(roleId));
  }
  return roleIds.some((roleId) => discordRolePermissions.get(roleId)?.includes(permission));
};
