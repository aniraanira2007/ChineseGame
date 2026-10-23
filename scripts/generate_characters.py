"""Generate small, original, rigged Little Lantern anime-style GLB avatars.

The source geometry is deliberately low-poly and assembled from custom mesh
primitives; no third-party character IP or downloaded assets are used.
"""
import json, math, os, struct, zlib

ROOT = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "models", "characters")
os.makedirs(ROOT, exist_ok=True)

CHARACTERS = [
    {"id":"sakura-street","name":"Lantern Scholar","gender":"Female","outfit":"Teal Traveler Coat","hair":"#76513f","cloth":"#3d7784","cloth2":"#b8d5d7","pants":"#292a35","shoe":"#493a37","hairStyle":"twin","bottom":"skirt","accessory":"pouch","ribbon":"#bd6556"},
    {"id":"kai-blue","name":"Kai Blue","gender":"Male","outfit":"Skyline Bomber","hair":"#385a88","cloth":"#427fb2","cloth2":"#eaf6ff","pants":"#3e5268","shoe":"#f2f7fb","hairStyle":"short","bottom":"pants","accessory":"headphones"},
    {"id":"violet-atelier","name":"Violet Atelier","gender":"Female","outfit":"Iris Layered Dress","hair":"#493261","cloth":"#8157a2","cloth2":"#e8c8f5","pants":"#684883","shoe":"#49374e","hairStyle":"long","bottom":"dress","accessory":"beret"},
    {"id":"juniper-tech","name":"Juniper Tech","gender":"Male","outfit":"Forest Runner Set","hair":"#252b30","cloth":"#2c423e","cloth2":"#a8e27e","pants":"#293633","shoe":"#b9e984","hairStyle":"spike","bottom":"pants","accessory":"visor"},
]

def rgba(hex_color):
    h=hex_color.lstrip('#'); return [int(h[i:i+2],16)/255 for i in (0,2,4)] + [1]

def sphere(center, scale, material, joint, seg=24, rings=16):
    cx,cy,cz=center; rx,ry,rz=scale; v=[]; n=[]; idx=[]
    for iy in range(rings+1):
        p=math.pi*iy/rings
        for ix in range(seg+1):
            t=2*math.pi*ix/seg
            nx=math.sin(p)*math.cos(t); ny=math.cos(p); nz=math.sin(p)*math.sin(t)
            v.extend([cx+rx*nx,cy+ry*ny,cz+rz*nz]); n.extend([nx/max(rx,1e-5),ny/max(ry,1e-5),nz/max(rz,1e-5)])
    for iy in range(rings):
        for ix in range(seg):
            a=iy*(seg+1)+ix; b=a+seg+1; idx.extend([a,a+1,b,b,a+1,b+1])
    return part(v,n,idx,material,joint)

def part(pos,norm,indices,material,joint):
    xs=pos[0::3]; ys=pos[1::3]; minx,maxx=min(xs),max(xs); miny,maxy=min(ys),max(ys)
    dx=max(maxx-minx,1e-5); dy=max(maxy-miny,1e-5)
    uv=[]
    for x,y in zip(xs,ys): uv.extend([(x-minx)/dx,(y-miny)/dy])
    return {"p":pos,"n":norm,"uv":uv,"i":indices,"m":material,"j":joint}

def png_chunk(kind, data):
    body=kind+data
    return struct.pack('>I',len(data))+body+struct.pack('>I',zlib.crc32(body)&0xffffffff)

def material_texture(kind, size=96):
    """Compact seamless neutral albedo texture; glTF material color supplies palette."""
    rows=[]
    for y in range(size):
        row=bytearray([0])
        for x in range(size):
            wave=math.sin(x*1.7+y*.08)*1.3+math.sin(y*2.2+x*.04)*1.1
            fiber=0
            if kind in ("cloth","cloth2","pants","shoe","trim"):
                fiber=2.0 if (x+y*2)%19==0 else (-1.4 if (x-y)%23==0 else 0)
            elif kind in ("hair","hair-light"):
                fiber=2.8*math.sin(x*.45+y*.13)
            elif kind=="skin":
                fiber=1.0*math.sin(x*.18)*math.sin(y*.2)
            tone=max(0,min(255,int(247+wave+fiber)))
            row.extend((tone,tone,tone))
        rows.append(bytes(row))
    raw=b''.join(rows)
    return (b'\x89PNG\r\n\x1a\n'+png_chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,2,0,0,0))+
            png_chunk(b'IDAT',zlib.compress(raw,9))+png_chunk(b'IEND',b''))

