/* MRT Line 6 timetable-based estimation. NOT live GPS or authoritative arrival information.
Terminal first/last and headways based on DMTCL 2026 schedule:
https://dmtcl.gov.bd/pages/static-pages/6922df5f933eb65569e218ed
Individual station running durations and dwell estimates are approximations. */
(function(){
 const SEGS=[3,2,3,2,2,3,2,3,2,3,2,2,2,3,3], DWELL=0.42;
 const minutes=s=>{const [h,m]=s.split(":").map(Number);return h*60+m};
 const bands=arr=>arr.map(([e,h])=>({end:minutes(e),every:h}));
 const DAYS={
  weekday:{
   south:{start:"06:30",end:"21:50",bands:bands([["07:10",20],["07:30",10],["08:10",8],["09:50",6],["16:22",8],["19:18",6],["19:58",8],["21:00",10],["21:30",15],["21:50",20]])},
   north:{start:"07:15",end:"22:30",bands:bands([["07:30",15],["08:10",10],["08:48",8],["10:29",6],["17:01",8],["19:57",6],["20:20",8],["21:40",10],["22:10",15],["22:30",20]])}
  },
  saturday:{
   south:{start:"06:30",end:"21:50",bands:bands([["07:25",20],["07:49",12],["09:49",10],["19:25",8],["21:00",10],["21:30",15],["21:50",20]])},
   north:{start:"07:15",end:"22:30",bands:bands([["07:30",15],["08:00",12],["08:24",10],["20:00",8],["21:40",10],["22:10",15],["22:30",20]])}
  },
  friday:{
   south:{start:"15:00",end:"21:50",bands:bands([["19:56",8],["21:00",10],["21:30",15],["21:50",20]])},
   north:{start:"15:20",end:"22:30",bands:bands([["20:31",8],["21:40",10],["22:10",15],["22:30",20]])}
  }
 };
 const depCache={};
 const to2=n=>String(n).padStart(2,"0");
 const formatMin=t=>to2(Math.floor((t%1440)/60))+":"+to2(Math.floor(t%60));
 const dhakaClock=()=>{
  const d=new Date(Date.now()+6*60*60*1000);
  return {minute:d.getUTCHours()*60+d.getUTCMinutes()+d.getUTCSeconds()/60+d.getUTCMilliseconds()/60000,weekDay:d.getUTCDay(),date:d.toISOString().slice(0,10),clock:d.toISOString().slice(11,19)};
 };
 const dayType=d=>d===5?"friday":d===6?"saturday":"weekday";
 function departureList(type,dir){
  const key=type+"-"+dir;if(depCache[key])return depCache[key];
  const cfg=DAYS[type][dir],first=minutes(cfg.start),last=minutes(cfg.end),deps=[];
  let t=first,guard=0;
  while(t<=last&&guard++<500){
   deps.push(t);
   const b=cfg.bands.find(x=>t<=x.end)||cfg.bands[cfg.bands.length-1];
   t+=b.every;
  }
  if(deps[deps.length-1]!==last)deps.push(last);
  return depCache[key]=deps;
 }
 const southOffsets=[0];
 SEGS.forEach((t,i)=>southOffsets.push(southOffsets[southOffsets.length-1]+t+(i<SEGS.length-1?DWELL:0)));
 const total=southOffsets[southOffsets.length-1];
 function elapsedToPosition(elapsed,dir){
  const times=dir==="south"?southOffsets:southOffsets.map(v=>total-v).reverse();
  let idx=0;while(idx<15&&elapsed>times[idx+1])idx++;
  if(idx>=15)return dir==="south"?15:0;
  const at=(elapsed-times[idx]),duration=times[idx+1]-times[idx],stop=idx<14?DWELL:0;
  const run=Math.max(.01,duration-stop);
  const f=at>=run?1:Math.max(0,at/run);
  const eased=f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2;
  return dir==="south"?idx+eased:15-idx-eased;
 }
 function active(now=dhakaClock()){
  const type=dayType(now.weekDay);
  const trains=[];
  for(const dir of ["south","north"]){
   for(const dep of departureList(type,dir)){
    const elapsed=now.minute-dep;
    if(elapsed<0||elapsed>total)continue;
    trains.push({id:(dir==="south"?"S":"N")+formatMin(dep),dir,departure:dep,elapsed,position:elapsedToPosition(elapsed,dir),minutesRemaining:total-elapsed});
   }
  }
  return trains.sort((a,b)=>a.departure-b.departure).slice(0,20);
 }
 function arrivals(index, now=dhakaClock()){
  const type=dayType(now.weekDay),rows=[];
  for(const dir of ["south","north"]){
   const offset=dir==="south"?southOffsets[index]:total-southOffsets[index];
   for(const dep of departureList(type,dir)){
    const at=dep+offset,delta=at-now.minute;
    if(delta>=-.25)rows.push({dir,inMinutes:Math.max(0,delta),at,clock:formatMin(at)});
   }
  }
  return rows.sort((a,b)=>a.inMinutes-b.inMinutes).slice(0,6);
 }
 // Sample any scheduled train at the CURRENT fractional minute (including seconds).
 // Unlike one-second marker polling, this stays continuous on every animation frame.
 function positionFor(trainId, now=dhakaClock()){
  const match=/^([SN])(\\d{2}):(\\d{2})$/.exec(String(trainId||""));
  if(!match)return null;
  const dir=match[1]==="S"?"south":"north";
  const dep=Number(match[2])*60+Number(match[3]);
  const elapsed=now.minute-dep;
  if(elapsed<0||elapsed>total)return null;
  return {dir,position:elapsedToPosition(elapsed,dir),elapsed};
 }
 window.MRT_SCHEDULE={active,positionFor,arrivals,dhakaClock,dayType,total,departureList,DAYS,formatMin,source:"DMTCL official 2026 schedule; intermediary times are estimated, not verified live"};
})();
