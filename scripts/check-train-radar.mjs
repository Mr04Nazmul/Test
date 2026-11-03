#!/usr/bin/env node
/** Verify no fake "live GPS" and reliable timetable-driven train radar. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';
const route=readFileSync('data/mrt6-track.js','utf8');
const schedule=readFileSync('data/metro-schedule.js','utf8');
const radarJS=readFileSync('data/train-radar.js','utf8');
const app=readFileSync('app-v2.js','utf8');
const html=readFileSync('index.html','utf8');
const context={window:{},Math,Date,console};
for(const script of [route,schedule,radarJS])runInNewContext(script,context);
const model=context.window.MRT_TRAIN_RADAR,svc=context.window.MRT_SCHEDULE;
assert(model&&svc,'Train radar and published schedule must be loaded');
const before={minute:6*60+10,weekDay:3,date:'2026-11-04',clock:'06:10:00'};
const off=model.snapshot(before);
assert.equal(off.count,0,'Do not claim active trains before first departure');
assert.equal(off.hasLiveGPS,false,'Never label timetable as GPS');
assert.equal(off.nextDeparture.clock,'06:30','Official first Wednesday train');
assert.equal(off.nextDeparture.dir,'south');
const active=model.snapshot({...before,minute:395,clock:'06:35:00'});
assert(active.count>=1,'Show schedules after 06:30');
const first=active.trains.find(x=>x.dir==='south');
assert(first?.segment.includes(' – ')||first?.onStation,'Route segment must show nearby stations');
assert(first?.provenance.includes('GPS নয়'),'Explicit estimate source');
const north=model.snapshot({...before,minute:438,clock:'07:18:00'});
assert(north.trains.some(x=>x.dir==='north'),'Show northbound estimated departures after 07:15');
const routePairs=[...active.trains,...north.trains];
for(const t of routePairs){assert(t.position>=0&&t.position<=15);assert(t.nextStation);assert(t.destination)}
new Script(app);
for(const id of ['trainRadarButton','trainRadarPanel','trainRadarClock','trainRadarCount','trainRadarList','trainRadarClose','trainRadarNearest','trainRadarOverview']){
 assert(html.includes('id="'+id+'"'),'Missing radar control '+id);
 assert(app.includes('$("'+id+'")'),'Radar control not wired '+id);
}
assert(html.includes('train-radar.js'),'Radar engine not included');
assert(!app.includes('mode="demo";updateModeControls();\n   announce("এই মুহূর্তে অনুমিত চালু ট্রেন নেই'),'Automatic fake train mode remains');
assert(app.includes('miniTrains=new Map()'),'Mapped 3D train lead coaches must be visible');
assert(app.includes('for(const coach of trainEntities)coach.show=visible;'),'Train mesh must be hidden off-hours');
assert(app.includes('function findTrain(preferredId=null)'),'Nearby train must be selectable');
assert(app.includes('trainPick.setInputAction'),'Map markers must be clickable');
console.log('PASS 06:10 no live trains; 06:35 and 07:18 inferred; clickable source-labelled 3D train radar.');