def triangle(a,b,c,material,joint):
    v=a+b+c; u=[b[k]-a[k] for k in range(3)]; w=[c[k]-a[k] for k in range(3)]
    normal=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]]; ll=math.sqrt(sum(q*q for q in normal)) or 1
    normal=[q/ll for q in normal]
    return part(v,normal*3,[0,1,2],material,joint)

def loft(center, rings, material, joint, seg=24):
    """Smooth tapered garment shell from bottom-to-top (y, width, depth) rings."""
    cx,cz=center; v=[]; n=[]; idx=[]
    for ri,(y,rx,rz) in enumerate(rings):
        prev=rings[max(0,ri-1)]; nxt=rings[min(len(rings)-1,ri+1)]
        dy=max(nxt[0]-prev[0],1e-5); slope_x=(nxt[1]-prev[1])/dy; slope_z=(nxt[2]-prev[2])/dy
        for i in range(seg+1):
            a=2*math.pi*i/seg; ca=math.cos(a); sa=math.sin(a)
            v.extend([cx+rx*ca,y,cz+rz*sa])
            nn=[ca*rz,-(slope_x*ca+slope_z*sa)*min(rx,rz),sa*rx]; ll=math.sqrt(sum(q*q for q in nn)) or 1
            n.extend([q/ll for q in nn])
    for ri in range(len(rings)-1):
        for i in range(seg):
            a=ri*(seg+1)+i; b=a+seg+1; idx.extend([a,b,a+1,b,b+1,a+1])
    return part(v,n,idx,material,joint)

def cape_panel(material, joint):
    v=[]; n=[]; uv=[]; idx=[]; rows=12; cols=8
    for iy in range(rows+1):
        t=iy/rows; y=.94+t*.94; width=.54*(1-t)+.29*t
        for ix in range(cols+1):
            u=ix/cols; x=(u*2-1)*width
            z=-.235-.085*math.sin(u*math.pi)*(1-t)
            v.extend([x,y,z]); n.extend([0,0,-1]); uv.extend([u,t])
    for iy in range(rows):
        for ix in range(cols):
            a=iy*(cols+1)+ix; b=a+cols+1
            idx.extend([a,b,a+1,b,b+1,a+1])
    p=part(v,n,idx,material,joint); p["uv"]=uv
    return p

def braid(x, y_top, y_bottom, material, joint=3, z=.035):
    """Alternating interwoven locks make soft, readable twin braids at game scale."""
    result=[loft((x,z),[(y_bottom,.046,.046),((y_bottom+y_top)/2,.058,.058),(y_top,.045,.045)],material,joint,16)]; count=9
    for i in range(count):
        t=i/(count-1); sway=(-1 if i%2 else 1)*.023
        result.append(sphere((x+sway,y_top+(y_bottom-y_top)*t,z),(.051,.066,.052),material,joint,20,14))
    result.append(sphere((x,y_bottom-.045,z),(.06,.075,.058),material,joint,20,14))
    return result

def shaped_y(y):
    """Give the playable figure longer legs and a higher, shorter coat silhouette."""
    return y*1.68 if y<=1.0 else y+0.68

def box(center, size, material, joint):
    x,y,z=center; sx,sy,sz=[a/2 for a in size]; verts=[]; norms=[]; indices=[]
    faces=[((1,0,0),[(sx,-sy,-sz),(sx,sy,-sz),(sx,sy,sz),(sx,-sy,sz)]),((-1,0,0),[(-sx,-sy,sz),(-sx,sy,sz),(-sx,sy,-sz),(-sx,-sy,-sz)]),((0,1,0),[(-sx,sy,-sz),(-sx,sy,sz),(sx,sy,sz),(sx,sy,-sz)]),((0,-1,0),[(-sx,-sy,sz),(-sx,-sy,-sz),(sx,-sy,-sz),(sx,-sy,sz)]),((0,0,1),[(-sx,-sy,sz),(sx,-sy,sz),(sx,sy,sz),(-sx,sy,sz)]),((0,0,-1),[(sx,-sy,-sz),(-sx,-sy,-sz),(-sx,sy,-sz),(sx,sy,-sz)])]
    for normal, quad in faces:
        base=len(verts)//3
        for vx,vy,vz in quad: verts.extend([x+vx,y+vy,z+vz]); norms.extend(normal)
        indices.extend([base,base+1,base+2,base,base+2,base+3])
    return part(verts,norms,indices,material,joint)

