import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';
import type {ExactInput} from './point2.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {assertOwnedSewnNurbsSourceBReps3} from './sew-nurbs-source-breps3.js';
import type {SewnNurbsSourceBReps3,SewnNurbsSourceEdge3,SewnNurbsSourceFace3} from './sew-nurbs-source-breps3.js';
import {buildBRepTopologyWithGeometryAdapters3} from './brep-topology3.js';
import type {BRepTopology3,BRepEdgeUse3} from './brep-topology3.js';
import {evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import {snapshotExactPoint3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {Point3} from './point3.js';
import {nurbsBoundaryCoordinateRoots3} from './nurbs-intersection-boundary-nodes3.js';
export interface NurbsSourcePlaneEdgeFragment3 {
 readonly parent:number;readonly source:SewnNurbsSourceEdge3;
 readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;
 readonly sign:-1|0|1;readonly sampleParameter:Rational;
}
export interface SewnNurbsSourceEdgePlane3 {
 readonly source:Extract<SewnNurbsSourceBReps3,{kind:'sewn'}>;readonly plane:Plane3;
 readonly topology:BRepTopology3<NurbsSourcePlaneEdgeFragment3,SewnNurbsSourceFace3>;
 /** Original topology edge -> children in increasing canonical native parameter. */
 readonly sourceUses:readonly (readonly BRepEdgeUse3[])[];
}
const ownedFragments=new WeakSet<NurbsSourcePlaneEdgeFragment3>(),ownedReports=new WeakSet<SewnNurbsSourceEdgePlane3>();
export function assertOwnedSewnNurbsSourceEdgePlane3(report:SewnNurbsSourceEdgePlane3):void {if(!ownedReports.has(report))throw new RangeError('Expected factory-created source edge plane refinement');}
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {
 while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}
 return a.upper.add(b.lower).div(new Rational(2n));
}
/** Refine existing shared edges at every plane root, including tangent roots.
 * Original faces are retained: this is not an interior face or Body split. */
export function refineSewnNurbsSourceEdgesByPlane3(source:SewnNurbsSourceBReps3,input:Plane3):SewnNurbsSourceEdgePlane3 {
 assertOwnedSewnNurbsSourceBReps3(source);if(source.kind!=='sewn')throw new RangeError('Source boundary sewing is unresolved');
 const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset),T=source.topology,fragments:NurbsSourcePlaneEdgeFragment3[]=[],sourceUses:readonly BRepEdgeUse3[][]=T.edges.map((e,parent)=>{
  const s=e.curve,p=s.map.span,F=p.x.scale(plane.normal.x).add(p.y.scale(plane.normal.y)).add(p.z.scale(plane.normal.z)).add(p.weight.scale(plane.offset));
  const cuts=[s.lower,s.upper,...(F.degree>0?AlgebraicReal.isolate(F):[]).filter(t=>t.compare(s.lower)>0&&t.compare(s.upper)<0)].sort((a,b)=>a.compare(b)).filter((t,i,all)=>i===0||t.compare(all[i-1]!)!==0),uses:BRepEdgeUse3[]=[];
  for(let i=0;i+1<cuts.length;i++){
   const lower=cuts[i]!,upper=cuts[i+1]!,sampleParameter=between(lower,upper);
   if(p.weight.evaluate(sampleParameter).sign()<=0)throw new Error('Source boundary lost positive homogeneous weight');
   const sign=F.evaluate(sampleParameter).sign();if(F.degree>=0&&sign===0)throw new Error('Complete edge cuts left an interior plane root');
   const edge=Object.freeze({parent,source:s,lower,upper,sign,sampleParameter});ownedFragments.add(edge);uses.push(Object.freeze({edge:fragments.length,direction:1}));fragments.push(edge);
  }
  return uses;
 });
 const surfaces=new Set(T.faces.map(f=>f.surface)),topology=buildBRepTopologyWithGeometryAdapters3(fragments,T.faces.map(f=>({surface:f.surface,sense:f.sense,loops:f.loops.map(loop=>T.loops[loop]!.coedges.flatMap(id=>{const c=T.coedges[id]!,children=sourceUses[c.edge]!;return c.direction===1?children:[...children].reverse().map(u=>({edge:u.edge,direction:(-u.direction) as 1|-1}));}))})),{
  snapshot:(e:NurbsSourcePlaneEdgeFragment3)=>{if(!ownedFragments.has(e))throw new RangeError('Expected factory-created plane edge fragment');return e;},
  endpoints:e=>[evaluateNurbsSpanPoint3(e.source.map.span,e.lower),evaluateNurbsSpanPoint3(e.source.map.span,e.upper)] as const,closed:()=>false,
  snapshotSurface:(f:SewnNurbsSourceFace3)=>{if(!surfaces.has(f))throw new RangeError('Expected original sewn source face');return f;},
  onSurface:(e,f)=>T.edges[e.parent]!.coedges.some(c=>T.faces[T.coedges[c]!.face]!.surface===f),
 });
 if(T.closed&&!topology.closed||T.consistentlyOriented&&!topology.consistentlyOriented||T.manifoldVertices&&!topology.manifoldVertices)throw new Error('Shared edge refinement changed source incidence validity');
 const result=Object.freeze({source,plane,topology,sourceUses:Object.freeze(sourceUses.map(u=>Object.freeze(u)))});ownedReports.add(result);return result;
}
export function nurbsSourcePlaneEdgeFragmentPoint3(edge:NurbsSourcePlaneEdgeFragment3,input:AlgebraicReal|ExactInput):ReturnType<typeof evaluateNurbsSpanPoint3> {
 if(!ownedFragments.has(edge))throw new RangeError('Expected factory-created plane edge fragment');
 const t=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);if(t.compare(edge.lower)<0||t.compare(edge.upper)>0)throw new RangeError('Parameter is outside the plane edge fragment');
 return evaluateNurbsSpanPoint3(edge.source.map.span,t);
}
/** Complete finite parameter preimages of an exact spatial point. Norm roots
 * are filtered against the selected real coordinate and then full XYZ. */
export function nurbsSourcePlaneEdgeFragmentPointPreimages3(edge:NurbsSourcePlaneEdgeFragment3,input:Point3|AlgebraicCoordinates3):readonly AlgebraicReal[] {
 if(!ownedFragments.has(edge))throw new RangeError('Expected factory-created plane edge fragment');
 const point=snapshotExactPoint3(input),span=edge.source.map.span;
 for(const key of ['x','y','z'] as const){
  const roots=nurbsBoundaryCoordinateRoots3(span,key,point[key]);
  if(roots===null)continue;
  return Object.freeze(roots.filter(t=>t.compare(edge.lower)>=0&&t.compare(edge.upper)<=0&&compareAlgebraicPoints3(evaluateNurbsSpanPoint3(span,t),point)===0));
 }
 throw new Error('An embedded source boundary unexpectedly has a constant spatial image');
}
