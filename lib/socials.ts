export type SocialMatchContextRequirement = "required" | "optional" | "none";

export type SocialFormatDefinition = {
  id: "stats" | "quote" | "player-stats";
  title: string;
  description: string;
  matchContext: SocialMatchContextRequirement;
  availability: "available" | "planned";
};

export type SocialOutputFormat = {
  id: "portrait-4x5" | "vertical-9x16";
  label: string;
  width: 1080;
  height: 1350 | 1920;
};

export type SocialThemeId = "home" | "away" | "third" | "europa";

export type SocialThemeDefinition = {
  id: SocialThemeId;
  label: "Thuis" | "Uit" | "3e shirt" | "EL";
};

export const socialFormats: readonly SocialFormatDefinition[] = [
  {id:"stats",title:"Stats",description:"Vaste wedstrijdstatistieken voor Ajax en de tegenstander.",matchContext:"required",availability:"available"},
  {id:"quote",title:"Quote",description:"Een vaste AjaxPro-quotevisual.",matchContext:"optional",availability:"available"},
  {id:"player-stats",title:"Spelerstats",description:"Vaste individuele wedstrijdstatistieken voor een Ajax-speler.",matchContext:"required",availability:"available"},
];

export const socialOutputFormats: readonly SocialOutputFormat[] = [
  {id:"portrait-4x5",label:"Instagram en X",width:1080,height:1350},
  {id:"vertical-9x16",label:"TikTok en verticale socials",width:1080,height:1920},
];

export const socialThemes: readonly SocialThemeDefinition[] = [
  {id:"home",label:"Thuis"},
  {id:"away",label:"Uit"},
  {id:"third",label:"3e shirt"},
  {id:"europa",label:"EL"},
];

export const DEFAULT_SOCIAL_THEME: SocialThemeId = "home";