def cylinder(center, radius_top, radius_bottom, height, material, joint, seg=10):
    cx,cy,cz=center; v=[]; n=[]; idx=[]
    for y,r in [(-height/2,radius_bottom),(height/2,radius_top)]:
        for i in range(seg+1):
            a=2*math.pi*i/seg; x=math.cos(a); z=math.sin(a)
            v.extend([cx+r*x,cy+y,cz+r*z]); n.extend([x,0,z])
    for i in range(seg):
        a=i;b=i+seg+1;idx.extend([a,b,a+1,b,b+1,a+1])
    return part(v,n,idx,material,joint)

def cone(tip, base, radius, material, joint, seg=8):
    # A tapered four-sided lock with a rounded-looking low-poly base.
    tx,ty,tz=tip; bx,by,bz=base; v=[];n=[];idx=[]
    for i in range(seg):
        a=2*math.pi*i/seg; b=2*math.pi*(i+1)/seg
        p0=(bx+math.cos(a)*radius,by,bz+math.sin(a)*radius); p1=(bx+math.cos(b)*radius,by,bz+math.sin(b)*radius)
        baseidx=len(v)//3
        for p in [p0,p1,(tx,ty,tz)]:v.extend(p)
        u=[p1[k]-p0[k] for k in range(3)];w=[tx-p0[0],ty-p0[1],tz-p0[2]]
        cr=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];ll=math.sqrt(sum(q*q for q in cr)) or 1
        nn=[-q/ll for q in cr]; n.extend(nn*3);idx.extend([baseidx,baseidx+2,baseidx+1])
    return part(v,n,idx,material,joint)

JOINT_NAMES=["Root","Hips","Spine","Head","Arm_L","Forearm_L","Arm_R","Forearm_R","Leg_L","Shin_L","Foot_L","Leg_R","Shin_R","Foot_R"]
JOINT_PARENT=[-1,0,1,2,2,4,2,6,1,8,9,1,11,12]
JOINT_TRANSLATIONS=[[0,0,0],[0,0.93,0],[0,0.18,0],[0,0.69,0],[-0.48,0.42,0],[0,-0.42,0],[0.48,0.42,0],[0,-0.42,0],[-0.22,-0.09,0],[0,-0.48,0],[0,-0.42,0],[0.22,-0.09,0],[0,-0.48,0],[0,-0.42,0]]

