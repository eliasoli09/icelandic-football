"""Author Blender guides, export their samples, and build an editable ribbon study."""
import bpy, math, json, random
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import interpolate_bezier
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/entrance'
W, H = 16.0, 7.0
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = 1, 600
scene.render.fps = 30
scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1600, 700
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Near-black studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.0003,.0006,.0007,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.3
scene.view_settings.view_transform='AgX'
scene.view_settings.look='AgX - Medium High Contrast'
controls = [
 [(0,.57),(.15,.52),(.30,.46),(.43,.53),(.56,.62),(.69,.49),(.80,.33),(.91,.35),(1,.21)],
 [(0,.55),(.15,.50),(.30,.46),(.43,.23),(.56,.20),(.69,.49),(.80,.72),(.91,.51),(1,.17)],
 [(0,.58),(.15,.55),(.30,.50),(.43,.34),(.56,.37),(.69,.70),(.80,.67),(.91,.31),(1,.23)],
]
def world(x,y,d=0): return (W*(x-.5),d,H*(.5-y))
def width(x,layer):
    return (.055 + .185*(.5-.5*math.cos(math.pi*x)) + .052*math.sin(x*math.pi*2-1)**2)*[1.14,1,.87][layer]
guides=[]
for li, cps in enumerate(controls):
    data=bpy.data.curves.new(f'Guide {li+1} — editable Bezier','CURVE'); data.dimensions='3D'
    spline=data.splines.new('BEZIER'); spline.bezier_points.add(len(cps)-1)
    for p,(x,y) in zip(spline.bezier_points,cps):
        p.co=world(x,y,li*.3); p.handle_left_type=p.handle_right_type='AUTO'
    ob=bpy.data.objects.new(f'GUIDE_{li+1}',data); scene.collection.objects.link(ob)
    ob.hide_render=True; ob.hide_set(True)
    bpy.context.view_layer.update()
    dense=[]
    for a,b in zip(spline.bezier_points,list(spline.bezier_points)[1:]):
        dense.extend(interpolate_bezier(a.co,a.handle_right,b.handle_left,b.co,65)[:-1])
    dense.append(spline.bezier_points[-1].co.copy())
    dense.sort(key=lambda p:p.x)
    def sample(x):
        target=W*(x-.5)
        for a,b in zip(dense,dense[1:]):
            if a.x <= target <= b.x:
                f=(target-a.x)/(b.x-a.x)
                return .5-(a.z+(b.z-a.z)*f)/H
        return cps[-1][1]
    guides.append({'depth':[.28,.62,.90][li], 'points':[{'x':round(i/16,6),'y':round(sample(i/16),6),'spread':round(width(i/16,li),6)} for i in range(17)]})
( ROOT/'web/src/components/LightWaves/ribbon-guides.json').write_text(json.dumps({'source':'Blender-authored Bezier guides; assets/entrance/golden-ribbons.blend, GUIDE_1–3. Coordinates: x right, y down, spread total ribbon width / hero height.','layers':guides},indent=2)+'\n')
print('GUIDE_JSON_EXPORTED',flush=True)

def interp(points,x,key='y'):
    k=min(15,int(x*16)); f=x*16-k
    a=points[max(0,k-1)][key]; b=points[k][key]; c=points[k+1][key]; d=points[min(16,k+2)][key]
    return .5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f)

def emission(name,color,strength):
    mat=bpy.data.materials.new(name);mat.diffuse_color=(*color,1);mat.use_nodes=True
    nt=mat.node_tree;nt.nodes.clear()
    output=nt.nodes.new('ShaderNodeOutputMaterial'); em=nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value=(*color,1)
    geo=nt.nodes.new('ShaderNodeNewGeometry');sep=nt.nodes.new('ShaderNodeSeparateXYZ');remap=nt.nodes.new('ShaderNodeMapRange')
    remap.inputs['From Min'].default_value=-8;remap.inputs['From Max'].default_value=4
    remap.inputs['To Min'].default_value=.025*strength;remap.inputs['To Max'].default_value=strength;remap.clamp=True
    nt.links.new(geo.outputs['Position'],sep.inputs[0]);nt.links.new(sep.outputs['X'],remap.inputs['Value']);nt.links.new(remap.outputs['Result'],em.inputs['Strength']);nt.links.new(em.outputs[0],output.inputs['Surface'])
    return mat
mats=[emission('Distant antique gold',(.53,.245,.046),1.1),emission('Rich warm gold',(.95,.48,.095),2.2),emission('Champagne glints',(1,.76,.34),2.8)]
def field(layer, x, strand, time, amplitude=1):
    phase=[.35,0,-.45][layer]; t=time*[.76,1,.87][layer]
    warped=max(0,min(1,x+amplitude*.025*math.sin(x*math.pi)*math.sin(t*.17+phase)))
    guide=guides[layer]['points']
    envelope=.35+.65*math.sin(max(0,min(1,x))*math.pi*.5)
    center=interp(guide,warped)+amplitude*envelope*(.080*math.sin(x*7.4-t*.39+phase)+.032*math.sin(x*12.4-t*.23+phase*.7)+.025*math.sin(x*3.6-t*.11))
    spread=.024+interp(guide,warped,'spread')*(1+amplitude*(-.22+.43*math.cos(x*6.8-t*.27+phase)))
    fine=amplitude*.006*math.sin(x*18-time*.31+strand*2+layer)*strand
    return center+spread*strand+fine

