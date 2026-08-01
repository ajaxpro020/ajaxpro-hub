import { permissions, type Permission } from "./permissions.config";

export type PortalModule = {
  id: string;
  title: string;
  description: string;
  link: string;
  status: "available" | "soon";
  requiredPermission: Permission;
  kind: "tool" | "community";
  external?: boolean;
};

export const portalModules: readonly PortalModule[] = [
  {
    id: "lineup-maker",
    title: "Opstellingmaker",
    description: "Maak en deel jouw ideale Ajax-opstelling.",
    link: "https://opstelling.ajaxpro.fans",
    status: "available",
    requiredPermission: permissions.portalAccess,
    kind: "tool",
    external: true,
  },
  {
    id: "bingo-generator",
    title: "Bingo Generator",
    description: "Maak je eigen Ajax-bingokaart.",
    link: "https://bingo.ajaxpro.fans",
    status: "available",
    requiredPermission: permissions.portalAccess,
    kind: "tool",
    external: true,
  },
  {
    id: "contracts",
    title: "Ajax-contracten",
    description: "Bekijk de einddatum van alle spelerscontracten.",
    link: "/contracten.html",
    status: "available",
    requiredPermission: permissions.portalAccess,
    kind: "tool",
  },
  {
    id: "discord-community",
    title: "AjaxPro Discord",
    description: "Praat mee over transfers, wedstrijden en alles rond Ajax.",
    link: "https://discord.gg/fqtxTH2u2W",
    status: "available",
    requiredPermission: permissions.portalAccess,
    kind: "community",
    external: true,
  },
] as const;
