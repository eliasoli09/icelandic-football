"""Higgsfield 3D Jutsu scene. COASTLINES is injected from Natural Earth 1:10m.
No network or imported file bytes are used in the Blender worker.
Units: metres. Blender Z is up; north is +Y.
"""
import bpy, math, random
import numpy as np
from mathutils import Vector

scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.engine = 'BLENDER_EEVEE'
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 360
if scene.world is None:
    scene.world = bpy.data.worlds.new('Warm studio ambience')
scene.world.color = (0.16, 0.13, 0.10)
scene.render.resolution_x = 1200
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100

def mat(name, color, metal=0, rough=.6):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    return m

brass=mat('Aged brass | warm edges',(.43,.265,.095),.78,.3)
ink=mat('Sepia engraving',(.105,.075,.038),0,.9)
faint=mat('Faded cartographic ink',(.37,.28,.15),0,.98)
land=mat('Land | warm ivory',(.63,.51,.31),0,.93)
dark=mat('Dark walnut end grain',(.07,.037,.018),0,.5)

def generated_material(name,wood=False):
    w,h=(1536,1024)
    yy,xx=np.mgrid[0:h,0:w].astype(np.float32); xx/=w; yy/=h
    rng=np.random.default_rng(137 if wood else 293)
    grain=rng.normal(0,1,(h,w)).astype(np.float32)
    if wood:
        phase=yy*150+np.sin(xx*8)*.4+np.sin(xx*31+yy*9)*.08
        v=.018*np.sin(phase*8)+.016*np.sin(phase*21)+.008*grain
        v+=.023*np.sin(yy*17+xx*.4)
        base=np.array([.19,.103,.051],np.float32)
        rgb=np.clip(base+v[:,:,None]*np.array([1,.69,.40]),0,1)
    else:
        edge=np.maximum(np.abs(xx-.5)*2,np.abs(yy-.5)*2)
        stain=.045*np.sin(xx*17+yy*7)*np.cos(yy*23-xx*3)
        stain+=.025*np.sin(xx*44+yy*29)+.008*grain
        stain-=.12*edge**9
        fold=.04*np.exp(-((xx-.333)/.004)**2)+.035*np.exp(-((xx-.667)/.004)**2)
        fold+=.026*np.exp(-((yy-.5)/.004)**2)
        base=np.array([.72,.60,.40],np.float32)
        rgb=np.clip(base+(stain-fold)[:,:,None]*np.array([.7,.78,.74]),0,1)
    rgba=np.ones((h,w,4),dtype=np.float32); rgba[:,:,:3]=rgb
    image=bpy.data.images.new(name+' texture',width=w,height=h)
    image.pixels.foreach_set(rgba.ravel()); image.pack()
    m=mat(name,(1,1,1),0,.54 if wood else .94)
    p=m.node_tree.nodes.get('Principled BSDF'); t=m.node_tree.nodes.new('ShaderNodeTexImage'); t.image=image
    m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color'])
    return m

wood=generated_material('Walnut | fine oiled grain',True)
paper=generated_material('Parchment | folds, fibres, tea stains')

