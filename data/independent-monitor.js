/* Independent PUBLIC 3D route observation engine.
 * Reconstructs a consenting passenger PHONE's route projection from GPS.
 * This is NOT DMTCL CBTC/ATS, NOT a train GPS feed, and cannot identify vehicles.
 * Does not contact or interrogate metro signalling / telecom infrastructure.
 */
(function(root){
"use strict";
const DEG=Math.PI/180;
const STALE_MS=20000,MAX_ACCURACY=80,MAX_ROUTE_DISTANCE=130;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=v=>typeof v==="number"&&Number.isFinite(v);
const distance=(a,b)=>{
 const lat=(a.lat+b.lat)*.5*DEG;
 return Math.hypot((a.lon-b.lon)*111320*Math.cos(lat),(a.lat-b.lat)*111320);
};
function monitor(track){
 if(!track||!Array.isArray(track.points)||!Array.isArray(track.stations))
  throw Error("A known public rail geometry must be supplied");
 const points=track.points.map(a=>({lat:a[0],lon:a[1]})),stations=track.stations;
 const breaks=track.stationBreaks||stations.map((_,i)=>i*Math.max(1,points.length-1)/(stations.length-1));
 const cum=[0];for(let i=1;i<points.length;i++)cum.push(cum[i-1]+distance(points[i-1],points[i]));
 const stationMeters=breaks.map(i=>cum[clamp(Math.round(i),0,cum.length-1)]);
 let previous=null,last=null;
 function project(lat,lon){
  const mlon=111320*Math.cos(lat*DEG);
  let best={distance:Infinity,meters:0};
  for(let i=0;i<points.length-1;i++){
   const p=points[i],q=points[i+1];
   const ax=(p.lon-lon)*mlon,ay=(p.lat-lat)*111320;
   const dx=(q.lon-p.lon)*mlon,dy=(q.lat-p.lat)*111320;
   const frac=clamp(-(ax*dx+ay*dy)/(dx*dx+dy*dy||1),0,1);
   const error=Math.hypot(ax+dx*frac,ay+dy*frac);
   if(error<best.distance)best={distance:error,meters:cum[i]+frac*(cum[i+1]-cum[i])};
  }
  return best;
 }
 function getStationInfo(meters,direction="unknown"){
  let lower=0;
  while(lower<stationMeters.length-2&&meters>stationMeters[lower+1])lower++;
  const upper=Math.min(stations.length-1,lower+1);
  const nearest=stationMeters.reduce((best,m,i)=>Math.abs(m-meters)<best.dist?{index:i,dist:Math.abs(m-meters)}:best,
   {index:0,dist:Infinity});
  const next=direction==="toward_motijheel"?upper:direction==="toward_uttara"?lower:null;
  return{
   between:[stations[lower]?.bn||stations[lower]?.n,stations[upper]?.bn||stations[upper]?.n],
   nearest:stations[nearest.index]?.bn||stations[nearest.index]?.n,
   nextStation:next===null?null:(stations[next]?.bn||stations[next]?.n),
   distanceFromNearest:nearest.dist
  };
 }
 function ingest(sample,now=Date.now()){
  // Only observations collected by our explicit one-to-one consent workflow.
  if(!sample||sample.source!=="consenting rider phone")
   return{ok:false,reason:"source not consented rider phone"};
  const {lat,lon,accuracy,time}=sample;
  if(![lat,lon,accuracy,time].every(finite))
   return{ok:false,reason:"missing numeric GPS sample"};
  if(lat<23.70||lat>23.91||lon<90.32||lon>90.46)
   return{ok:false,reason:"outside supported Dhaka MRT-6 region"};
  if(accuracy<=0||accuracy>MAX_ACCURACY)
   return{ok:false,reason:"GPS accuracy insufficient"};
  if(now-time>STALE_MS||time>now+2000)
   return{ok:false,reason:"GPS sample expired or has a future timestamp"};
  const projected=project(lat,lon);
  if(projected.distance>MAX_ROUTE_DISTANCE)
   return{ok:false,reason:"phone GPS not close to mapped MRT-6 route",routeDistance:projected.distance};
  let measuredSpeed=null,direction="unknown";
  if(previous&&time>previous.time){
   const seconds=(time-previous.time)/1000,move=projected.meters-previous.meters;
   if(seconds>=1&&seconds<=30){
    const speed=Math.abs(move)/seconds;
    if(speed>55)return{ok:false,reason:"implausible GPS jump; train identity unverified"};
    if(Math.abs(move)>Math.max(22,accuracy+previous.accuracy)){
     direction=move>=0?"toward_motijheel":"toward_uttara";
     measuredSpeed=clamp(speed*3.6,0,198);
    }else direction=previous.direction||"unknown";
   }
  }
  const data={
   kind:"passenger_phone_observation",source:"consenting rider phone",
   isTrainTelemetry:false,operatorVerified:false,
   lat,lon,time,accuracy,routeDistance:projected.distance,
   metersAlongRoute:projected.meters,direction,observedPhoneSpeedKmh:measuredSpeed,
   ...getStationInfo(projected.meters,direction),
   freshUntil:time+STALE_MS
  };
  previous={time,meters:projected.meters,accuracy,direction};
  last=data;return{ok:true,data};
 }
 function snapshot(now=Date.now()){
  if(!last)return{state:"no_observation",live:false};
  if(last.freshUntil<now)return{state:"stale",live:false};
  return{state:"rider_phone_gps",live:true,...last};
 }
 function clear(){previous=null;last=null}
 return{project,ingest,snapshot,clear,stationMeters,routeLength:cum[cum.length-1]};
}
root.MRT_INDEPENDENT_MONITOR={monitor,STALE_MS,MAX_ACCURACY,MAX_ROUTE_DISTANCE};
})(typeof window!=="undefined"?window:globalThis);
