#!/usr/bin/env node
/** No browser/autoplay needed: validate audio zone state and UI integrations. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext,Script} from "node:vm";
const js=readFileSync("dhaka-soundscape.js","utf8");
const ui=readFileSync("index.html","utf8");
const app=readFileSync("app-v2.js","utf8");
new Script(js);
const handlers={};
const context={
 window:{addEventListener(){}},
 document:{addEventListener(name,fn){handlers[name]=fn},dispatchEvent(){}},
 console,Math,Number,Date,setTimeout,clearTimeout,CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail}}
};
runInNewContext(js,context);
const eng=context.window.DhakaSoundscape;
assert(eng,"DhakaSoundscape missing");
assert.equal(eng.active,false,"Autoplay must stay disabled");
assert.equal(eng.requestedZone,"auto");
assert.equal(eng.recordedEnabled,false);
eng.setZone("platform");
assert.equal(eng.zone,"platform");
eng.setZone("train");
assert.equal(eng.zone,"train");
eng.setZone("roof");
assert.equal(eng.zone,"roof");
eng.setZone("auto");
eng.updateScene({height:21,distance:40,following:false,station:13});
assert.equal(eng.zone,"platform");
eng.updateScene({height:7,distance:43,following:false});
assert.equal(eng.zone,"hall");
eng.updateScene({height:57,distance:40,following:false});
assert.equal(eng.zone,"roof");
eng.updateScene({height:180,distance:380,following:false});
assert.equal(eng.zone,"street");
eng.updateScene({height:160,distance:230,following:true});
assert.equal(eng.zone,"track");
for(const id of ["sound","soundOptions","soundPanel","soundZone","soundVolume","recordedRail","demoPA"])
 assert(ui.includes('id="'+id+'"'),"Missing audio control "+id);
assert(app.includes('updateSoundCamera(t);'),"Camera-aware audio mix is not updated");
assert(app.includes('engine.updateScene({'),"Audio update must follow 3D camera");
assert(app.includes('engine.useRecordedTrain'),"External field recording must be opt-in");
assert(ui.includes('orangefreesounds.com/train-sound-effect'),"Recorded sample CC BY credit missing");
assert(!/autoplay\\s*=\\s*true/i.test(js),"No sound may autoplay");
console.log("PASS synthetic Dhaka 3D spatial audio zones, opt-in recorded clip, iPhone UI, silent default.");
