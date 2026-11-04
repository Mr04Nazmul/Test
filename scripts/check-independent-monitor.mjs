#!/usr/bin/env node
// Monitor reproduces the observational *concept* of an ATS display from
// independently obtained, consented GPS — never from protected CBTC controls.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext,Script} from "node:vm";
const js=readFileSync("data/independent-monitor.js","utf8");
const html=readFileSync("index.html","utf8"),app=readFileSync("app-v2.js","utf8");
const ctx={window:{},Math,Date,Number,console};
runInNewContext(readFileSync("data/mrt6-track.js","utf8"),ctx);
runInNewContext(js,ctx);
new Script(app);
const route=ctx.window.MRT_TRACK,lib=ctx.window.MRT_INDEPENDENT_MONITOR;
assert(lib&&route.points.length>100);
const observer=lib.monitor(route),t=Date.now(),s=route.stations[10];
assert.equal(observer.snapshot().state,"no_observation");
const missing=observer.ingest({lat:s.lat,lon:s.lon,time:t,accuracy:8},t);
assert.equal(missing.ok,false,"Untrusted source must not appear as real GPS");
const valid={lat:s.lat,lon:s.lon,time:t,accuracy:8,source:"consenting rider phone"};
const accepted=observer.ingest(valid,t);
assert(accepted.ok,"Actual station GPS must be accepted");
assert.equal(accepted.data.isTrainTelemetry,false);
assert.equal(accepted.data.operatorVerified,false);
assert(accepted.data.routeDistance<45,"Must route match real station geometry");
assert(accepted.data.between.length===2);
assert.equal(observer.snapshot(t).live,true,"Fresh opt-in phone location is live");
assert.equal(observer.snapshot(t+21000).live,false,"GPS stale after 20s");
// Move forward ~40m through the mapped route and allow adequate time.
const p1=route.points[136],p2=route.points[140];
observer.clear();
const a={...valid,lat:p1[0],lon:p1[1],time:t};
const b={...valid,lat:p2[0],lon:p2[1],time:t+12000};
const first=observer.ingest(a,t);
const second=observer.ingest(b,t+12000);
assert(first.ok&&second.ok,"On-route consenting phone updates accepted");
assert(["unknown","toward_motijheel","toward_uttara"].includes(second.data.direction));
assert(!observer.ingest({...valid,lat:23.70,lon:90.43,time:t},t).ok,
 "Off-route phone must not create a train");
assert(!observer.ingest({...valid,time:t-60000},t).ok,"Reject stale external GPS");
assert(!observer.ingest({...valid,accuracy:170},t).ok,"Reject inaccurate GPS");
assert(html.includes('id="independentMonitorStatus"'),"Monitoring status needs a separate field");
assert(html.includes("independent-monitor.js"),"Monitor must load before rendering app");
assert(app.includes("independentMonitor?.ingest(sample)"),"Receiver must use observed GPS monitor");
assert(app.includes("showIndependentMonitor(observation)"),"Route/velocity supervision display unwired");
for(const id of ["opsMonitorBoard","opsOfficialStatus","opsPhoneStatus","opsEstimatedStatus","opsSelectedTrain","opsProgress","opsStationGrid"]){
 assert(html.includes('id="'+id+'"'),"MRT6 operations board element missing: "+id);
 assert(app.includes('$("'+id+'")'),"MRT6 operations board is not wired: "+id);
}
assert(app.includes("function renderOperationsBoard("),"Operations panel updater missing");
assert(app.includes("renderOperationsBoard(info)"),"Train Radar must refresh operations panel");
assert(app.includes("grid.children.length!==st.length"),"Every MRT6 station must be selectable");
assert(app.includes('$("opsOfficialStatus").textContent="NOT CONNECTED"'),
 "Must never fabricate official train-telemetry connection");
assert(app.includes('phone?.source==="consenting rider phone"'),
 "Only consented rider location may count as phone observation");
assert(app.includes('selected.position/(st.length-1)'),
 "Selected timetable train should occupy the real route fraction");
assert(!js.includes("fetch(")&&!js.includes("WebSocket("),
 "Independent monitor must not connect to restricted signalling APIs");
console.log("PASS independent monitoring: route projection, explicit rider consent, direction, stale data, no fake operator GPS.");
