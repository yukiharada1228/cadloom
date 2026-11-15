import {readBodyRecord3} from '../record/body3.js';
import {decodeBodyGeometry3} from './body3.js';
import type {DecodedBodyGeometry3} from './body3.js';
import {curveEndpoints3} from '../geometry/curve3.js';
import type {Curve3} from '../geometry/curve3.js';
import {compareAlgebraicPoints3} from '../geometry/algebraic-point3.js';
import {buildBRepTopology3} from '../geometry/brep-topology3.js';
import type {BRepTopology3,BRepFaceInput3} from '../geometry/brep-topology3.js';
import type {RecordReadLimits3} from '../record/schema.js';

export interface NativeBRepBoundary3 {
  readonly geometry:DecodedBodyGeometry3;readonly topology:BRepTopology3;
  /** Maps serialized vertex IDs to the rebuilt kernel's sorted vertex IDs. */
  readonly vertexMap:readonly number[];
}
/** Rebuild native face-boundary incidence and check actual geometric endpoints,
 * whole-edge support and declared shell connectivity. Not a face/solid importer.
 * Wires and NURBS faces/edges require other conversion backends.
 */
export function restoreNativeBRepBoundary3(input:unknown,limits:RecordReadLimits3={}):NativeBRepBoundary3 {
  const record=readBodyRecord3(input,limits),geometry=decodeBodyGeometry3(record,limits),curves:Curve3[]=[];
  for(const e of record.edges){const c=geometry.curves[e.curve]!;if(c.kind==='nurbs'||c.kind==='cylinder-ssi')throw new RangeError('Native boundary conversion requires native edges; NURBS and cylinder SSI need other backends');const ends=curveEndpoints3(c);if(compareAlgebraicPoints3(ends[0],geometry.vertices[e.start]!)!==0||compareAlgebraicPoints3(ends[1],geometry.vertices[e.end]!)!==0)throw new RangeError('Edge geometry does not match its declared vertices');curves.push(c);}
  const directions=new Map<number,1|-1>();
  for(const shell of record.shells){if(shell.kind!=='faces'||shell.wires.length)throw new RangeError('Native face boundary conversion does not support wire or vertex shells');for(const f of shell.faces)directions.set(f.face,f.direction);}
  const faces:BRepFaceInput3[]=record.faces.map((f,id)=>{
    const surface=geometry.surfaces[f.surface]!;if(surface.kind==='nurbs')throw new RangeError('Native boundary conversion does not support NURBS surfaces');const d=directions.get(id)!;
    return {surface,sense:(f.sense*d) as 1|-1,loops:f.loops.map(l=>{const uses=record.loops[l]!.uses;return (d===1?uses:[...uses].reverse()).map(u=>({edge:u.edge,direction:(u.direction*d) as 1|-1}));})};
  });
  const topology=buildBRepTopology3(curves,faces),vertexMap=geometry.vertices.map(p=>topology.vertices.findIndex(q=>compareAlgebraicPoints3(p,q)===0));
  if(vertexMap.some(i=>i<0)||new Set(vertexMap).size!==vertexMap.length||vertexMap.length!==topology.vertices.length)throw new RangeError('Serialized vertex identity is incompatible with exact endpoint welding');
  const declared=record.shells.map(s=>s.kind==='faces'?[...s.faces.map(f=>f.face)].sort((a,b)=>a-b):[]),actual=topology.shells.map(s=>[...s.faces].sort((a,b)=>a-b));
  if(declared.length!==actual.length||declared.some(s=>!actual.some(t=>s.length===t.length&&s.every((f,i)=>f===t[i]))))throw new RangeError('Declared shell faces do not match edge-connected kernel shells');
  return Object.freeze({geometry,topology,vertexMap:Object.freeze(vertexMap)});
}