for li,n in enumerate([25,42,29]):
    collection=bpy.data.collections.new(['01 Distant silk','02 Main flowing gold','03 Champagne depth'][li]);scene.collection.children.link(collection)
    for strand in range(n):
        q=(strand/(n-1)-.5)
        data=bpy.data.curves.new(f'Filament {li+1}.{strand+1:02d}','CURVE');data.dimensions='3D'
        data.bevel_depth=[.001,.0014,.001][li]*(1.3 if strand%9==0 else 1);data.bevel_resolution=1;data.resolution_u=2
        spline=data.splines.new('POLY');spline.points.add(128)
        for i,p in enumerate(spline.points):
            x=i/128;p.co=(*world(x,field(li,x,q,7.5),li*.3+q*.065),1)
        ob=bpy.data.objects.new(data.name,data);collection.objects.link(ob)
        data.materials.append(mats[2 if li==1 and strand%13==0 else (1 if li==1 else 0)])
        ob.shape_key_add(name='Basis — wave time 7.5')
        # Exact runtime field sampled every 1/3 second. Linear adjacent weights
        # interpolate positions, not a whole rendered image or translation layer.
        for frame in range(1,602,10):
            seconds=7.5+(frame-1)/30
            key=ob.shape_key_add(name=f'Runtime field t={seconds:.3f}')
            for i,kp in enumerate(key.data):
                x=i/128;kp.co=world(x,field(li,x,q,seconds),li*.3+q*.065)
            for kf,value in [(max(1,frame-10),0),(frame,1),(min(601,frame+10),0)]:
                # Boundary keys should retain their exact endpoint poses.
                if (frame==1 and kf==1 and value==0) or (frame==601 and kf==601 and value==0):continue
                key.value=value;key.keyframe_insert(data_path='value',frame=kf)
        action=data.shape_keys.animation_data.action
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for kp in fc.keyframe_points:kp.interpolation='LINEAR'
        ob['layer']=li+1;ob['strand']=strand+1
random.seed(91)
particles=bpy.data.collections.new('04 Sparse drifting gold');scene.collection.children.link(particles)
for i in range(28):
    x=random.uniform(.32,1);y=interp(guides[1]['points'],x)+random.uniform(-.14,.14)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=random.uniform(.005,.014),location=world(x,y,-.1))
    ob=bpy.context.object;ob.name=f'Drifting dust {i+1:02d}'
    for col in list(ob.users_collection):col.objects.unlink(ob)
    particles.objects.link(ob);ob.data.materials.append(mats[1])
    base=ob.location.copy()
    for frame in range(1,602,30):
        phase=(frame-1)/600*math.tau+i
        ob.location=base+Vector((.09*math.sin(phase),0,.035*math.sin(2*math.pi*(frame-1)/600+i)))
        fade=(.5+.5*math.cos(phase))**.6
        ob.scale=(fade,fade,fade);ob.keyframe_insert(data_path='location',frame=frame);ob.keyframe_insert(data_path='scale',frame=frame)
camdata=bpy.data.cameras.new('Hero composition — orthographic');cam=bpy.data.objects.new('Camera',camdata);scene.collection.objects.link(cam)
cam.location=(0,-20,0);cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=W;scene.camera=cam
nt=bpy.data.node_groups.new('Subtle gold halation','CompositorNodeTree'); scene.compositing_node_group=nt
nt.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
rl=nt.nodes.new('CompositorNodeRLayers');glare=nt.nodes.new('CompositorNodeGlare')
glare.inputs['Type'].default_value='Fog Glow';glare.inputs['Quality'].default_value='Medium';glare.inputs['Threshold'].default_value=1.2;glare.inputs['Size'].default_value=.25;glare.inputs['Strength'].default_value=.12
out=nt.nodes.new('NodeGroupOutput');nt.links.new(rl.outputs['Image'],glare.inputs['Image']);nt.links.new(glare.outputs['Image'],out.inputs['Image'])
scene['runtime_pipeline']='Bezier guides exported to ribbon-guides.json; browser evaluates its own real-time time-driven deformation. No video is used by the site.'
scene['animation']='20-second excerpt of the exact browser field, starting at wave time 7.5. Noncommensurate currents do not loop; the browser continues without a reset.'
scene.frame_set(1)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'golden-ribbons.blend'))
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'golden-ribbons-preview.png')
bpy.ops.render.render(write_still=True)
print('RIBBON_STUDIO_COMPLETE',flush=True)
