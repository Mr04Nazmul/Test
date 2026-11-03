/* Dhaka Metro Train Radar: timetable-inferred train locations; NOT live GPS.
 * Official source: https://dmtcl.gov.bd/pages/static-pages/6922df5f933eb65569e218ed
 * The train finder never invents a live location or creates fake trains off-hours.
 */
(function(){
 "use strict";
 const schedule=window.MRT_SCHEDULE,route=window.MRT_TRACK;
 if(!schedule||!route)return;
 const stations=route.stations;
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const fmt=index=>(stations[clamp(index,0,stations.length-1)]||{}).bn||"স্টেশন";
 function describe(train){
  const p=clamp(Number(train.position)||0,0,stations.length-1),dir=train.dir;
  const lower=Math.floor(p),upper=Math.min(stations.length-1,lower+1);
  const nearest=Math.round(p),onStation=Math.abs(p-nearest)<.055;
  const next=dir==="north"?Math.max(0,Math.floor(p)):Math.min(stations.length-1,Math.ceil(p));
  const segment=onStation?fmt(nearest):fmt(lower)+" – "+fmt(upper);
  const dest=dir==="south"?fmt(stations.length-1):fmt(0);
  return{
   id:train.id,dir,position:p,nearestStation:fmt(nearest),
   segment,onStation,nextStation:fmt(next),destination:dest,
   directionText:dir==="south"?"মতিঝিলমুখী":"উত্তরামুখী",
   stateText:onStation?"স্টেশন কাছাকাছি":"দুই স্টেশনের মাঝে",
   provenance:"সময়সূচি থেকে আনুমানিক · GPS নয়"
  };
 }
 function nextDeparture(clock=schedule.dhakaClock()){
  const todayType=schedule.dayType(clock.weekDay),candidates=[];
  for(let offset=0;offset<2;offset++){
   const wd=(clock.weekDay+offset)%7,t=schedule.dayType(wd);
   for(const dir of ["south","north"]){
    for(const dep of schedule.departureList(t,dir)){
     const absolute=offset*1440+dep;
     if(absolute<=clock.minute)continue;
     candidates.push({dir,minutes:Math.max(0,absolute-clock.minute),clock:schedule.formatMin(dep),isTomorrow:offset>0,
       origin:dir==="south"?fmt(0):fmt(stations.length-1)});
     break;
    }
   }
  }
  return candidates.sort((a,b)=>a.minutes-b.minutes)[0]||null;
 }
 function snapshot(now=schedule.dhakaClock()){
  const trains=schedule.active(now).map(describe);
  return{
   source:"DMTCL published timetable + original OSM tracks; not live train telemetry",
   quality:"ESTIMATED",hasLiveGPS:false,utcOffset:"+06:00",clock:now.clock,
   date:now.date,trains,nextDeparture:nextDeparture(now),count:trains.length
  };
 }
 window.MRT_TRAIN_RADAR={snapshot,describe,nextDeparture};
})();
