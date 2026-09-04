export type PlayerStatsField = {
  id: "minutes" | "goals" | "assists" | "shots" | "shotsOnTarget" | "chancesCreated" | "passAccuracy" | "duelsWon";
  label: "Minuten" | "Goals" | "Assists" | "Schoten" | "Schoten op doel" | "Kansen gecreëerd" | "Passnauwkeurigheid" | "Gewonnen duels";
  kind: "integer" | "percentage";
  min: number;
  max: number;
  step: number;
};

export const playerStatsFields: readonly PlayerStatsField[] = [
  {id:"minutes",label:"Minuten",kind:"integer",min:0,max:130,step:1},
  {id:"goals",label:"Goals",kind:"integer",min:0,max:20,step:1},
  {id:"assists",label:"Assists",kind:"integer",min:0,max:20,step:1},
  {id:"shots",label:"Schoten",kind:"integer",min:0,max:50,step:1},
  {id:"shotsOnTarget",label:"Schoten op doel",kind:"integer",min:0,max:50,step:1},
  {id:"chancesCreated",label:"Kansen gecreëerd",kind:"integer",min:0,max:50,step:1},
  {id:"passAccuracy",label:"Passnauwkeurigheid",kind:"percentage",min:0,max:100,step:1},
  {id:"duelsWon",label:"Gewonnen duels",kind:"integer",min:0,max:50,step:1},
];

export const isValidPlayerStatsValue=(id:string,value:string)=>{
  const field=playerStatsFields.find(candidate=>candidate.id===id);
  if(!field)return false;
  if(value.trim()==="")return true;
  const number=Number(value);
  return Number.isFinite(number)&&number>=field.min&&number<=field.max&&(field.kind==="percentage"?number<=100:Number.isInteger(number));
};