def cube(name,loc,size,material,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name
    o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(material)
    if bevel:
        b=o.modifiers.new('Soft worn edges','BEVEL'); b.width=bevel;b.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

for i in range(7):
    cube('Walnut tabletop plank %02d'%i,(0,(i-3)*.211,-.022),(1.78,.21,.055),wood,.003)
cube('Table apron',(0,0,-.085),(1.68,1.32,.105),dark,.009)

def paper_z(x,y):
    edge=max(abs(x)/.66,abs(y)/.48)
    return .0105+.012*edge**24+.00045*math.sin(x*27)*math.sin(y*19)

verts=[]; faces=[]; nx=88;ny=64
for j in range(ny+1):
    y=(j/ny-.5)*.96
    for i in range(nx+1):
        x=(i/nx-.5)*1.32
        z=paper_z(x,y)
        verts.append((x,y,z))
for j in range(ny):
    for i in range(nx):
        k=j*(nx+1)+i;faces.append((k,k+1,k+nx+2,k+nx+1))
mesh=bpy.data.meshes.new('Subtle curled paper mesh');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('The Iceland atlas | folded parchment',mesh);scene.collection.objects.link(o);mesh.materials.append(paper)
uv=mesh.uv_layers.new()
for p in mesh.polygons:
    p.use_smooth=True
    for li in p.loop_indices:
        v=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(v.x/1.32+.5,v.y/.96+.5)
solid=o.modifiers.new('Paper thickness','SOLIDIFY');solid.thickness=.0006

def curve(name,pts,material,r=.00035,closed=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=1;c.bevel_depth=r;c.bevel_resolution=1
    s=c.splines.new('POLY');s.points.add(len(pts)-1)
    for p,co in zip(s.points,pts):p.co=(*co,1)
    s.use_cyclic_u=closed
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);c.materials.append(material);return o

def projected(lon,lat):
    return ((lon+19)*math.cos(math.radians(65))*.21,(lat-65)*.21)

for idx,ring in enumerate(COASTLINES):
    pts=[(*projected(lon,lat),.0128) for lon,lat in ring]
    c=bpy.data.curves.new('Accurate coast %02d'%idx,'CURVE');c.dimensions='2D';c.fill_mode='BOTH';c.resolution_u=1
    s=c.splines.new('POLY');s.points.add(len(pts)-1)
    for p,co in zip(s.points,pts):p.co=(co[0],co[1],0,1)
    s.use_cyclic_u=True
    o=bpy.data.objects.new('Iceland land %02d'%idx,c);scene.collection.objects.link(o);o.location.z=.0128;c.materials.append(land)
    curve('Engraved coastline %02d'%idx,[(x,y,.0132) for x,y,z in pts],ink,.00055,True)
    if len(pts)>100:
        for a in [1.009,1.018,1.032]:
            curve('Coastal engraving %02d'%idx,[(x*a,y*a,.0127) for x,y,z in pts],faint,.00012,True)

# Cartographic graticule and neatline, not invented roads or terrain.
for lon in [-24,-22,-20,-18,-16,-14]:
    x,_=projected(lon,65);curve('Longitude %s'%lon,[(x,-.385,.0135),(x,.385,.0135)],faint,.0001)
for lat in [64,65,66]:
    _,y=projected(-19,lat);curve('Latitude %s'%lat,[(-.58,y,.0135),(.57,y,.0135)],faint,.0001)
curve('Atlas border',[(-.622,-.443,.019),(.622,-.443,.019),(.622,.443,.019),(-.622,.443,.019)],faint,.0006,True)

def text_obj(name,text,loc,size,material=ink,align='LEFT'):
    c=bpy.data.curves.new(name,'FONT');c.body=text;c.size=size;c.align_x=align;c.extrude=.00003
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.location=loc;c.materials.append(material);return o

text_obj('Atlas title','ÍSLAND',(-.57,.361,.017),.052)
text_obj('Atlas subtitle','KNATTSPYRNUATLAS  /  2026',(-.568,.335,.017),.009)
text_obj('Atlas edition','BESTA DEILDIN  ·  LENGJUDEILDIN',(-.568,-.409,.017),.01)
text_obj('Atlantic label','ATLANTSHAF',(.21,-.315,.017),.014,faint)
text_obj('North label','ÍSHAF',(.05,.352,.017),.012,faint)
text_obj('Cartographic source','Natural Earth  /  65° N',(.58,-.414,.017),.007,faint,'RIGHT')

# A substantial brass compass, resting on the paper's unused northeast margin.
def cylinder(name,loc,r,depth,material,vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=loc)
    o=bpy.context.object;o.name=name;o.data.materials.append(material)
    b=o.modifiers.new('Machined edge','BEVEL');b.width=.001;b.segments=2
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o

cx,cy=.524,.318
cylinder('Compass case',(cx,cy,.027),.064,.022,brass)
cylinder('Compass enamel face',(cx,cy,.039),.057,.003,paper)
for k in range(32):
    a=k*math.tau/32;r=.044 if k%4 else .035
    curve('Compass graduation',[(cx+math.sin(a)*r,cy+math.cos(a)*r,.042),(cx+math.sin(a)*.05,cy+math.cos(a)*.05,.042)],ink,.00032)
for k in range(4):
    a=k*math.pi/2; text_obj('Compass cardinal','NESW'[k],(cx+math.sin(a)*.031,cy+math.cos(a)*.031-.004,.042),.009,ink,'CENTER')
mesh=bpy.data.meshes.new('Compass needle');mesh.from_pydata([(cx,cy+.028,.044),(cx-.004,cy,.044),(cx,cy-.025,.044),(cx+.004,cy,.044)],[],[(0,1,2,3)]);mesh.materials.append(ink)
o=bpy.data.objects.new('North pointing compass needle',mesh);scene.collection.objects.link(o)
cylinder('Compass pivot',(cx,cy,.047),.004,.005,brass,24)

# Two small brass map weights cast contact shadows on the curled sheet.
for x,y in [(-.604,-.424),(-.604,.423)]:
    cylinder('Brass map weight',(x,y,.027),.012,.023,brass,32)

def lamp(name,kind,loc,power,color,size=.5):
    d=bpy.data.lights.new(name,kind);d.energy=power;d.color=color
    if kind=='POINT':d.shadow_soft_size=size
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc
    return o
lamp('Warm window key','POINT',(-.65,-.45,1.5),175,(1,.83,.61),.38)
lamp('Soft daylight fill','POINT',(.8,.6,1.2),55,(.67,.78,1),.55)
lamp('Ambient table bounce','POINT',(0,-.9,.8),24,(1,.91,.75),.8)

camera=bpy.data.cameras.new('Atlas delivery camera');o=bpy.data.objects.new('Atlas delivery camera',camera);scene.collection.objects.link(o);scene.camera=o
camera.lens=48;camera.clip_start=.01;camera.clip_end=30
for frame,loc in [(1,(.035,-1.34,1.57)),(181,(-.035,-1.29,1.62)),(361,(.035,-1.34,1.57))]:
    o.location=loc;o.rotation_euler=(Vector((0,0,.025))-o.location).to_track_quat('-Z','Y').to_euler()
    o.keyframe_insert(data_path='location',frame=frame);o.keyframe_insert(data_path='rotation_euler',frame=frame)
scene.frame_set(1)
scene['atlas_projection']='Equirectangular, standard parallel 65N, central meridian 19W. 0.21 m per degree latitude.'
scene['atlas_source']='Natural Earth 1:10m public-domain coastline. Decorative aging is not geographic terrain.'
scene['atlas_delivery']='Base scene authored in Higgsfield. Official club badge textures are added in local Blender.'
result={'objects':len(scene.objects),'camera':scene.camera.name,'frames':[1,360],'fps':30,'coastlines':len(COASTLINES)}
