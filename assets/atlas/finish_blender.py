"""Complete the Higgsfield scene with official crests and exact ground anchors.
Run: Blender --background assets/atlas/higgsfield-base.blend --python assets/atlas/finish_blender.py
The final .blend packs every texture; GLB contains static pins and camera animation.
"""
import bpy, json, math, pathlib
from mathutils import Vector

ROOT=pathlib.Path(__file__).resolve().parents[2]
PUBLIC=ROOT/'web/public/atlas'
CLUBS=json.loads((ROOT/'web/src/lib/atlas/clubs.json').read_text())
PUBLIC.mkdir(exist_ok=True,parents=True)
scene=bpy.context.scene

def material(name,color,metal=0,rough=.4):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m

brass=bpy.data.materials.get('Aged brass | warm edges')
enamel=material('Pin enamel | warm porcelain',(.8,.77,.67),.04,.3)
def linear_hex(h):
    vals=[int(h[i:i+2],16)/255 for i in [1,3,5]]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in vals)
def project(c):return Vector(((c['lon']+19)*math.cos(math.radians(65))*.21,(c['lat']-65)*.21,0))

# Resolve badge-head collisions; the separate ground anchor never moves.
anchors=[project(c) for c in CLUBS]
heads=[p.copy() for p in anchors]
for i,p in enumerate(heads):
    p.x+=.003*math.cos(i*2.399);p.y+=.003*math.sin(i*2.399)
for iteration in range(240):
    for i in range(len(heads)):
        for j in range(i):
            d=heads[i]-heads[j];length=d.length;gap=.051
            if length<gap:
                direction=d.normalized() if length>1e-8 else Vector((1,0,0))
                shift=direction*(gap-length)*.505
                heads[i]+=shift;heads[j]-=shift
    if iteration<160:
        for i in range(len(heads)):heads[i]+=(anchors[i]-heads[i])*.012

def parent_object(o,parent,name):
    o.name=name;o.parent=parent;o.data.materials.clear();return o
def cylinder(name,loc,radius,depth,mat,parent,angle=0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=radius,depth=depth,location=loc)
    o=parent_object(bpy.context.object,parent,name);o.rotation_euler.x=angle;o.data.materials.append(mat)
    b=o.modifiers.new('Rounded pin edge','BEVEL');b.width=.0005;b.segments=2
    o.modifiers.new('Weighted pin normals','WEIGHTED_NORMAL');return o
def curve(name,points,mat,parent,r=.00065):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2
    s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for p,v in zip(s.bezier_points,points):p.co=v;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=parent;c.materials.append(mat)
    return o

