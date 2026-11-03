#!/usr/bin/env node
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const app=readFileSync('app-v2.js','utf8');
const sound=readFileSync('dhaka-soundscape.js','utf8');
const generator=readFileSync('scripts/build-neighborhood-props.mjs','utf8');
const buildings=readFileSync('scripts/build-urban-models.mjs','utf8');
assert(html.includes('id="sound"'),'Missing accessible opt-in Sound button');
assert(html.includes('dhaka-soundscape.js'),'WebAudio module missing');
assert(app.includes('window.DhakaSoundscape'),'Ambient sound toggle not connected');
assert(sound.includes('AudioContext'),'WebAudio synthesizer unavailable');
assert(sound.includes('async function start()'),'Audio context must be user-started');
assert(sound.includes('function stop()'),'Audio mute option missing');
assert(!/autoplay\s*=\s*true/i.test(sound),'Audio must not autoplay');
assert(generator.includes("box('asphalt',side*27.3"),'Colored road surface missing');
assert(generator.includes("box('white',side*27.3"),'Lane marking absent');
assert(buildings.includes('#e6c7b4')&&buildings.includes('#c8d5e6'),'Building color palettes missing');
let roads=0,totalObjects=0;
for(let i=0;i<16;i++){
 const path='assets/nearby/'+i+'.gltf';
 assert(existsSync(path),'Missing local road scene for station '+i);
 const x=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(x.asset.version,'2.0',path);
 assert(x.extras.partCount>100,path);
 assert(x.meshes?.[0]?.primitives?.length>0,path);
 const names=x.materials.map(m=>m.name);
 assert(names.includes('asphalt')&&names.includes('white'),path);
 const bytes=Buffer.from(x.buffers[0].uri.split(',')[1],'base64');
 assert.equal(bytes.length,x.buffers[0].byteLength,path);
 for(const v of x.bufferViews)assert(v.byteOffset+v.byteLength<=bytes.length,path);
 totalObjects+=x.extras.partCount;roads++;
}
console.log('PASS 16 painted Dhaka road neighborhoods ('+totalObjects+' scene components); manually enabled synthetic sound.');
