#!/usr/bin/env node
/** Integrity check of all OSM-based MRT-6 city tiles after generation. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
const raw=readFileSync('data/mrt6-track.js','utf8');
const routeText=raw.split('window.MRT_TRACK=')[1].trim();
const j=JSON.parse(routeText.endsWith(';')?routeText.slice(0,-1):routeText);
const n=j.stations.length;
assert.equal(n,16,'MRT-6 station data changed: inspect tile generation');
const app=readFileSync('app-v2.js','utf8');
const html=readFileSync('index.html','utf8');
assert(html.includes('id="cityCoverage"'),'Wider 3D city coverage button missing');
assert(app.includes('adjacentUrbanTileIndices('),'No multi-tile urban coverage selection');
assert(app.includes('appendAdjacentUrbanTiles(i);'),'Nearby urban meshes are not added on loading');
const manifest=JSON.parse(readFileSync('assets/urban/manifest.json','utf8'));
assert.equal(manifest.models.length,n,'Every station must have an urban model');
let counted=0,totalBytes=0,known=0,details=0;
for(let i=0;i<n;i++){
 const filename='assets/urban/'+i+'.gltf';
 assert(existsSync(filename),'Missing urban tile '+i);
 const model=JSON.parse(readFileSync(filename,'utf8'));
 assert.equal(model.asset.version,'2.0');
 assert(model.buffers[0].uri.startsWith('data:application/octet-stream;base64,'));
 const bytes=Buffer.from(model.buffers[0].uri.split(',')[1],'base64');
 assert.equal(bytes.byteLength,model.buffers[0].byteLength,'glTF binary size mismatch: '+i);
 assert.equal(model.extras.station,i);
 assert(model.extras.license.includes('OpenStreetMap'),'OSM license missing: '+i);
 assert(model.meshes[0].primitives.length>0,'No building mesh primitives: '+i);
 assert(model.extras.buildingFootprints>0,'No mapped buildings in tile '+i);
 if(i===8){
  assert(model.extras.legacyOSMBuildingCandidates>=45,
   'Agargaon 2020 + current OSM footprint fusion did not run');
  assert(model.extras.buildingFootprints>=65,
   'Agargaon 3D still sparse: expected merged OSM neighborhood');
  assert(model.extras.windowPanels>=65,
   'Agargaon 3D individual glass windows / building frames missing');
 }
 assert(model.materials.some(m=>m.name==='ground-floor-shop-glass'),'No storefront material: '+i);
 assert(model.materials.some(m=>m.name==='rooftop-black-water-tank'),'No rooftop material: '+i);
 for(const a of model.accessors){
  if(a.min)assert(a.min.every(Number.isFinite)&&a.max.every(Number.isFinite),'Bad position bounds: '+i);
 }
 counted+=model.extras.buildingFootprints;
 known+=model.extras.knownHeights;
 totalBytes+=statSync(filename).size;
 if(model.meshes[0].primitives.some(p=>p.material>=11))details++;
}
console.log('PASS all',n,'3D urban tiles:',counted,'OSM footprint-derived buildings,',known,
 'heights from data,',details,'tiles with modeled facade/roof details,',
 (totalBytes/1024/1024).toFixed(2),'MB total generated glTF.');
console.log('CAVEAT: coverage is station-centered OSM patches, not a seamless surveyed digital twin.');
