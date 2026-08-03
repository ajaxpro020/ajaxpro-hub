export type LiveVoteRow = { player_id:string; name_snapshot:string; image_url_snapshot:string; votes:number };

export const buildLiveVoteSnapshot = (status:string, rows:LiveVoteRow[], updatedAt=new Date()) => {
  const total=rows.reduce((sum,row)=>sum+Number(row.votes),0);
  const players=rows.map(row=>({...row,votes:Number(row.votes),percentage:total?Math.round(Number(row.votes)*100/total):0})).sort((a,b)=>b.votes-a.votes||a.name_snapshot.localeCompare(b.name_snapshot,"nl"));
  return {status,total,updatedAt:updatedAt.toISOString(),players};
};
