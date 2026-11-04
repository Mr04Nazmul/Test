/* Read-only public GTFS-Realtime VehiclePositions adapter.
 * Configure only a documented, approved CORS-enabled JSON gateway.
 * Never interpret estimates, camera detections, or rider phones as train telemetry.
 */
(function(){
 "use strict";
 const MAX_AGE_MS=90000;
 const listeners=new Set();
 let timer=null,endpoint=null,provider=null;
 const emit=state=>{for(const fn of listeners)try{fn(state)}catch(e){console.warn(e)}};
 function validate(data,now=Date.now()){
  if(!data||!Array.isArray(data.entity))return [];
  const headerTime=Number(data.header?.timestamp)*1000;
  if(!Number.isFinite(headerTime)||headerTime>now+10000||now-headerTime>MAX_AGE_MS)return [];
  return data.entity.flatMap(e=>{
   const v=e.vehicle,p=v?.position,t=Number(v?.timestamp)*1000;
   const lat=Number(p?.latitude),lon=Number(p?.longitude);
   if(!v||!p||!v.trip?.routeId||!/^MRT[-_ ]?6$/i.test(v.trip.routeId))return [];
   if(!v.vehicle?.id||!Number.isFinite(t)||t>now+10000||now-t>MAX_AGE_MS)return [];
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<23.70||lat>23.92||lon<90.30||lon>90.49)return [];
   return [{id:String(v.vehicle.id),lat,lon,timestamp:t,routeId:v.trip.routeId,provider}];
  });
 }
 async function poll(){
  if(!endpoint||!provider)return;
  try{
   const res=await fetch(endpoint,{cache:"no-store",credentials:"omit"});
   if(!res.ok)throw Error("HTTP "+res.status);
   const data=await res.json();
   const vehicles=validate(data);
   emit({status:vehicles.length?"actual":"no-fresh-positions",vehicles,provider,checkedAt:Date.now()});
  }catch(e){emit({status:"unavailable",vehicles:[],provider,error:String(e.message),checkedAt:Date.now()})}
 }
 function configure(options){
  stop();
  if(!options?.approved||!options?.provider||!options?.url)throw Error("Approved provider and documented URL required");
  const url=new URL(options.url,location.href);
  if(url.protocol!=="https:")throw Error("HTTPS required");
  if(url.username||url.password)throw Error("Credentials must not be embedded in URL");
  endpoint=url.href;provider=String(options.provider);
  poll();timer=setInterval(poll,15000);
 }
 function stop(){if(timer)clearInterval(timer);timer=null;endpoint=null;provider=null;emit({status:"not-configured",vehicles:[]})}
 window.MRT_OFFICIAL_VEHICLES={validate,configure,stop,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn)}};
})();
