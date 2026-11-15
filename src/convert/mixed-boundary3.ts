import {ellipticArc3} from '../geometry/ellipse3.js';
import {algebraicSegment3} from '../geometry/algebraic-segment3.js';
import {readBodyRecord3} from '../record/body3.js';
import {decodeBodyGeometry3} from './body3.js';
import type {DecodedBodyGeometry3} from './body3.js';
import {brepCurveEndpoints3,nativeBRepCurve3,buildMixedBRepTopology3} from '../geometry/brep-curve3.js';
import type {BRepCurve3} from '../geometry/brep-curve3.js';
import {compareAlgebraicPoints3} from '../geometry/algebraic-point3.js';
import type {BRepTopology3,BRepFaceInput3} from '../geometry/brep-topology3.js';
import type {RecordReadLimits3} from '../record/schema.js';

export interface MixedBRepBoundary3 {
  readonly geometry:DecodedBodyGeometry3;readonly topology:BRepTopology3<BRepCurve3>;
  /** Maps serialized vertex IDs to the rebuilt kernel's sorted vertex IDs. */
  readonly vertexMap:readonly number[];
}
/** Rebuild mixed face-boundary incidence and check actual geometric endpoints,
 * whole-edge support and declared shell connectivity. Not a face/solid importer.
 * Wires and NURBS faces/edges require other conversion backends.
 */
export function restoreMixedBRepBoundary3(input:unknown,limits:RecordReadLimits3={}):MixedBRepBoundary3 {
  const record=readBodyRecord3(input,limits),geometry=decodeBodyGeometry3(record,limits),curves:BRepCurve3[]=[],ssiPoints=geometry.curves.flatMap(c=>c.kind==='cylinder-ssi'?[c.arc.start,c.arc.end]:[]);
  // Exact value equality permits reusing a regenerated SSI endpoint's immutable
  // coordinate/support provenance; external coordinate claims never establish it.
  const preferred=(p:typeof geometry.vertices[number])=>ssiPoints.find(q=>compareAlgebraicPoints3(p,q)===0)??p;
  for(const e of record.edges){const c=geometry.curves[e.curve]!;if(c.kind==='nurbs')throw new RangeError('Mixed boundary conversion does not support NURBS edges');const curve=c.kind==='cylinder-ssi'?c:nativeBRepCurve3(c.kind==='algebraic-segment'?{kind:'algebraic-segment',segment:algebraicSegment3(preferred(c.segment.start),preferred(c.segment.end))}:c.kind==='elliptic-arc'?{kind:'elliptic-arc',arc:ellipticArc3(c.arc.ellipse,preferred(c.arc.start),preferred(c.arc.end),{direction:c.arc.direction,fullEllipse:c.arc.fullEllipse})}:c),ends=brepCurveEndpoints3(curve);if(compareAlgebraicPoints3(ends[0],geometry.vertices[e.start]!)!==0||compareAlgebraicPoints3(ends[1],geometry.vertices[e.end]!)!==0)throw new RangeError('Edge geometry does not match its declared vertices');curves.push(curve);}
  const directions=new Map<number,1|-1>();
  for(const shell of record.shells){if(shell.kind!=='faces'||shell.wires.length)throw new RangeError('Mixed face boundary conversion does not support wire or vertex shells');for(const f of shell.faces)directions.set(f.face,f.direction);}
  const faces:BRepFaceInput3[]=record.faces.map((f,id)=>{
    const surface=geometry.surfaces[f.surface]!;if(surface.kind==='nurbs')throw new RangeError('Mixed boundary conversion does not support NURBS surfaces');const d=directions.get(id)!;
    return {surface,sense:(f.sense*d) as 1|-1,loops:f.loops.map(l=>{const uses=record.loops[l]!.uses;return (d===1?uses:[...uses].reverse()).map(u=>({edge:u.edge,direction:(u.direction*d) as 1|-1}));})};
  });
  const topology=buildMixedBRepTopology3(curves,faces),vertexMap=geometry.vertices.map(p=>topology.vertices.findIndex(q=>compareAlgebraicPoints3(p,q)===0));
  if(vertexMap.some(i=>i<0)||new Set(vertexMap).size!==vertexMap.length||vertexMap.length!==topology.vertices.length)throw new RangeError('Serialized vertex identity is incompatible with exact endpoint welding');
  const declared=record.shells.map(s=>s.kind==='faces'?[...s.faces.map(f=>f.face)].sort((a,b)=>a-b):[]),actual=topology.shells.map(s=>[...s.faces].sort((a,b)=>a-b));
  if(declared.length!==actual.length||declared.some(s=>!actual.some(t=>s.length===t.length&&s.every((f,i)=>f===t[i]))))throw new RangeError('Declared shell faces do not match edge-connected kernel shells');
  return Object.freeze({geometry,topology,vertexMap:Object.freeze(vertexMap)});
}
