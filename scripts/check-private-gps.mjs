#!/usr/bin/env node
/** Test private opt-in rider GPS design, data freshness and connection controls. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';
const src=readFileSync('live-rider-p2p.js','utf8');
const html=readFileSync('index.html','utf8');
const rider=readFileSync('share-live.html','utf8');
const app=readFileSync('app-v2.js','utf8');
new Script(src);new Script(app);
const document={
 addEventListener(){},createElement(){throw Error('No external PeerJS request may happen at startup')},
};
const window={addEventListener(){}};
runInNewContext(src,{window,document,Math,Number,Date,console,Uint8Array});
const p=window.MRT_RIDER_P2P;
assert(p,'Private GPS module failed to initialize');
assert.equal(p.state,'idle','Location sharing must be off by default');
assert.equal(p.senderState,'idle','Rider must opt in');
const now=Date.now(),good={kind:'mrt6-rider-location',onBoard:true,
 lat:23.7591,lon:90.3871,accuracy:15,time:now,speed:6.5};
assert.equal(p.validMessage(good,now),true,'Plausible fresh consented rider position');
assert.equal(p.validMessage({...good,time:now-21000},now),false,'Reject stale rider GPS');
assert.equal(p.validMessage({...good,lat:35},now),false,'Reject out-of-Dhaka GPS');
assert.equal(p.validMessage({...good,accuracy:999},now),false,'Reject extremely inaccurate GPS');
assert.equal(p.validMessage({...good,onBoard:false},now),false,'Require explicit self-reported onboard consent');
for(const id of ['riderGPSButton','riderGPSPanel','riderGPSStart','riderGPSInvite','riderGPSLink',
 'riderGPSCopy','riderGPSStatus','riderGPSFollow','riderGPSStop','riderGPSClose']){
 assert(html.includes('id="'+id+'"'),'Missing privacy-sensitive viewer control '+id);
 assert(app.includes('$("'+id+'")'),'Unwired viewer control '+id);
}
assert(rider.includes('id="consent"'),'Onboard passenger consent checkbox missing');
assert(rider.includes('id="start" disabled'),'GPS must be off until consent');
assert(rider.includes('id="stop"'),'Rider must be able to stop GPS sharing');
assert(src.includes("location.hash")===false,"Invite hash is parsed only on the passenger sharing page");
assert(src.includes('link.hash="watch="'),'Invite secret should not appear in HTTP query or logs');
assert(src.includes('if(document.hidden&&senderState==="sharing")stopShare()'),
 'Stop sharing when sender tab hidden');
assert(app.includes('updateRiderGPSFreshness();'),'Viewer must expire stale location');
assert(app.includes('sample.accuracy>80'),'Viewer should reject low-precision samples');
assert(app.includes('match.distance>130'),'Viewer must reject off-route phone data');
assert(app.includes('NOT TRAIN TELEMETRY'),'Never impersonate vehicle GPS');
console.log('PASS no automatic location tracking; 20s TTL, rider consent, private invite, route and accuracy filtering.');