layout=[]
angle=math.radians(28)
normal=Vector((0,-math.sin(angle),math.cos(angle)))
for i,c in enumerate(CLUBS):
    a=anchors[i];head=heads[i];head.z=.058
    group=bpy.data.objects.new('ClubPin_%s'%c['id'],None);scene.collection.objects.link(group)
    group['clubId']=c['id'];group['clubName']=c['name'];group['latitude']=c['lat'];group['longitude']=c['lon']
    group['stadium']=c['stadium'];group['league']=c['league']
    group['badgeSource']=next(s for s in c['sources'] if 'comet.ksi.is/file' in s)
    colour=material(c['name']+' | club colour',linear_hex(c['color']),.12,.36)
    cylinder(c['name']+' | EXACT GROUND ANCHOR',(a.x,a.y,.0148),.0021,.0022,colour,group)
    curve(c['name']+' | brass pin stem',[(a.x,a.y,.016),(a.x,a.y,.028),(head.x,head.y,.042),tuple(head-normal*.005)],brass,group)
    cylinder(c['name']+' | brass badge bezel',head,.022,.005,brass,group,angle)
    center=head+normal*.0028
    cylinder(c['name']+' | club rim',center,.0203,.0015,colour,group,angle)
    cylinder(c['name']+' | porcelain badge face',head+normal*.004,.0189,.001,enamel,group,angle)
    # Official artwork stays an actual image texture, never generated lettering.
    path=ROOT/'web/public'/c['badge'].lstrip('/')
    image=bpy.data.images.load(str(path),check_existing=True);image.pack()
    m=material(c['name']+' | official crest',(1,1,1),0,.53)
    nodes=m.node_tree.nodes;p=nodes.get('Principled BSDF');t=nodes.new('ShaderNodeTexImage');t.image=image
    # A diffuse decal plus low emission preserves official artwork in warm light.
    # The brass and porcelain around it carry the physical highlights and shadows.
    p.inputs['Base Color'].default_value=(0,0,0,1)
    m.node_tree.links.new(t.outputs['Color'],p.inputs['Emission Color'])
    p.inputs['Emission Strength'].default_value=.8
    p.inputs['Specular IOR Level'].default_value=0
    m.node_tree.links.new(t.outputs['Alpha'],p.inputs['Alpha'])
    m.surface_render_method='DITHERED';m.use_transparency_overlap=False
    bpy.ops.mesh.primitive_plane_add(size=1,location=head+normal*.00465)
    o=parent_object(bpy.context.object,group,c['name']+' | official badge');o.rotation_euler.x=angle;o['atlasRole']='badge'
    w,h=image.size;ratio=w/h;o.scale=(.033*min(1,ratio),.033*min(1,1/ratio),1);o.data.materials.append(m)
    layout.append({'id':c['id'],'anchor':[a.x,.0148,-a.y],'head':[head.x,head.z,-head.y]})

# Add geographical names sparingly around the large regions.
ink=bpy.data.materials.get('Sepia engraving')
for label,lon,lat,dx,dy in [('Ísafjörður',-23.136,66.073,-.050,.042),('Akureyri',-18.115,65.678,-.06,-.055),('Húsavík',-17.344,66.05,.018,.024),('Vestmannaeyjar',-20.289,63.439,.023,-.018),('Höfuðborgarsvæðið',-21.87,64.12,-.14,.115)]:
    x,y,z=project({'lat':lat,'lon':lon})
    data=bpy.data.curves.new(label,'FONT');data.body=label;data.size=.009;data.extrude=.00002;data.materials.append(ink)
    o=bpy.data.objects.new(label,data);scene.collection.objects.link(o);o.location=(x+dx,y+dy,.015)

scene['club_count']=24
scene['pin_note']='Stem tips mark official KSÍ ground coordinates. Badge heads are spread for legibility.'
scene['distance_note']='The web interface measures great-circle distance between these home grounds, not road routes.'
scene['facts']=json.dumps(CLUBS,ensure_ascii=False)
scene['higgsfield_project']='https://higgsfield.ai/3d-jutsu/ef849712-5176-4991-8ddd-4a490ec4daa6'
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=1440;scene.render.resolution_y=1080;scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=92
scene.render.filepath=str(PUBLIC/'preview.jpg')
scene.frame_set(1)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/atlas/iceland-football.blend'),compress=True)
# Keep the .blend fully editable. Consolidate static print geometry only in the
# portable export so hundreds of engraved strokes do not become draw calls.
static=[o for o in scene.objects if o.type in {'MESH','CURVE','FONT'} and o.parent is None]
if static:
    bpy.ops.object.select_all(action='DESELECT')
    for o in static:o.select_set(True)
    bpy.context.view_layer.objects.active=static[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join();bpy.context.object.name='Atlas | table, parchment and engraved geography'
bpy.ops.export_scene.gltf(filepath=str(PUBLIC/'iceland-football.glb'),export_format='GLB',export_apply=True,export_extras=True,export_cameras=True,export_lights=True,export_animations=True,export_image_format='AUTO')
(ROOT/'web/src/lib/atlas/pin-layout.json').write_text(json.dumps(layout,indent=2))
bpy.ops.render.render(write_still=True)
print('ATLAS_COMPLETE',len(CLUBS),len(scene.objects))
