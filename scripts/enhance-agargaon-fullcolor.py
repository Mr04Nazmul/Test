#!/usr/bin/env python3
"""Improve Agargaon MRT6 GLB with original high-contrast PBR surfaces and Bengali shop/station signs.
Never uses Google Maps extracted geometry or proprietary image data. Road/building positions
inside the cinematic model remain artistic approximations, not an as-built survey.
"""
from pathlib import Path
import random, json
from PIL import Image,ImageDraw,ImageFont,ImageEnhance
import trimesh
from trimesh.visual.material import PBRMaterial
import numpy as np

root=Path(".")
src=root/"assets/cinematic/agargaon-detailed.glb"
dest=root/"assets/cinematic/agargaon-fullcolor-v2.glb"
scene=trimesh.load(str(src),force="scene",process=False)
font_dir=Path("/usr/share/fonts/truetype/noto")
beng=next(iter(font_dir.glob("NotoSansBengali*Regular*.ttf")),None)
if beng is None:beng=next(iter(font_dir.glob("NotoSansBengali*.ttf")),None)
if beng is None:raise RuntimeError("Bengali font missing: install fonts-noto-core")
eng="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

for name,mesh in scene.geometry.items():
 mat=getattr(mesh.visual,"material",None)
 img=getattr(mat,"baseColorTexture",None)
 if img is None:continue
 img=img.convert("RGB").copy()
 dr=ImageDraw.Draw(img,"RGBA"); rng=random.Random(71+sum(map(ord,name)))
 width,height=img.size
 if name.startswith(("plaster","concrete","brick")):
  for k in range(55):
   x=rng.randrange(width);y=rng.randrange(height)
   dr.ellipse((x,y,x+rng.randrange(2,18),y+rng.randrange(9,105)),fill=(32,37,29,rng.randrange(9,39)))
  for k in range(14):
   x=rng.randrange(4,width-4);y=rng.randrange(4,height-4);pts=[(x,y)]
   for j in range(rng.randrange(3,9)):
    x=max(2,min(width-2,x+rng.randrange(-8,9)))
    y=max(2,min(height-2,y+rng.randrange(4,18)));pts.append((x,y))
   dr.line(pts,fill=(30,40,40,rng.randrange(15,54)),width=1)
 elif name.startswith("roof_"):
  for xx in range(0,width,15):
   dr.line((xx,0,xx,height),fill=(175,203,187,35),width=2)
   if xx%45==0:
    for yy in range(12,height,53):dr.ellipse((xx-1,yy-1,xx+2,yy+2),fill=(23,51,42,120))
 elif name in ("asphalt","asphalt_light","curb"):
  for k in range(60):
   x=rng.randrange(width);y=rng.randrange(height)
   dr.line([(x,y),(min(width-1,x+rng.randrange(2,11)),min(height-1,y+rng.randrange(4,22)))],fill=(17,25,29,70),width=1)
 elif name.startswith("glass"):
  for xx in range(0,width,46):
   dr.line((xx,0,xx,height),fill=(8,20,26,24),width=2)
   dr.line((xx+7,0,xx+33,height),fill=(218,238,245,25),width=2)
 elif name.startswith("leaf"):
  for k in range(200):
   x=rng.randrange(width);y=rng.randrange(height)
   dr.ellipse((x,y,x+rng.randrange(1,5),y+rng.randrange(1,5)),fill=(155,205,81,rng.randrange(12,60)))
 if name in ("train_green","train_red","roof_green","glass","glass_light"):
  img=ImageEnhance.Color(img).enhance(1.23)
  img=ImageEnhance.Brightness(img).enhance(1.09)
 else:
  img=ImageEnhance.Contrast(img).enhance(1.1)
 mat.baseColorTexture=img

def make_sign(bg,bangla,english):
 img=Image.new("RGBA",(1024,256),bg);dr=ImageDraw.Draw(img)
 dr.rectangle((5,5,1018,250),outline=(235,234,224),width=6)
 dr.text((39,10),bangla,font=ImageFont.truetype(str(beng),98),fill=(249,248,240),language="bn")
 dr.text((44,170),english,font=ImageFont.truetype(eng,42),fill=(249,248,240))
 return img.convert("RGB")

def add_vertical_sign(x,cy,cz,width,height,img,name):
 za=cz-width/2;zb=cz+width/2;ya=cy-height/2;yb=cy+height/2
 v=np.array([[x,ya,za],[x,ya,zb],[x,yb,zb],[x,yb,za]],dtype=float)
 mesh=trimesh.Trimesh(vertices=v,faces=[[0,1,2],[0,2,3],[2,1,0],[3,2,0]],process=False)
 mesh.visual=trimesh.visual.TextureVisuals(
   uv=np.array([[0,0],[1,0],[1,1],[0,1]]),
   material=PBRMaterial(name=name,baseColorTexture=img,doubleSided=True,
                        roughnessFactor=.74,metallicFactor=.03))
 scene.add_geometry(mesh,geom_name=name,node_name=name)

station=make_sign((18,110,76),"আগারগাঁও","AGARGAON • MRT LINE 6")
for x in [-18.63,18.63]:
 add_vertical_sign(x,22.4,61,15.3,3.8,station,"Agargaon signed architectural facade "+str(x))
shops=[
 ((17,84,116),"মোবাইল সার্ভিস","MOBILE & REPAIR"),
 ((157,49,49),"ফার্মেসি","PHARMACY"),
 ((13,99,73),"ঢাকা স্টোর","DHAKA STORE"),
 ((30,66,132),"ইলেকট্রনিক্স","ELECTRONICS"),
 ((154,109,18),"চা ও নাস্তা","TEA & SNACKS"),
 ((67,67,73),"সুপার শপ","MINI MARKET")]
for side in [-1,1]:
 for k in range(12):
  bg,bengali,english=shops[(k+int(side>0))%len(shops)]
  add_vertical_sign(side*46.9,4.5,-226+k*39,5.8,1.55,
      make_sign(bg,bengali,english),"Bangladesh shop 3D sign "+str(side)+"-"+str(k))
dest.parent.mkdir(parents=True,exist_ok=True)
scene.export(dest)
report={"model":dest.name,"size_bytes":dest.stat().st_size,
        "mesh_groups":len(scene.geometry),
        "shop_signs":24,"station_signs":2,
        "accuracy":"Original detailed textured 3D reconstruction, not geosur­veyed or identical to photos"}
(root/"assets/cinematic/fullcolor-v2-manifest.json").write_text(json.dumps(report,indent=2))
print(json.dumps(report))
if len(scene.geometry)<60 or dest.stat().st_size<35_000_000:
 raise RuntimeError("High-detail asset was not correctly produced")
