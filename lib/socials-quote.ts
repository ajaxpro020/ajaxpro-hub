export const QUOTE_MAX_LENGTH=280;
export const QUOTE_NAME_MAX_LENGTH=60;
export const QUOTE_ROLE_MAX_LENGTH=80;
export const QUOTE_PHOTO_MAX_BYTES=8*1024*1024;
export const QUOTE_PHOTO_TYPES=["image/jpeg","image/png","image/webp"] as const;

export const quoteFields = [
  {id:"quote",label:"Quote",control:"textarea",maxLength:QUOTE_MAX_LENGTH,required:true},
  {id:"name",label:"Naam",control:"text",maxLength:QUOTE_NAME_MAX_LENGTH,required:true},
  {id:"role",label:"Rol / functie",control:"text",maxLength:QUOTE_ROLE_MAX_LENGTH,required:false},
  {id:"photo",label:"Foto",control:"file",required:false},
] as const;

export const isValidQuotePhoto = (file:{type:string;size:number}) =>
  (QUOTE_PHOTO_TYPES as readonly string[]).includes(file.type)&&file.size>0&&file.size<=QUOTE_PHOTO_MAX_BYTES;
