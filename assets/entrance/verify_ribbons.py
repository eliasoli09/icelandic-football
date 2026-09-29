"""Verify exported guides and actual evaluated Blender deformation."""
import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
blob=json.loads((root/'web/src/components/LightWaves/ribbon-guides.json').read_text())
assert len(blob['layers'])==3
for layer in blob['layers']:
    assert len(layer['points'])==17
    assert all(a['x']<b['x'] for a,b in zip(layer['points'],layer['points'][1:]))
    assert layer['points'][0]['x']==0 and layer['points'][-1]['x']==1
filaments=[ob for ob in bpy.data.objects if ob.name.startswith('Filament ')]
assert len(filaments)==96, len(filaments)
assert sum(ob.name.startswith('GUIDE_') for ob in bpy.data.objects)==3
assert sum(ob.name.startswith('Drifting dust ') for ob in bpy.data.objects)==28
ob=filaments[42]
def pose(frame):
    bpy.context.scene.frame_set(frame)
    evaluated=ob.evaluated_get(bpy.context.evaluated_depsgraph_get()); mesh=evaluated.to_mesh()
    result=[v.co.copy() for v in mesh.vertices];evaluated.to_mesh_clear()
    return result
start,mid,end=pose(1),pose(151),pose(601)
travel=max((a-b).length for a,b in zip(start,mid))
loop=max((a-b).length for a,b in zip(start,end))
assert travel>.01,travel
assert loop>.01,loop  # Noncommensurate study must keep evolving instead of resetting.
print(json.dumps({'guides':3,'samples_per_guide':17,'filaments':96,'dust':28,'study_seconds':20,'max_deformation_m':round(travel,6),'end_displacement_m':round(loop,6),'external_images':sum(im.source=='FILE' for im in bpy.data.images)},indent=2))