def build(c):
    # Joint ids index the glTF node list, with the root avatar node at index 0.
    names=JOINT_NAMES; parent=JOINT_PARENT
    mats={"skin":"#f0c5aa","hair":c["hair"],"hair-light":"#e5c1a1","cloth":c["cloth"],"cloth2":c["cloth2"],"pants":c["pants"],"shoe":c["shoe"],"trim":"#d5ae70","eye-white":"#fff9f1","eye-iris":"#579276" if c["id"]=="sakura-street" else "#5b86a3","eye-dark":"#252838","accessory":"#6e4e3f" if c["id"]=="sakura-street" else c["cloth2"],"cape":c["cloth2"],"ribbon":c.get("ribbon",c["cloth2"])}
    parts=[]
    # Face/head, soft hair cap, bangs and distinct hair silhouettes.
    parts += [sphere((0,2.60,0),(0.29,0.33,0.245),"skin",3,32,22),sphere((0,2.84,-0.05),(0.33,0.18,0.275),"hair",3,28,18)]
    # Fringe, side locks and hairstyles have silhouettes unique to each character.
    parts.append(sphere((0,2.76,0.245),(0.33,0.12,0.10),"hair",3,24,16))
    for x,tip_y in [(-.18,2.67),(0,2.64),(.18,2.67)]:parts.append(cone((x,tip_y,.30),(x,2.78,.27),.07,"hair",3,8))
    if c["hairStyle"]=="twin":
        parts += [sphere((-.40,2.48,-.04),(.15,.47,.17),"hair",3),sphere((.40,2.48,-.04),(.15,.47,.17),"hair",3),cone((-.41,2.08,-.04),(-.40,2.52,-.04),.14,"hair-light",3),cone((.41,2.08,-.04),(.40,2.52,-.04),.14,"hair-light",3),sphere((-.40,2.48,.105),(.035,.30,.018),"hair-light",3),sphere((.40,2.48,.105),(.035,.30,.018),"hair-light",3)]
        parts.append(sphere((-.22,2.77,.31),(.17,.11,.08),"hair-light",3))
    elif c["hairStyle"]=="long":
        parts += [sphere((-.38,2.34,-.06),(.13,.67,.15),"hair",3),sphere((.38,2.34,-.06),(.13,.67,.15),"hair",3),cone((-.38,1.72,-.06),(-.38,2.23,-.06),.13,"hair",3),cone((.38,1.72,-.06),(.38,2.23,-.06),.13,"hair",3),sphere((-.38,2.34,.08),(.026,.43,.018),"hair-light",3),sphere((.38,2.34,.08),(.026,.43,.018),"hair-light",3),sphere((0,2.70,.34),(.19,.13,.08),"hair-light",3)]
    elif c["hairStyle"]=="spike":
        for x,z,h in [(-.30,.0,.28),(-.16,.08,.39),(0,.10,.45),(.17,.04,.36),(.30,-.02,.27)]:parts.append(cone((x,3.03+h*.1,z),(x,2.82,z),.14,"hair",3))
        parts.append(sphere((0,2.82,.31),(.32,.14,.13),"hair",3))
    else:
        parts += [sphere((-.18,2.82,.08),(.18,.16,.25),"hair",3),sphere((.18,2.82,-.02),(.18,.15,.24),"hair",3)]
        parts.append(sphere((0,2.84,-.24),(.18,.17,.17),"accessory",3))
    # Expressive anime eyes, lashes, brows, blush and smile.
    for sx in [-1,1]:
        parts += [sphere((sx*.125,2.61,.245),(.083,.112,.043),"eye-white",3,32,22),sphere((sx*.125,2.598,.281),(.057,.083,.032),"eye-iris",3,32,22),sphere((sx*.125,2.585,.305),(.032,.060,.020),"eye-dark",3,28,20),sphere((sx*.145,2.64,.322),(.020,.026,.012),"eye-white",3,20,14),sphere((sx*.105,2.565,.319),(.009,.012,.008),"eye-white",3,16,12),box((sx*.125,2.735,.246),(.145,.025,.030),"hair",3),sphere((sx*.21,2.49,.23),(.058,.026,.014),"hair-light",3)]
    parts += [sphere((-.305,2.58,0),(.055,.08,.06),"skin",3),sphere((.305,2.58,0),(.055,.08,.06),"skin",3),box((0,2.43,.27),(.085,.016,.016),"hair",3),sphere((0,2.47,.282),(.024,.028,.024),"skin",3),sphere((0,2.38,.268),(.055,.014,.012),"accessory",3)]
    # Neck, layered streetwear top, collar, cuffs and small zipper detail.
    parts.append(cape_panel("cape",2))
    parts += [cylinder((0,1.99,0),.12,.13,.26,"skin",2),loft((0,0),[(1.00,.27,.19),(1.12,.33,.23),(1.40,.37,.25),(1.68,.35,.24),(1.90,.29,.20),(2.00,.19,.15)],"cloth",2,32)]
    # Cropped inner layer, open jacket lapels, zipper, drawstrings and hem ribbing.
    parts += [sphere((0,1.59,.19),(.15,.22,.065),"pants",2,28,20),box((0,1.52,.263),(.026,.58,.025),"trim",2),box((-.21,1.23,.214),(.19,.21,.035),"cloth2",2),box((.21,1.23,.214),(.19,.21,.035),"cloth2",2),box((-.21,1.23,.238),(.14,.018,.012),"trim",2),box((.21,1.23,.238),(.14,.018,.012),"trim",2),cylinder((0,1.10,0),.34,.34,.07,"cloth2",2,24)]
    parts += [box((-.145,1.76,.256),(.018,.22,.018),"trim",2),box((.145,1.76,.256),(.018,.22,.018),"trim",2),sphere((0,1.49,.285),(.035,.035,.02),"trim",2)]
    # Oversized sleeves, articulated forearms and hands.
    for side,jarm,jfore in [(-1,4,5),(1,6,7)]:
        parts += [sphere((side*.34,1.62,0),(.18,.23,.22),"cloth",jarm,24,16),loft((side*.50,0),[(.91,.115,.12),(1.02,.155,.15),(1.30,.18,.17),(1.53,.16,.15),(1.62,.14,.13)],"cloth",jarm,24),loft((side*.59,0),[(.54,.10,.10),(.62,.125,.12),(.83,.145,.14),(.98,.13,.125)],"cloth2",jfore,24),cylinder((side*.59,.62,0),.13,.13,.075,"trim",jfore,16),sphere((side*.59,.51,.015),(.105,.12,.105),"skin",jfore,24,16),box((side*.50,1.29,.17),(.035,.28,.022),"cloth2",jarm)]
    if c["bottom"]=="skirt":
        parts += [loft((-.19,0),[(.02,.115,.13),(.13,.13,.15),(.47,.145,.16),(.82,.15,.15),(.98,.14,.14)],"pants",8,24),loft((.19,0),[(.02,.115,.13),(.13,.13,.15),(.47,.145,.16),(.82,.15,.15),(.98,.14,.14)],"pants",11,24)]
        parts += [loft((0,0),[(.52,.57,.33),(.63,.59,.34),(.78,.49,.30),(.96,.36,.24),(1.03,.32,.22)],"cloth",1,32),loft((0,0),[(.52,.58,.34),(.56,.60,.35)],"cloth2",1,32)]
        for x in [-.40,-.20,0,.20,.40]:parts.append(box((x,.72,.35),(.035,.34,.018),"trim",1))
    elif c["bottom"]=="dress":
        parts += [loft((-.19,0),[(.02,.115,.13),(.13,.13,.15),(.47,.145,.16),(.82,.15,.15),(.98,.14,.14)],"pants",8,24),loft((.19,0),[(.02,.115,.13),(.13,.13,.15),(.47,.145,.16),(.82,.15,.15),(.98,.14,.14)],"pants",11,24)]
        parts += [cylinder((0,.88,0),.42,.72,.90,"cloth",1,14),cylinder((0,.43,0),.72,.70,.12,"cloth2",1,14)]
        for x in [-.42,-.21,0,.21,.42]:parts.append(box((x,.48,.53),(.025,.72,.018),"trim",1))
    else:
        parts += [box((0,.84,0),(.62,.26,.38),"pants",1),loft((-.19,0),[(.02,.12,.14),(.12,.14,.16),(.43,.155,.17),(.76,.17,.17),(.95,.16,.16)],"pants",8,24),loft((.19,0),[(.02,.12,.14),(.12,.14,.16),(.43,.155,.17),(.76,.17,.17),(.95,.16,.16)],"pants",11,24),box((-.20,.63,.171),(.16,.22,.025),"cloth2",8),box((.20,.63,.171),(.16,.22,.025),"cloth2",11),box((-.20,.63,.189),(.12,.018,.012),"trim",8),box((.20,.63,.189),(.12,.018,.012),"trim",11)]
    # Shoes, soles and visible lace marks.
    for side,jfoot in [(-1,10),(1,13)]:
        x=side*.22
        is_scholar=c["id"]=="sakura-street"
        parts += [loft((x,0),[(.10,.13,.13),(.18,.13,.13),(.30,.105,.11),(.39,.09,.09)],"shoe" if is_scholar else "pants",jfoot,20),sphere((x,.105,.12),(.17,.12,.26),"shoe",jfoot,24,16),box((x,.035,.13),(.33,.065,.43),"trim",jfoot),box((x,.16,.30),(.15,.025,.02),"cloth2",jfoot),box((x,.19,.18),(.035,.018,.15),"trim",jfoot)]

    # Tailored waist belt, metal buckle and a small adventurer-style side pouch.
    parts += [loft((0,0),[(.99,.31,.22),(1.08,.32,.23)],"accessory",1,32),box((0,1.035,.235),(.14,.10,.025),"trim",1),box((.34,1.02,.10),(.18,.25,.15),"accessory",1),box((.34,1.16,.11),(.20,.045,.16),"trim",1)]
    if c["id"]=="sakura-street":
        parts += [triangle([-.13,1.88,.225],[-.02,1.83,.238],[-.09,1.78,.235],"ribbon",2),triangle([.13,1.88,.225],[.02,1.83,.238],[.09,1.78,.235],"ribbon",2),sphere((0,1.83,.25),(.045,.04,.025),"trim",2)]

    if c["hairStyle"] in ("twin","long"):
        parts += braid(-.28,2.42,1.78,"hair",3,.12)+braid(.28,2.42,1.78,"hair",3,.12)
    # A character-specific accessory, distinct from the base hair and outfit.
    if c["accessory"]=="bow":parts += [sphere((-.25,2.85,.11),(.11,.065,.05),"accessory",3),sphere((-.18,2.85,.13),(.045,.045,.035),"trim",3)]
    elif c["accessory"]=="headphones":parts += [sphere((-.32,2.60,-.015),(.06,.13,.075),"accessory",3),sphere((.32,2.60,-.015),(.06,.13,.075),"accessory",3)]
    elif c["accessory"]=="beret":parts += [sphere((.12,2.94,-.04),(.24,.10,.20),"accessory",3),sphere((.20,3.02,-.03),(.05,.035,.05),"trim",3)]
    elif c["accessory"]=="visor":parts += [box((0,2.77,.26),(.50,.07,.15),"accessory",3),box((0,2.72,.31),(.43,.025,.055),"trim",3)]

    # Fingers and a thumb create a natural hand outline below each cuff.
    for side,jfore in [(-1,5),(1,7)]:
        for finger in range(4):
            fx=side*.59+(finger-1.5)*.045
            parts.append(sphere((fx,.43,.055),(.023,.075,.022),"skin",jfore,12,10))
        parts.append(sphere((side*.59-side*.07,.48,.105),(.03,.065,.028),"skin",jfore,12,10))

    # Retarget the skeleton bind pose and vertices together for a longer-legged silhouette.
    old_world=[]; new_world=[]; translations=[]
    for i,tr in enumerate(JOINT_TRANSLATIONS):
        p=JOINT_PARENT[i]
        old_y=tr[1]+(old_world[p] if p>=0 else 0)
        new_y=shaped_y(old_y)
        translations.append([tr[0],new_y-(new_world[p] if p>=0 else 0),tr[2]])
        old_world.append(old_y); new_world.append(new_y)
    for mesh_part in parts:
        for k in range(1,len(mesh_part["p"]),3):
            old_y=mesh_part["p"][k]; mesh_part["p"][k]=shaped_y(old_y)
            mesh_part["n"][k]/=1.68 if old_y<=1.0 else 1.0
        for k in range(0,len(mesh_part["n"]),3):
            nx,ny,nz=mesh_part["n"][k:k+3]; ll=math.sqrt(nx*nx+ny*ny+nz*nz) or 1
            mesh_part["n"][k:k+3]=[nx/ll,ny/ll,nz/ll]

    # Accumulate glTF binary buffers and accessors, one low-poly primitive per material.
    blob=bytearray(); views=[]; accessors=[]; materials=[]; material_ids={}; images=[]; textures=[]
    for name,color in mats.items():
        material_ids[name]=len(materials)
        roughness=0.76 if name=="skin" else (0.4 if name.startswith("hair") else 0.58)
        materials.append({"name":name,"doubleSided":name=="cape","pbrMetallicRoughness":{"baseColorFactor":rgba(color),"baseColorTexture":{"index":len(textures)},"metallicFactor":0.025,"roughnessFactor":roughness}})
        while len(blob)%4: blob.append(0)
        image_data=material_texture(name); image_offset=len(blob); blob.extend(image_data)
        image_view=len(views); views.append({"buffer":0,"byteOffset":image_offset,"byteLength":len(image_data)})
        images.append({"name":name+" albedo","bufferView":image_view,"mimeType":"image/png"})
        textures.append({"source":len(images)-1})
    def accessor(data,typ,component,count,target,minv=None,maxv=None):
        while len(blob)%4:blob.append(0)
        off=len(blob); packed=struct.pack('<'+typ*len(data),*data);blob.extend(packed)
        vi=len(views);views.append({"buffer":0,"byteOffset":off,"byteLength":len(packed),"target":target})
        ac={"bufferView":vi,"componentType":component,"count":count,"type": {"SCALAR":"SCALAR","VEC2":"VEC2","VEC3":"VEC3","VEC4":"VEC4","MAT4":"MAT4"}[typ[0] if False else "SCALAR"]} if False else None
        return vi,off,len(packed)
    type_map={3:"VEC3",4:"VEC4",16:"MAT4",1:"SCALAR"}
    def make_accessor(data,fmt,component,count,type_name,target=None,minv=None,maxv=None):
        while len(blob)%4:blob.append(0)
        off=len(blob);packed=struct.pack('<'+fmt*len(data),*data);blob.extend(packed)
        vi=len(views);view={"buffer":0,"byteOffset":off,"byteLength":len(packed)}
        if target:view["target"]=target
        views.append(view)
        acc={"bufferView":vi,"componentType":component,"count":count,"type":type_name}
        if minv is not None:acc["min"]=minv
        if maxv is not None:acc["max"]=maxv
        ai=len(accessors);accessors.append(acc);return ai
    primitives=[]
    for p in parts:
        count=len(p["p"])//3; j=p["j"]
        pos=make_accessor(p["p"],"f",5126,count,"VEC3",34962,[min(p["p"][i::3]) for i in range(3)],[max(p["p"][i::3]) for i in range(3)])
        nor=make_accessor(p["n"],"f",5126,count,"VEC3",34962)
        uv=make_accessor(p["uv"],"f",5126,count,"VEC2",34962)
        joints=[j,0,0,0]*count;weights=[1.,0.,0.,0.]*count
        joi=make_accessor(joints,"B",5121,count,"VEC4",34962);wei=make_accessor(weights,"f",5126,count,"VEC4",34962)
        ids=p["i"]
        ind=make_accessor(ids,"H",5123,len(ids),"SCALAR",34963)
        primitives.append({"attributes":{"POSITION":pos,"NORMAL":nor,"TEXCOORD_0":uv,"JOINTS_0":joi,"WEIGHTS_0":wei},"indices":ind,"material":material_ids[p["m"]]})
    # Joint nodes in a humanoid hierarchy and inverse bind matrices.
    nodes=[{"name":"LanternAnimeAvatar","children":[1]}]
    joint_node_ids=[]
    for name,tr in zip(names,translations):
        joint_node_ids.append(len(nodes));nodes.append({"name":name,"translation":tr})
    for idx,pr in enumerate(parent):
        if pr>=0:nodes[1+pr].setdefault("children",[]).append(1+idx)
    # Skinned mesh node attaches to the root while the skin joints are descendants.
    mesh_node=len(nodes);nodes.append({"name":"AvatarMesh","mesh":0,"skin":0})
    # Inverse bind matrix is just inverse joint-world translation (no rest rotations).
    world=[]
    for i,tr in enumerate(translations):
        p=parent[i];world.append([tr[k]+(world[p][k] if p>=0 else 0) for k in range(3)])
    mats4=[]
    for x,y,z in world:mats4.extend([1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1])
    ibm=make_accessor(mats4,"f",5126,len(names),"MAT4",None)
    skins=[{"name":"AnimeHumanoid","inverseBindMatrices":ibm,"skeleton":1,"joints":[1+i for i in range(len(names))]}]
    # Locomotion clips use bone rotations; mixer transitions are handled in Three.js.
    animations=[]
    def quat_axis(deg,axis="x"):
        a=math.radians(deg)/2; xyz={"x":[math.sin(a),0,0],"y":[0,math.sin(a),0],"z":[0,0,math.sin(a)]}[axis];return xyz+[math.cos(a)]
    def add_animation(name,duration,tracks):
        samplers=[];channels=[]
        for node,path,times,values in tracks:
            ti=make_accessor(times,"f",5126,len(times),"SCALAR",None,[min(times)],[max(times)])
            flat=[v for row in values for v in row]
            vi=make_accessor(flat,"f",5126,len(times),"VEC4" if path=="rotation" else "VEC3")
            si=len(samplers);samplers.append({"input":ti,"output":vi,"interpolation":"LINEAR"});channels.append({"sampler":si,"target":{"node":1+node,"path":path}})
        animations.append({"name":name,"samplers":samplers,"channels":channels})
    # Nodes: spine=2, arms=4/6, legs=8/11.
    def track(node,path,deg_values,times,axis="x"):return (node,path,times,[quat_axis(d,axis) for d in deg_values])
    add_animation("Idle",2.0,[track(4,"rotation",[0,4,0,-4,0],[0,.5,1,1.5,2]),track(6,"rotation",[0,-4,0,4,0],[0,.5,1,1.5,2])])
    add_animation("Walk",.9,[track(4,"rotation",[28,0,-28,0,28],[0,.225,.45,.675,.9]),track(6,"rotation",[-28,0,28,0,-28],[0,.225,.45,.675,.9]),track(8,"rotation",[-28,0,28,0,-28],[0,.225,.45,.675,.9]),track(11,"rotation",[28,0,-28,0,28],[0,.225,.45,.675,.9])])
    add_animation("Run",.54,[track(4,"rotation",[50,0,-50,0,50],[0,.135,.27,.405,.54]),track(6,"rotation",[-50,0,50,0,-50],[0,.135,.27,.405,.54]),track(8,"rotation",[-50,0,50,0,-50],[0,.135,.27,.405,.54]),track(11,"rotation",[50,0,-50,0,50],[0,.135,.27,.405,.54])])
    add_animation("Jump",.62,[track(4,"rotation",[-30,-48,-48,0],[0,.12,.38,.62]),track(6,"rotation",[-30,-48,-48,0],[0,.12,.38,.62]),track(8,"rotation",[-25,0,0,0],[0,.12,.38,.62]),track(11,"rotation",[25,0,0,0],[0,.12,.38,.62])])
    add_animation("Land",.36,[track(2,"rotation",[18,0],[0,.36]),track(4,"rotation",[18,0],[0,.36]),track(6,"rotation",[18,0],[0,.36])])
    add_animation("Wave",1.05,[track(6,"rotation",[-55,-105,-55,-105,-55],[0,.22,.48,.74,1.05],"z")])
    add_animation("Sit",.48,[track(2,"rotation",[0,-30,-30],[0,.32,.48]),track(1,"rotation",[0,23,23],[0,.32,.48])])
    add_animation("Dance",1.2,[track(2,"rotation",[0,10,-9,0],[0,.3,.8,1.2]),track(4,"rotation",[35,-20,35,-20,35],[0,.3,.6,.9,1.2]),track(6,"rotation",[-20,35,-20,35,-20],[0,.3,.6,.9,1.2]),track(8,"rotation",[-18,18,-18,18,-18],[0,.3,.6,.9,1.2]),track(11,"rotation",[18,-18,18,-18,18],[0,.3,.6,.9,1.2])])
    add_animation("Celebrate",.9,[track(4,"rotation",[80,105,80],[0,.45,.9],"z"),track(6,"rotation",[-80,-105,-80],[0,.45,.9],"z"),track(2,"rotation",[0,-10,0],[0,.45,.9])])
    while len(blob)%4:blob.append(0)
    gltf={"asset":{"version":"2.0","generator":"Little Lantern original procedural character builder"},"scene":0,"scenes":[{"nodes":[0,mesh_node]}],"nodes":nodes,"meshes":[{"name":"StylizedStreetwear","primitives":primitives}],"materials":materials,"textures":textures,"images":images,"skins":skins,"animations":animations,"buffers":[{"byteLength":len(blob)}],"bufferViews":views,"accessors":accessors}
    raw=json.dumps(gltf,separators=(',',':')).encode();raw+=b' '*((4-len(raw)%4)%4)
    bin_data=bytes(blob);total=12+8+len(raw)+8+len(bin_data)
    out=struct.pack('<III',0x46546C67,2,total)+struct.pack('<II',len(raw),0x4E4F534A)+raw+struct.pack('<II',len(bin_data),0x004E4942)+bin_data
    with open(os.path.join(ROOT,c['id']+'-v5.glb'),'wb') as f:f.write(out)
    print(c['id'],len(out),'bytes',len(parts),'parts',len(animations),'animations')

for character in CHARACTERS:build(character)
