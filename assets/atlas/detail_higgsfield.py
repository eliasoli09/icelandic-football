"""Second Higgsfield edit. GLACIERS is injected from Natural Earth geography."""
import bpy, math
scene=bpy.context.scene
ink=bpy.data.materials['Sepia engraving']
faint=bpy.data.materials['Faded cartographic ink']

# Carry the same folds and fibres through the hand-coloured land silhouette.
paper=bpy.data.materials['Parchment | folds, fibres, tea stains']
landpaper=paper.copy();landpaper.name='Hand coloured land | paper fibres'
nodes=landpaper.node_tree.nodes;p=nodes.get('Principled BSDF')
image=next(n for n in nodes if n.type=='TEX_IMAGE')
mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(.80,.85,.77,1)
landpaper.node_tree.links.new(image.outputs['Color'],mix.inputs[1]);landpaper.node_tree.links.new(mix.outputs[0],p.inputs['Base Color'])
for o in list(scene.objects):
    if o.name.startswith('Iceland land'):
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
        o.data.materials.clear();o.data.materials.append(landpaper)
        for old in list(o.data.uv_layers):o.data.uv_layers.remove(old)
        uv=o.data.uv_layers.new();uv.active_render=True
        for poly in o.data.polygons:
            for li in poly.loop_indices:
                v=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(v.x/1.32+.5,v.y/.96+.5)

ice=bpy.data.materials.new('Glacial engraving | faded ivory');ice.diffuse_color=(.70,.67,.52,1);ice.use_nodes=True
p=ice.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.70,.67,.52,1);p.inputs['Roughness'].default_value=.95
def project(lon,lat):return ((lon+19)*math.cos(math.radians(65))*.21,(lat-65)*.21)
def line(name,pts,material,r=.00018,closed=False):
    data=bpy.data.curves.new(name,'CURVE');data.dimensions='3D';data.bevel_depth=r;data.bevel_resolution=0
    s=data.splines.new('POLY');s.points.add(len(pts)-1)
    for p,v in zip(s.points,pts):p.co=(*v,1)
    s.use_cyclic_u=closed;o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);data.materials.append(material)
def text(name,x,y,size,material=ink):
    data=bpy.data.curves.new(name,'FONT');data.body=name;data.size=size;data.space_character=1.15;data.shear=.12;data.align_x='CENTER';data.materials.append(material)
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=(x,y,.016)

for g in GLACIERS:
    pts=[project(lon,lat) for lon,lat,*_ in g['ring']]
    data=bpy.data.curves.new('Glacier outline','CURVE');data.dimensions='2D';data.fill_mode='BOTH'
    s=data.splines.new('POLY');s.points.add(len(pts)-1)
    for p,(x,y) in zip(s.points,pts):p.co=(x,y,0,1)
    s.use_cyclic_u=True;data.materials.append(ice)
    o=bpy.data.objects.new('Natural Earth glacier | '+str(g['name']),data);scene.collection.objects.link(o);o.location.z=.0145
    line('Glacier perimeter',[(x,y,.015) for x,y in pts],faint,.00023,True)
    # Clipped horizontal hatching evokes copperplate engraving.
    y=min(p[1] for p in pts)+.002
    while y<max(p[1] for p in pts):
        hits=[]
        for (x1,y1),(x2,y2) in zip(pts,pts[1:]+pts[:1]):
            if (y1<=y<y2) or (y2<=y<y1):hits.append(x1+(y-y1)*(x2-x1)/(y2-y1))
        hits.sort()
        for i in range(0,len(hits)-1,2):
            line('Glacier engraving',[(hits[i],y,.0152),(hits[i+1],y,.0152)],faint,.00009)
        y+=.003
    if g['name'] in ['Vatnajökull','Hofsjökull','Langjökull','Mýrdalsjökull','Drangajökull']:
        x=sum(p[0] for p in pts)/len(pts);y=sum(p[1] for p in pts)/len(pts)
        text(g['name'].upper(),x,y-.002,.0065)

for lon in [-24,-22,-20,-18,-16,-14]:
    x,_=project(lon,65);text(str(abs(lon))+'° V',x,.401,.007,faint)
for lat in [64,65,66]:
    _,y=project(-19,lat);text(str(lat)+'° N',.592,y,.007,faint)
text('HEIMAVELLIR ÍSLANDS',.235,-.366,.016)
text('BESTA DEILD  ·  LENGJUDEILD  ·  2026',.235,-.388,.0065)
# Scale bar length is consistent with the projection at 65N (100 km).
bar=.21*100/111.195
for i in range(4):
    x=.235-bar/2+i*bar/4
    line('100 kilometre scale bar',[(x,-.416,.017),(x+bar/4,-.416,.017)],ink if i%2==0 else faint,.0012)
text('0                      50                     100 km',.235,-.432,.006,faint)
scene['geography_source']='Natural Earth 1:10m country and glaciated-area vectors. Public domain.'
result={'objects':len(scene.objects),'glaciers':len(GLACIERS),'camera':scene.camera.name}
