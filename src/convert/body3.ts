import {encodeBRepCurveRecord3,decodeBRepCurveRecord3} from './brep-curve3.js';
import type {BRepCurve3} from '../geometry/brep-curve3.js';
import type {BodyCurveRecord3} from '../record/body3.js';
import type {BRepTopology3} from '../geometry/brep-topology3.js';
import type {AlgebraicCoordinates3} from '../geometry/algebraic-point3.js';
import {nurbsCurveSpans3} from '../geometry/nurbs-curve3.js';
import {curveOnSurface3} from '../geometry/curve3.js';
import {plane3} from '../geometry/plane3.js';
import {readBodyRecord3} from '../record/body3.js';
import type {BodyRecord3,BodyRegionRecord3} from '../record/body3.js';
import type {RecordReadLimits3} from '../record/schema.js';
import {encodeExactPoint3,decodeExactPoint3} from './exact3.js';
import {encodeCurveRecord3,encodeSurfaceRecord3,decodeCurveRecord3,decodeSurfaceRecord3} from './geometry3.js';
import type {RecordCurveGeometry3,RecordSurfaceGeometry3} from './geometry3.js';

/** Exports boundary tables. Regions must be supplied, never inferred as material
 * merely from closed incidence. No face/solid validity claim is added.
 */
export function bodyRecordFromTopology3(input:BRepTopology3,regions:readonly BodyRegionRecord3[]):BodyRecord3 {
  return boundaryRecord3(input,regions,encodeCurveRecord3);
}
export function bodyRecordFromMixedTopology3(input:BRepTopology3<BRepCurve3>,regions:readonly BodyRegionRecord3[]):BodyRecord3 {
  return boundaryRecord3(input,regions,c=>{const r=encodeBRepCurveRecord3(c);return r.kind==='native'?r.curve:r;});
}
function boundaryRecord3<C>(input:BRepTopology3<C>,regions:readonly BodyRegionRecord3[],encode:(c:C)=>BodyCurveRecord3):BodyRecord3 {
  return readBodyRecord3({version:1,units:'mm',coordinates:'right-handed-z-up',curves:input.edges.map(e=>encode(e.curve)),surfaces:input.faces.map(f=>encodeSurfaceRecord3(f.surface)),vertices:input.vertices.map(encodeExactPoint3),edges:input.edges.map((e,curve)=>({curve,start:e.start,end:e.end})),loops:input.loops.map(l=>({uses:l.coedges.map(id=>{const c=input.coedges[id]!;return {edge:c.edge,direction:c.direction};})})),faces:input.faces.map((f,surface)=>({surface,sense:f.sense,loops:f.loops})),shells:input.shells.map(s=>({kind:'faces',faces:s.faces.map(face=>({face,direction:1})),wires:[]})),regions});
}
export interface DecodedBodyGeometry3 {
  readonly record:BodyRecord3;readonly vertices:readonly AlgebraicCoordinates3[];
  readonly curves:readonly (RecordCurveGeometry3|Extract<BRepCurve3,{kind:'cylinder-ssi'}>)[];readonly surfaces:readonly RecordSurfaceGeometry3[];
}
/** Builds each geometry definition. Does NOT check geometry/topology agreement,
 * face domains, shell connectivity/embedding, void containment or solid validity.
 */
export function decodeBodyGeometry3(input:unknown,limits:RecordReadLimits3={}):DecodedBodyGeometry3 {
  const record=readBodyRecord3(input,limits),vertices=Object.freeze(record.vertices.map(decodeExactPoint3)),curves=Object.freeze(record.curves.map(c=>c.kind==='cylinder-ssi'?decodeBRepCurveRecord3(c) as Extract<BRepCurve3,{kind:'cylinder-ssi'}>:decodeCurveRecord3(c))),surfaces=Object.freeze(record.surfaces.map(decodeSurfaceRecord3));
  const xy={kind:'plane' as const,plane:plane3(0n,0n,1n,0n)};
  for(const loop of record.loops)for(const u of loop.uses)if(u.pcurve!==undefined){const c=curves[u.pcurve]!;if(c.kind==='cylinder-ssi'||(c.kind==='nurbs'?nurbsCurveSpans3(c.curve).some(s=>s.z.degree>=0):!curveOnSurface3(c,xy)))throw new RangeError('A pcurve must lie in local (u,v,0) coordinates');}
  return Object.freeze({record,vertices,curves,surfaces});
}
