/* Dhaka MRT-6 HD detailing: modeled catenary, viaduct fascia, barriers and streetlights.
 * Inspired by official 1500V DC overhead electrical system & 1435mm dual-track specification.
 * Geometry/locations are schematic, not operator engineering survey data.
 * © OpenStreetMap contributors for georeferenced centerline.
 */
import * as THREE from "three";
export function installHDInfrastructure({scene,trackAt,length,mobile,chunkSize=450}) {
  const groups=[];
  const poleMat=new THREE.MeshStandardMaterial({color:"#75888c",metalness:.55,roughness:.48});
  const wireMat=new THREE.LineBasicMaterial({color:"#5d5043",transparent:false});
  const fasciaMat=new THREE.MeshStandardMaterial({color:"#88969c",metalness:.06,roughness:.93,side:THREE.DoubleSide});
  const barrierMat=new THREE.MeshStandardMaterial({color:"#d5dddd",roughness:.76,side:THREE.DoubleSide});
  const roadLight=new THREE.MeshStandardMaterial({color:"#e7dfc2",emissive:"#ddd29e",emissiveIntensity:.5});
  const mastGeo=new THREE.CylinderGeometry(.11,.17,7.4,6);
  const crossGeo=new THREE.BoxGeometry(.14,.14,3.55);
  const bulbGeo=new THREE.SphereGeometry(.26,6,4);
  const lampGeo=new THREE.CylinderGeometry(.085,.11,8,6);
  const object=new THREE.Object3D();
  function localFrame(m,side,lateral,height){
    const p=trackAt(m),n=new THREE.Vector3(p.t.z,0,-p.t.x);
    return {p:p.p.clone().addScaledVector(n,side*lateral).add(new THREE.Vector3(0,height,0)),t:p.t,n};
  }
  function addQuad(a,b,c,d,arr){
    arr.push(...a,...b,...c,...a,...c,...d);
  }
  function wireSegment(out,part,side,y,sag,offset){
    const n=10;
    for(let j=0;j<n;j++){
      const a=part[0]+(part[1]-part[0])*j/n,b=part[0]+(part[1]-part[0])*(j+1)/n;
      for(const m of [a,b]){
        const f=localFrame(m,side,2.3+offset,y-sag*Math.sin(Math.PI*(m-part[0])/(part[1]-part[0])));
        out.push(f.p.x,f.p.y,f.p.z);
      }
    }
  }
  for(let begin=0;begin<length;begin+=chunkSize){
    const end=Math.min(begin+chunkSize,length),group=new THREE.Group(),outline=[],parapet=[],wire=[];
    // Two rail tracks and a street-level road. The viaduct has structural side faces.
    for(let m=begin;m<end;m+=10){
      const a=trackAt(m),b=trackAt(Math.min(end,m+10));
      for(const side of [-1,1]){
        const n1=new THREE.Vector3(a.t.z,0,-a.t.x),n2=new THREE.Vector3(b.t.z,0,-b.t.x);
        const pa=a.p.clone().addScaledVector(n1,side*5.8),pb=b.p.clone().addScaledVector(n2,side*5.8);
        addQuad([pa.x,17.8,pa.z],[pb.x,17.8,pb.z],[pb.x,20.1,pb.z],[pa.x,20.1,pa.z],outline);
        const ba=a.p.clone().addScaledVector(n1,side*5.65),bb=b.p.clone().addScaledVector(n2,side*5.65);
        addQuad([ba.x,20.1,ba.z],[bb.x,20.1,bb.z],[bb.x,21.15,bb.z],[ba.x,21.15,ba.z],parapet);
      }
    }
    const baseGeom=new THREE.BufferGeometry();
    baseGeom.setAttribute("position",new THREE.Float32BufferAttribute(outline,3));baseGeom.computeVertexNormals();
    group.add(new THREE.Mesh(baseGeom,fasciaMat));
    const wallGeom=new THREE.BufferGeometry();
    wallGeom.setAttribute("position",new THREE.Float32BufferAttribute(parapet,3));wallGeom.computeVertexNormals();
    group.add(new THREE.Mesh(wallGeom,barrierMat));
    const mastList=[],armList=[],streetList=[],bulbList=[];
    // Real MRT-6 uses overhead contact wires. This sag/droppers layout is illustrative.
    for(let m=begin;m<end;m+=45){
      const finish=Math.min(m+45,length,end);
      if(finish-m<3)break;
      for(const side of [-1,1]){
        const base=localFrame(m,side,5.3,0);
        mastList.push([base.p.x,23.9,base.p.z]);
        const center=localFrame(m,side,3.55,27.45);
        armList.push([center.p.x,center.p.y,center.p.z,
          Math.atan2(base.n.x,base.n.z)]);
        // Contact (5.4m above rail) and upper messenger suspended by droppers.
        wireSegment(wire,[m,finish],side,25.61,.07,0);
        wireSegment(wire,[m,finish],side,27.30,.35,0);
        // Overhead droppers, not track signal lines.
        for(let t=m+9;t<finish;t+=9){
          const f1=localFrame(t,side,2.3,25.57),f2=localFrame(t,side,2.3,27.10);
          wire.push(...f1.p.toArray(),...f2.p.toArray());
        }
      }
      if(Math.floor(m/45)%2===0){
        for(const side of [-1,1]){
          const lamp=localFrame(m,side,18.4,0);
          streetList.push([lamp.p.x,4,lamp.p.z]);
          const cap=localFrame(m,side,18.4,8.05);
          bulbList.push([cap.p.x,cap.p.y,cap.p.z]);
        }
      }
    }
    function instanced(geo,mat,list,callback){
      const obj=new THREE.InstancedMesh(geo,mat,list.length);
      list.forEach((d,i)=>{
        const o=new THREE.Object3D();callback(o,d);o.updateMatrix();obj.setMatrixAt(i,o.matrix);
      });obj.instanceMatrix.needsUpdate=true;obj.frustumCulled=false;group.add(obj);
    }
    instanced(mastGeo,poleMat,mastList,(o,d)=>{o.position.set(...d)});
    instanced(crossGeo,poleMat,armList,(o,d)=>{
      o.position.set(d[0],d[1],d[2]);
      // Box length follows the lateral route-normal direction.
      o.rotation.y=d[3];
    });
    instanced(lampGeo,poleMat,streetList,(o,d)=>{o.position.set(...d)});
    instanced(bulbGeo,roadLight,bulbList,(o,d)=>{o.position.set(...d)});
    const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(wire,3));
    group.add(new THREE.LineSegments(g,wireMat));
    scene.add(group);groups.push({center:(begin+end)/2,group});
  }
  return {
    update(meters,range=1600){
      for(const c of groups)c.group.visible=Math.abs(c.center-meters)<range;
    },
    groups
  };
}
