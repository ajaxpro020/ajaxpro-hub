import type { FotMobSocialsMatch } from "./fotmob-socials-parser";
import { db } from "./motm-db";

export type SocialsMatchStatsSnapshot = FotMobSocialsMatch & { fixtureKey: string };

const asSnapshot=(fixtureKey:string,value:unknown):SocialsMatchStatsSnapshot|null=>{
  const snapshot=typeof value==="string"?JSON.parse(value):value;
  if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))return null;
  return {fixtureKey,...snapshot as FotMobSocialsMatch};
};

export const loadSocialsStatsAvailability=async(fixtureKeys:readonly string[])=>{
  if(!fixtureKeys.length)return new Set<string>();
  const rows=await db()`SELECT fixture_key FROM socials_match_stats_snapshots WHERE fixture_key = ANY(${[...fixtureKeys]})`;
  return new Set(rows.map(row=>String(row.fixture_key)));
};

export const loadSocialsMatchStatsSnapshot=async(fixtureKey:string)=>{
  const [row]=await db()`SELECT snapshot FROM socials_match_stats_snapshots WHERE fixture_key=${fixtureKey} LIMIT 1`;
  return row?asSnapshot(fixtureKey,row.snapshot):null;
};

export const saveSocialsMatchStatsSnapshot=async(snapshot:SocialsMatchStatsSnapshot)=>{
  if(snapshot.match.fotmobId===null)throw new Error("FotMob-wedstrijd-ID ontbreekt.");
  const {fixtureKey,...normalized}=snapshot,sql=db();
  await sql`INSERT INTO socials_match_stats_snapshots(fixture_key,fotmob_match_id,snapshot,imported_at,updated_at)
    VALUES(${fixtureKey},${snapshot.match.fotmobId},${sql.json(normalized)},now(),now())
    ON CONFLICT(fixture_key) DO UPDATE SET fotmob_match_id=excluded.fotmob_match_id,snapshot=excluded.snapshot,imported_at=now(),updated_at=now()`;
  return {fixtureKey,...normalized};
};
