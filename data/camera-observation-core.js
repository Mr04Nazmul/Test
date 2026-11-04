/* Source-labelled, short-lived sightings from a separately permitted camera.
 * User-confirmed event at a known station, not train GPS or operator ATS.
 * This file does not collect images, phone coordinates, or personal identifiers.
 */
(function(root){
"use strict";
const MAX_AGE_MS=90000, MAX_FUTURE_MS=3000, MIN_CONFIDENCE=0.45;
const methods=["human-confirmed","human-confirmed-ai-candidate","human-confirmed-sensor"];
const sources=["browser-camera","railwatch-compatible","trainbot-compatible","rails49-compatible"];
const isNum=v=>typeof v==="number"&&Number.isFinite(v);
function create(stations){
 if(!Array.isArray(stations)||stations.length<2)throw Error("Rail stations required");
 const seen=new Map();let lastEvent=null;
 function validate(raw,now=Date.now()){
  if(!raw||raw.kind!=="mrt6-camera-passage")return {ok:false,reason:"not a camera passage"};
  if(!Number.isInteger(raw.stationIndex)||raw.stationIndex<0||raw.stationIndex>=stations.length)
   return {ok:false,reason:"unmapped station"};
  if(!isNum(raw.time)||raw.time<now-MAX_AGE_MS||raw.time>now+MAX_FUTURE_MS)
   return {ok:false,reason:"stale or future observation"};
  if(!methods.includes(raw.method)||!sources.includes(raw.source))
   return {ok:false,reason:"needs explicit human confirmation and a labelled source"};
  if(!/^[a-z0-9-]{6,48}$/.test(raw.eventId||""))
   return {ok:false,reason:"invalid event id"};
  if(raw.confidence!==null&&raw.confidence!==undefined&&
     (!isNum(raw.confidence)||raw.confidence<MIN_CONFIDENCE||raw.confidence>1))
   return {ok:false,reason:"invalid AI confidence"};
  const station=stations[raw.stationIndex];
  if(!isNum(station.lat)||!isNum(station.lon))return{ok:false,reason:"invalid mapped station"};
  const normalized={
   kind:"mrt6-camera-passage",eventId:raw.eventId,source:raw.source,
   stationIndex:raw.stationIndex,stationName:station.bn||station.n,
   lat:station.lat,lon:station.lon,time:raw.time,
   method:raw.method,confidence:raw.confidence??null,
   expires:raw.time+MAX_AGE_MS,sourceType:"consenting-camera-witness",
   isOfficialTrainTelemetry:false,isGps:false,
   note:"Self-reported station-side camera observation; physical location and train identity not independently verified"
  };
  return {ok:true,data:normalized};
 }
 function ingest(raw,now=Date.now()){
  for(const [id,expiry] of seen)if(expiry<now)seen.delete(id);
  const checked=validate(raw,now);if(!checked.ok)return checked;
  if(seen.has(raw.eventId))return{ok:false,reason:"duplicate event"};
  seen.set(raw.eventId,checked.data.expires);lastEvent=checked.data;
  return checked;
 }
 function latest(now=Date.now()){
  return lastEvent&&lastEvent.expires>=now?lastEvent:null;
 }
 return {validate,ingest,latest,MAX_AGE_MS};
}
root.MRT_CAMERA_OBSERVATIONS={create,MAX_AGE_MS,methods,sources};
})(typeof window!=="undefined"?window:globalThis);
