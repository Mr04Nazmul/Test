/* Approved, passenger-facing HTTPS read-only vehicle feed only. No ATS/CBTC/OCC access. */
(function(root){
"use strict";
const STALE=45000;
const https=s=>typeof s==="string"&&/^https:\/\/[^\s]+$/.test(s);
function create(config={},deps={}){
 const now=deps.now||(()=>Date.now()),project=deps.project;
 const fetcher=deps.fetch||root.fetch?.bind(root);
 const approved=config.enabled===true&&https(config.endpoint)&&https(config.license_url)&&
  ["operator","licensed_community"].includes(config.source_type)&&
  /^[a-zA-Z0-9_.-]{3,60}$/.test(config.provider_id||"");
 let state=approved?"waiting":"not_configured",vehicles=[],lastPoll=0,error="";
 function parse(v){
  if(!v||v.route_id!=="MRT-6")return null;
  const lat=Number(v.latitude),lon=Number(v.longitude),time=Date.parse(v.observed_at);
  const id=String(v.vehicle_id||"").replace(/[^a-zA-Z0-9:_-]/g,"").slice(0,50);
  if(!id||!Number.isFinite(lat)||!Number.isFinite(lon)||!Number.isFinite(time)||
   lat<23.70||lat>23.91||lon<90.32||lon>90.46||time>now()+2000||now()-time>STALE)return null;
  if(project&&project(lat,lon).distance>150)return null;
  return{id,lat,lon,time,expires:time+STALE,sourceType:config.source_type,
   provider:config.provider_id,operatorVerified:config.source_type==="operator",
   direction:["north","south"].includes(v.direction)?v.direction:"unknown",
   nextStation:typeof v.next_station_id==="string"?v.next_station_id.slice(0,32):null};
 }
 function snapshot(){
  const current=vehicles.filter(v=>v.expires>=now());
  return{state:approved?(state==="error"?"error":current.length?"live":state):"not_configured",
   sourceType:approved?config.source_type:null,provider:approved?config.provider_id:null,
   licensed:approved,licenseUrl:approved?config.license_url:null,
   vehicles:current,lastPoll,error};
 }
 async function poll(){
  if(!approved||!fetcher)return snapshot();
  if(lastPoll&&now()-lastPoll<12000)return snapshot();
  lastPoll=now();
  const controller=typeof AbortController!=="undefined"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),9000):null;
  try{
   const res=await fetcher(config.endpoint,{method:"GET",mode:"cors",credentials:"omit",
    cache:"no-store",redirect:"error",headers:{Accept:"application/json"},
    ...(controller?{signal:controller.signal}:{})});
   if(!res.ok)throw Error("HTTP "+res.status);
   const json=await res.json();
   if(json.provider_id!==config.provider_id||!Array.isArray(json.vehicles))
    throw Error("Provider/schema mismatch");
   const ids=new Set(),good=[];
   for(const row of json.vehicles.slice(0,120)){
    const v=parse(row);if(v&&!ids.has(v.id)){good.push(v);ids.add(v.id)}
    if(good.length>=40)break;
   }
   vehicles=good;state=good.length?"live":"no_fresh_positions";error="";
  }catch(e){vehicles=[];state="error";error=String(e.message||e).slice(0,150)}
  finally{if(timer!==null)clearTimeout(timer)}
  return snapshot();
 }
 return{snapshot,poll,parse,configured:approved};
}
root.MRT_AUTHORIZED_LIVE_FEED={create,STALE};
})(typeof window!=="undefined"?window:globalThis);
