#!/usr/bin/env node
// Verify all station rooftop 3D assets generated for the GitHub Pages build.
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

const index=JSON.parse(readFileSync('assets/rooftops/manifest.json','utf8'));
assert.equal(index.models.length,16,'All 16 MRT station models must be present, including sparse OSM areas');
let genuineTiles=0,triangleCount=0,realFixtureCount=0;
for(let i=0;i<16;i++){
 const path='assets/rooftops/'+i+'.gltf',doc=JSON.parse(readFileSync(path,'utf8'));
 assert.equal(doc.asset.version,'2.0',path+' glTF version');
 assert.equal(doc.extras.station,i,path+' station index');
 assert(doc.extras.attribution.includes('OpenStreetMap'),path+' source attribution');
 assert(doc.meshes[0].primitives.length>0,path+' missing mesh primitives');
 assert(statSync(path).size<7_000_000,path+' unexpectedly large for phone GPU');
 const bytes=Buffer.from(doc.buffers[0].uri.split(',')[1],'base64');
 assert.equal(bytes.length,doc.buffers[0].byteLength,path+' incorrect binary size');
 for(const view of doc.bufferViews)
  assert(view.byteOffset>=0&&view.byteLength>0&&view.byteOffset+view.byteLength<=bytes.length,path+' invalid bufferView');
 for(const a of doc.accessors){
  assert(a.count>0&&Number.isInteger(a.count),path+' invalid accessor count');
  if(a.min)assert(a.min.every(Number.isFinite)&&a.max.every(Number.isFinite),path+' invalid bounds');
 }
 triangleCount+=doc.extras.triangles;
 realFixtureCount+=doc.extras.detailCounts.tank+doc.extras.detailCounts.stair+doc.extras.detailCounts.ac
  +doc.extras.detailCounts.solar+doc.extras.detailCounts.shops;
 if(!doc.extras.noMappedDetails)genuineTiles++;
}
assert(genuineTiles>=8,'Too many missing mapped building areas');
assert(realFixtureCount>80,'Architectural fixture density insufficient');
const app=readFileSync('app-v2.js','utf8');
assert(app.includes('appendBuildingRoofDetails(i);'),'Rooftop assets not connected to the 3D map');
console.log('PASS 16 glTF station roofs,',genuineTiles,'populated,',realFixtureCount,'illustrative fixtures,',triangleCount,'triangles.');
