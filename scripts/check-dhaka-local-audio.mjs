#!/usr/bin/env node
// Check that generated local sound files really contain audible PCM, not silence.
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const zones=["street","hall","platform","track","train","roof"];
for(const z of zones){
 const f="assets/audio/"+z+".wav",bytes=readFileSync(f);
 assert(bytes.length>200000,f+" unexpectedly empty/short");
 assert.equal(bytes.toString("ascii",0,4),"RIFF",f);
 assert.equal(bytes.toString("ascii",8,12),"WAVE",f);
 assert.equal(bytes.readUInt16LE(20),1,f);
 assert.equal(bytes.readUInt16LE(22),1,f);
 assert.equal(bytes.readUInt32LE(24),22050,f);
 let max=0,total=0,n=0;
 for(let i=44;i<bytes.length;i+=2){
  const amp=bytes.readInt16LE(i)/32768;
  max=Math.max(max,Math.abs(amp));total+=amp*amp;n++;
 }
 const rms=Math.sqrt(total/Math.max(1,n));
 assert(max>.2&&rms>.045,f+" too quiet on phone: peak "+max+", rms "+rms);
 console.log(z,":",statSync(f).size,"bytes, peak",max.toFixed(3),"RMS",rms.toFixed(3));
}
const engine=readFileSync("dhaka-soundscape.js","utf8");
const html=readFileSync("index.html","utf8");
const app=readFileSync("app-v2.js","utf8");
assert(engine.includes('syncLocalSample();\n  try{await ctx.resume()'),"iPhone user gesture unlock missing");
assert(engine.includes("media.play()"),"Native iPhone HTMLAudioElement playback missing");
assert(engine.includes("playTestSound()"),"Immediate sound diagnostic missing");
assert(html.includes('id="soundTest"'),"Visible sound test button missing");
assert(app.includes('$("soundTest").addEventListener'),"Sound test button not wired");
console.log("PASS local six-zone iPhone sound is self-hosted, measurable and user-triggered.");
