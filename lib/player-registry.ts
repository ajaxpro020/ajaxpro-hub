import { db } from "./motm-db";
import { players as bootstrapPlayers } from "../data/players";

export type PlayerRegistryRow = {
  id: string;
  name: string;
  shirtNumber: number | null;
  position: string;
  imageUrl: string;
  active: boolean;
  contractEnd: string | null;
  contractPosition: string | null;
  contractNote: string | null;
  loanClub: string | null;
  loanEnd: string | null;
  loanNote: string | null;
  loanDeal: LoanDeal | null;
  updatedAt: string;
};

export type LoanDealSource = {
  label: string;
  url: string;
};

export type LoanDeal = {
  status: "confirmed" | "reported";
  updatedAt: string;
  terms: string[];
  note: string | null;
  sources: LoanDealSource[];
};

const mapDate=(value:unknown)=>{
  if(!value)return null;
  if(value instanceof Date)return value.toISOString().slice(0,10);
  const text=String(value);
  const iso=text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return iso??null;
};

const mapLoanDeal=(value:unknown):LoanDeal|null=>{
  if(!value||typeof value!=="object")return null;
  const deal=value as Record<string,unknown>;
  const status=deal.status==="confirmed"||deal.status==="reported"?deal.status:null;
  const terms=Array.isArray(deal.terms)?deal.terms.filter((term):term is string=>typeof term==="string"&&Boolean(term.trim())):[];
  const sources=Array.isArray(deal.sources)?deal.sources.flatMap((source)=>{
    if(!source||typeof source!=="object")return [];
    const item=source as Record<string,unknown>;
    return typeof item.label==="string"&&typeof item.url==="string"&&item.url.startsWith("https://")?[{label:item.label,url:item.url}]:[];
  }):[];
  if(!status||!terms.length||!sources.length)return null;
  return {status,updatedAt:mapDate(deal.updatedAt)??"",terms,note:typeof deal.note==="string"?deal.note:null,sources};
};

const mapPlayer=(row:any):PlayerRegistryRow=>({
  id:String(row.id),
  name:String(row.name),
  shirtNumber:row.shirt_number===null?null:Number(row.shirt_number),
  position:String(row.position),
  imageUrl:String(row.image_url),
  active:Boolean(row.active),
  contractEnd:mapDate(row.contract_end),
  contractPosition:row.contract_position?String(row.contract_position):null,
  contractNote:row.contract_note?String(row.contract_note):null,
  loanClub:row.loan_club?String(row.loan_club):null,
  loanEnd:mapDate(row.loan_end),
  loanNote:row.loan_note?String(row.loan_note):null,
  loanDeal:mapLoanDeal(row.loan_deal),
  updatedAt:new Date(row.updated_at).toISOString(),
});

export const loadPlayers=async({includeInactive=false}:{includeInactive?:boolean}={})=>{
  if(!process.env.DATABASE_URL){
    return bootstrapPlayers.filter(player=>includeInactive||player.active).map(player=>({
      ...player,contractEnd:null,contractPosition:null,contractNote:null,loanClub:null,loanEnd:null,loanNote:null,loanDeal:null,updatedAt:new Date(0).toISOString(),
    }));
  }
  const rows=await db()`SELECT id,name,shirt_number,position,image_url,active,contract_end,contract_position,contract_note,loan_club,loan_end,loan_note,loan_deal,updated_at
    FROM ajax_players WHERE (${includeInactive} OR active=true)
    ORDER BY active DESC,shirt_number NULLS LAST,name`;
  return rows.map(mapPlayer);
};

export const toToolPlayer=(player:PlayerRegistryRow)=>({
  id:player.id,
  name:player.name,
  shirtNumber:player.shirtNumber,
  position:player.position,
  imageUrl:player.imageUrl,
  active:player.active,
});
