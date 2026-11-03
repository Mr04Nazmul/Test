// Deployment smoke tests: static markup, smooth train sampler and UI contract.
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';

const html=readFileSync('index.html','utf8');
const app=readFileSync('app-v2.js','utf8');
const sched=readFileSync('data/metro-schedule.js','utf8');
const ctx={window:{},Date,Math,console};
runInNewContext(sched,ctx);
const service=ctx.window.MRT_SCHEDULE;
assert.equal(typeof service.positionFor,'function','Frame-level train samples unavailable');
const id='S06:30',north='N07:15';
const a=service.positionFor(id,{minute:391,weekDay:3});
const b=service.positionFor(id,{minute:391.016,weekDay:3});
assert(a&&b,'Schedule train IDs must match');
assert(b.position>a.position,'Southbound train must move smoothly between fractional-time samples');
const c=service.positionFor(north,{minute:437,weekDay:3});
const d=service.positionFor(north,{minute:437.016,weekDay:3});
assert(c&&d&&d.position<c.position,'Northbound direction must move toward Uttara');
assert.equal(service.positionFor('BAD_TRAIN_ID'),null);
const ui=['camMode','orbitLeft','orbitRight','zoomIn','zoomOut','quality','follow','satellite','myGPS','google'];
for(const id of ui){
 assert(html.includes('id="'+id+'"'),'Missing 3D control: '+id);
 assert(app.includes('$("'+id+'")'),'3D control not wired: '+id);
}
assert(app.includes('renderCoachSet(dt);'),'Train should animate on every frame');
assert(app.includes('updateFollowCamera();'),'Following camera not animated');
assert(app.includes('World_Transportation/MapServer'),'Real street/road overlay absent');
assert(app.includes('assets/urban/'),'OSM building glTF loading missing');
assert(app.includes('assets/farmgate-landmark.gltf'),'Farmgate landmark is not linked in app');
assert(html.includes('id="agargaon"'),'Agargaon station quick camera button missing');
assert(app.includes('$("agargaon").addEventListener'),'Agargaon button is not functional');
assert(app.includes('assets/agargaon-station.gltf'),'Dedicated Agargaon station model is not loaded');
assert(html.includes('id="dayNight"'),'Day/night UI is missing');
assert(app.includes('$("dayNight").addEventListener'),'Day/night UI is not connected');
assert(html.includes('NOT GPS'),'Simulated data must not be labelled as official GPS');
const trafficBuilder=readFileSync('scripts/build-dhaka-traffic.mjs','utf8');
assert(app.includes('"assets/dhaka-"+kind+".gltf"'),'Dynamic Dhaka vehicle asset loader missing');
for(const vehicle of ['bus','rickshaw','car'])
 assert(trafficBuilder.includes("model('dhaka-"+vehicle+"'"),'Missing '+vehicle+' model generator');
assert(app.includes('animateStreetTraffic(dt);'),'Street traffic must animate every frame');
console.log('PASS smooth train samples, route camera hooks, 360°/zoom/quality controls and map-source accuracy.');
