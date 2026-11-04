/* Original procedural Dhaka MRT-6 streetscape detail, illustrative—not surveyed reality.
 * Additive objects only; existing textured buildings and their colors remain intact.
 */
(function(){
"use strict";
const C=window.Cesium;let viewer,route,objects=[],generation=0;
const color=x=>C.Color.fromCssColorString(x);
function put(pos,box,material,heading=0){if(objects.length>650)return;objects.push(viewer.entities.add({position:pos,orientation:C.Transforms.headingPitchRollQuaternion(pos,new C.HeadingPitchRoll(heading,0,0)),box:{dimensions:new C.Cartesian3(...box),material:color(material),outline:false}}))}
function line(coords,width,material){if(objects.length>650)return;objects.push(viewer.entities.add({polyline:{positions:C.Cartesian3.fromDegreesArrayHeights(coords),width,material:color(material)}}))}
function point(lon,lat,h){return C.Cartesian3.fromDegrees(lon,lat,h)}
function seeded(i){let n=Math.sin(i*127.1+78.233)*43758.5453;return n-Math.floor(n)}
function clear(){generation++;for(const e of objects)viewer.entities.remove(e);objects=[]}
function build(index){
 if(!viewer||!route)return;
 clear();const token=generation,s=route.stations[index];if(!s)return;
 const pts=route.points,near=pts.map((p,i)=>({p,i,d:Math.hypot((p[1]-s.lon)*101000,(p[0]-s.lat)*111000)})).sort((a,b)=>a.d-b.d).slice(0,1)[0];
 if(!near)return;
 const start=Math.max(0,near.i-32),end=Math.min(pts.length-1,near.i+32),step=Math.max(1,Math.ceil((end-start)/48));
 for(let i=start;i<end;i+=step){
  if(token!==generation)return;
  const a=pts[i],b=pts[Math.min(i+step,pts.length-1)];if(!a||!b)continue;
  const lat=(a[0]+b[0])/2,lon=(a[1]+b[1])/2;
  const dx=(b[1]-a[1])*101000,dy=(b[0]-a[0])*111000,length=Math.hypot(dx,dy);
  if(length<0.1)continue;
  const nx=-dy/length,ny=dx/length,heading=Math.atan2(dx,dy);
  // Elevated concrete viaduct: pillars, cap beams, side barriers and underpass lighting.
  if(i%Math.max(2,step*3)===0){
   put(point(lon,lat,7),[2.1,2.1,14],"#aab2b6",heading);
   put(point(lon,lat,14.2),[10.8,2.6,1.4],"#c5cbca",heading);
   put(point(lon,lat,3.4),[3.4,3.4,0.7],"#8b9598",heading);
  }
  for(const side of [-1,1]){
   const edgeLon=lon+nx*side*8/101000,edgeLat=lat+ny*side*8/111000;
   const walkLon=lon+nx*side*13/101000,walkLat=lat+ny*side*13/111000;
   if(i%Math.max(2,step*2)===0){
    // Street lamp poles and warm-white fixtures.
    put(point(walkLon,walkLat,4.1),[.16,.16,8.2],"#737f86",heading);
    put(point(walkLon,walkLat,8.25),[1.5,.4,.22],"#fff2cf",heading);
    // Sidewalk guardrails and planting boxes.
    put(point(edgeLon,edgeLat,.8),[3,.16,1.25],"#b6b9ae",heading);
    put(point(walkLon+nx*side*1.5/101000,walkLat+ny*side*1.5/111000,.6),[2,1.1,1.2],"#b98d68",heading);
    put(point(walkLon+nx*side*1.5/101000,walkLat+ny*side*1.5/111000,1.5),[1.8,1,.6],"#487d45",heading);
   }
   if(i%Math.max(3,step*4)===0){
    // Illustrated street kiosks; do not infer real businesses.
    const k=seeded(i*3+side*71);
    const shopLon=lon+nx*side*24/101000,shopLat=lat+ny*side*24/111000;
    put(point(shopLon,shopLat,2.1),[5.5,4.2,4.2],["#b9a08c","#b5c7c7","#d0b39a","#a9b9c5"][Math.floor(k*4)],heading);
    put(point(shopLon,shopLat,4.45),[6.2,4.8,.45],"#5b6b72",heading);
    put(point(shopLon,shopLat,2.8),[5.1,.12,1.1],"#286c75",heading);
   }
  }
 }
 const el=document.getElementById("streetDetailInfo");
 if(el)el.textContent="Street-level detail ON · illustrative props; original buildings preserved";
}
function init(v,r){viewer=v;route=r}
window.MRT_STREET_DETAILS={init,build,clear};
})();