#!/usr/bin/env node
/* Tests only a synthetic, permission-gated passenger-facing feed. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';
const src=readFileSync('data/operator-live-feed.js','utf8');
const html=readFileSync('index.html','utf8');
const app=readFileSync('app-v2.js','utf8');
new Script(src);new Script(app);
const window={},ctx={window,Date,Number,Math,console,setTimeout,clearTimeout,AbortController};
runInNewContext(src,ctx);
const lib=window.MRT_AUTHORIZED_LIVE_FEED;
assert(lib?.create,'Authorized feed module did not load');
assert.equal(lib.create({enabled:false}).configured,false,'Feed must default off');
assert.equal(lib.create({enabled:true,endpoint:'http://localhost:3000/ctrl',license_url:'https://example.org/permit',provider_id:'operator',source_type:'operator'}).configured,false,'Reject non-HTTPS URL');
const now=Date.now(),sample={vehicle_id:'MRT6-OBS-01',route_id:'MRT-6',
 latitude:23.7590775,longitude:90.3870783,observed_at:new Date(now-2000).toISOString(),
 direction:'south',next_station_id:'Farmgate'};
const opts={enabled:true,endpoint:'https://example.org/authorized-public/vehicles.json',
 license_url:'https://example.org/approved-reuse-policy',provider_id:'licensed-provider',
 source_type:'operator'};
let fetchCalls=0;
const feed=lib.create(opts,{now:()=>now,project:()=>({distance:8}),
 fetch:async(url,options)=>{
  fetchCalls++;
  assert.equal(url,opts.endpoint);
  assert.equal(options.method,'GET');
  assert.equal(options.credentials,'omit');
  assert.equal(options.redirect,'error');
  return{ok:true,json:async()=>({provider_id:opts.provider_id,vehicles:[
   sample,{...sample,vehicle_id:'MRT6-OBS-02',observed_at:new Date(now-100000).toISOString()},
   {...sample,vehicle_id:'MRT6-OBS-03',latitude:25.5},
   {...sample,vehicle_id:'MRT6-OBS-04',route_id:'MRT-7'}]})};
 }});
assert.equal(feed.configured,true);
const got=await feed.poll();
assert.equal(fetchCalls,1);
assert.equal(got.vehicles.length,1,'Only fresh on-route MRT6 observations should appear');
assert.equal(got.vehicles[0].operatorVerified,true);
assert.equal(got.vehicles[0].id,'MRT6-OBS-01');
await feed.poll();assert.equal(fetchCalls,1,'Min poll interval');
const partner=lib.create({...opts,source_type:'licensed_community'});
assert.equal(partner.parse(sample).operatorVerified,false,'Partner cannot impersonate official operator');
assert(!feed.parse({...sample,observed_at:'not-a-date'}));
assert(html.includes('id="authorizedLiveList"'),'Approved live feed list missing');
assert(html.includes('id="opsLicensedStatus"'),'Licensed community source missing');
assert(html.includes('operator-live-feed.js'),'Approved source engine not loaded');
assert(app.includes('approvedLiveFeed?.snapshot()'),'Frontend feed read missing');
assert(app.includes('paintApprovedVehicles()'),'3D approved vehicle markers not wired');
assert(app.includes('renderApprovedVehicleList()'),'Live train list not wired');
assert(app.includes('No metro signalling access.'),'Feed provenance warning missing');
console.log('PASS real observation adapter: approval gate, safe HTTPS public fetch, TTL, route and source checks, 3D wiring.');
