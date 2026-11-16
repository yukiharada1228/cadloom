import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import {assertOwnedNurbsAffineIntersectionComplex3,nurbsAffineIntersectionComplexEdgePoint3} from './nurbs-affine-intersection-seams3.js';
import type {NurbsAffineIntersectionComplex3} from './nurbs-affine-intersection-seams3.js';
import type {TrimmedNurbsAffineIntersectionPoint3} from './nurbs-affine-intersection-trim3.js';
import {analyzeNurbsAffineIntersectionComplexEdgeEvents3} from './nurbs-affine-intersection-events3.js';
import type {TrimmedNurbsIntersectionDifferentialEvents3} from './nurbs-affine-intersection-events3.js';
import {nurbsAffineIntersectionComplexEdgeDifferential3} from './nurbs-affine-intersection-differential3.js';
import type {TrimmedNurbsAffineIntersectionEdgeDifferential3} from './nurbs-affine-intersection-differential3.js';
type Event=Readonly<{sourceEdge:number;use:number;parameter:AlgebraicReal;differential:TrimmedNurbsAffineIntersectionEdgeDifferential3}>;
export interface RefinedNurbsIntersectionVertex3 {
 readonly point:TrimmedNurbsAffineIntersectionPoint3;
 /** Original IDs remain stable, including isolated vertices. */
 readonly sourceVertex:number|null;readonly events:readonly Event[];
}
export interface RefinedNurbsIntersectionEdge3 {
 readonly sourceEdge:number;readonly from:number;readonly to:number;
 readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;
 readonly uses:readonly Readonly<{use:number;patch:number;edge:number;interval:TrimmedNurbsIntersectionDifferentialEvents3['intervals'][number]}>[];
}
export interface RefinedNurbsAffineIntersectionComplex3 {
 readonly source:NurbsAffineIntersectionComplex3;
 readonly vertices:readonly RefinedNurbsIntersectionVertex3[];readonly edges:readonly RefinedNurbsIntersectionEdge3[];
 /** Ordered children of each original edge, with exact adjacent bounds. */
 readonly sourceEdges:readonly (readonly number[])[];
 readonly curveComponents:NurbsAffineIntersectionComplex3['curveComponents'];
 /** Implicit regions are carried separately; no new region boundary is inferred. */
 readonly regions:NurbsAffineIntersectionComplex3['regions'];
}
const owned=new WeakSet<RefinedNurbsAffineIntersectionComplex3>();
const same=(a:TrimmedNurbsAffineIntersectionPoint3,b:TrimmedNurbsAffineIntersectionPoint3)=>a.u.compare(b.u)===0&&a.v.compare(b.v)===0&&a.targetU.compare(b.targetU)===0&&a.targetV.compare(b.targetV)===0&&compareAlgebraicPoints3(a.point,b.point)===0;
/** Insert every synchronized differential event as an actual graph vertex.
 * The source is immutable; spatially equal distinct source parameters stay apart. */
export function refineNurbsAffineIntersectionComplex3(source:NurbsAffineIntersectionComplex3):RefinedNurbsAffineIntersectionComplex3 {
 assertOwnedNurbsAffineIntersectionComplex3(source);
 const vertices:{point:TrimmedNurbsAffineIntersectionPoint3;sourceVertex:number|null;events:Event[]}[]=source.vertices.map((point,sourceVertex)=>({point,sourceVertex:sourceVertex as number|null,events:[] as Event[]})),edges:RefinedNurbsIntersectionEdge3[]=[],sourceEdges:number[][]=[];
 for(let id=0;id<source.edges.length;id++){
  const original=source.edges[id]!,analysis=analyzeNurbsAffineIntersectionComplexEdgeEvents3(source,id),children:number[]=[],ids=analysis.parameters.map((parameter,i)=>{
   const point=nurbsAffineIntersectionComplexEdgePoint3(source,id,parameter);let v=i===0?original.from:i===analysis.parameters.length-1?original.to:vertices.findIndex(q=>same(q.point,point));
   if(v<0){v=vertices.length;vertices.push({point,sourceVertex:null,events:[]});}
   if(!same(vertices[v]!.point,point))throw new Error('Refined endpoint lost source vertex geometry');
   for(const u of analysis.uses){const differential=u.events[i]!.differential;if(!same(point,{...point,...differential.intersectionPoint}))throw new Error('Refined incident uses disagree on intersection point');vertices[v]!.events.push(Object.freeze({sourceEdge:id,use:u.use,parameter,differential}));}
   return v;
  });
  for(let i=0;i+1<analysis.parameters.length;i++){
   const lower=analysis.parameters[i]!,upper=analysis.parameters[i+1]!;if(lower.compare(upper)>=0)throw new Error('Refinement produced a nonpositive interval');
   children.push(edges.length);edges.push(Object.freeze({sourceEdge:id,from:ids[i]!,to:ids[i+1]!,lower,upper,uses:Object.freeze(analysis.uses.map(u=>Object.freeze({use:u.use,patch:u.patch,edge:u.edge,interval:u.intervals[i]!})))}));
  }
  sourceEdges.push(children);
 }
 // Subdivision preserves components, including isolated original vertices.
 const curveComponents=Object.freeze(source.curveComponents.map(c=>{
  const childEdges=c.edges.flatMap(e=>sourceEdges[e]!),vs=new Set(c.vertices);for(const id of childEdges){vs.add(edges[id]!.from);vs.add(edges[id]!.to);}return Object.freeze({vertices:Object.freeze([...vs].sort((a,b)=>a-b)),edges:Object.freeze(childEdges)});
 }));
 const result=Object.freeze({source,vertices:Object.freeze(vertices.map(v=>Object.freeze({...v,events:Object.freeze(v.events)}))),edges:Object.freeze(edges),sourceEdges:Object.freeze(sourceEdges.map(ids=>Object.freeze(ids))),curveComponents,regions:source.regions});owned.add(result);return result;
}
export function assertOwnedRefinedNurbsAffineIntersectionComplex3(source:RefinedNurbsAffineIntersectionComplex3):void {if(!owned.has(source))throw new RangeError('Expected a factory-created refined intersection complex');}
function selected(source:RefinedNurbsAffineIntersectionComplex3,edge:number,parameter:AlgebraicReal|ExactInput){
 assertOwnedRefinedNurbsAffineIntersectionComplex3(source);
 if(!Number.isSafeInteger(edge)||edge<0||edge>=source.edges.length)throw new RangeError('Invalid refined intersection edge');
 const e=source.edges[edge]!,t=parameter instanceof AlgebraicReal?parameter:AlgebraicReal.fromRational(parameter);
 if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the refined intersection edge');return {e,t};
}
export function refinedNurbsAffineIntersectionEdgePoint3(source:RefinedNurbsAffineIntersectionComplex3,edge:number,parameter:AlgebraicReal|ExactInput):TrimmedNurbsAffineIntersectionPoint3 {
 const {e,t}=selected(source,edge,parameter);return nurbsAffineIntersectionComplexEdgePoint3(source.source,e.sourceEdge,t);
}
export function refinedNurbsAffineIntersectionEdgeDifferential3(source:RefinedNurbsAffineIntersectionComplex3,edge:number,use:number,parameter:AlgebraicReal|ExactInput):TrimmedNurbsAffineIntersectionEdgeDifferential3 {
 const {e,t}=selected(source,edge,parameter);if(!Number.isSafeInteger(use)||use<0||use>=e.uses.length)throw new RangeError('Invalid refined intersection use');return nurbsAffineIntersectionComplexEdgeDifferential3(source.source,e.sourceEdge,e.uses[use]!.use,t);
}
