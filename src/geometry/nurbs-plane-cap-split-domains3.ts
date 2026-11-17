import {queryPlanarLoopWinding3,analyzePlanarLoopDomains3,locatePlanarLoopFace3} from './planar-loop-domains3.js';
import type {PlanarLoopData3} from './planar-loop-domains3.js';
import {assertOwnedNurbsCapSplitBoundaries3,nurbsCapSplitBoundaryPoint3} from './nurbs-plane-cap-split-boundaries3.js';
import type {NurbsCapSplitBoundaries3,NurbsCapSplitBoundaryCurve3} from './nurbs-plane-cap-split-boundaries3.js';
import {partitionSewnNurbsSplitEdgeByAlgebraicPlane3} from './sewn-nurbs-split-edge-plane3.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import type {Point2} from './point2.js';
import {dot3} from './point3.js';
import type {Vector3} from './point3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';

type Split=Extract<NurbsCapSplitBoundaries3,{kind:'split'}>;
export type NurbsCapSplitLoopWinding3=
 | Readonly<{kind:'boundary';source:Split;side:1|-1;loop:number;point:AlgebraicCoordinates2;edge:number}>
 | Readonly<{kind:'located';source:Split;side:1|-1;loop:number;point:AlgebraicCoordinates2;winding:number;attempts:number}>
 | Readonly<{kind:'unresolved';source:Split;side:1|-1;loop:number;point:AlgebraicCoordinates2;reason:'direction-budget';attempts:number}>;
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Exact event partition restricted to the owned child curve interval. */
function partition(curve:NurbsCapSplitBoundaryCurve3,n:Vector3,offset:AlgebraicReal){
 const sign=(t:AlgebraicReal)=>{const p=nurbsCapSplitBoundaryPoint3(curve,t);return AlgebraicReal.linearCombination((['x','y','z'] as const).map(k=>({value:p[k],coefficient:n[k]}))).add(offset).sign();},cuts=[curve.lower,curve.upper];
 if(curve.kind==='boundary'){
  for(const v of partitionSewnNurbsSplitEdgeByAlgebraicPlane3(curve.source,{normal:n,offset}).vertices)if(v.parameter.compare(curve.lower)>0&&v.parameter.compare(curve.upper)<0)cuts.push(v.parameter);
 }else {const d=dot3(n,curve.line.direction);if(d.sign()!==0){const t=offset.affine(-1n,dot3(n,curve.line.origin).neg()).affine(new Rational(1n).div(d));if(t.compare(curve.lower)>0&&t.compare(curve.upper)<0)cuts.push(t);}}
 cuts.sort((a,b)=>a.compare(b));return {vertices:cuts.map(parameter=>({parameter,sign:sign(parameter)})),intervals:cuts.slice(0,-1).map((a,i)=>({lower:a,upper:cuts[i+1]!,sign:sign(AlgebraicReal.fromRational(between(a,cuts[i+1]!)))}))};
}


export interface NurbsCapSplitDomainsCertificate3 {readonly source:Split;readonly side:1|-1;readonly loops:readonly Readonly<{loop:number;sample:AlgebraicCoordinates2;containers:readonly number[];parent:number|null;depth:number}>[];readonly faces:readonly Readonly<{outer:number;holes:readonly number[]}>[];}

export type NurbsCapSplitDomains3=
 | Readonly<{kind:'analyzed';certificate:NurbsCapSplitDomainsCertificate3}>
 | Readonly<{kind:'unresolved';source:NurbsCapSplitBoundaries3;side:1|-1;reason:'boundary-split'|'winding'|'unexpected-contact'|'inconsistent-containment';query?:NurbsCapSplitLoopWinding3}>;

export type NurbsCapSplitFaceLocation3=
 | Readonly<{kind:'located';certificate:NurbsCapSplitDomainsCertificate3;face:number;point:AlgebraicCoordinates2;location:'inside'|'outside'|'boundary';loop?:number}>
 | Readonly<{kind:'unresolved';certificate:NurbsCapSplitDomainsCertificate3;face:number;point:AlgebraicCoordinates2;query:NurbsCapSplitLoopWinding3}>;
const dataCache=new WeakMap<Split,Map<1|-1,PlanarLoopData3>>();
function dataOf(source:Split,side:1|-1):PlanarLoopData3 {let map=dataCache.get(source);if(!map){map=new Map();dataCache.set(source,map);}let data=map.get(side);if(!data){data=Object.freeze({frame:source.surface.source.boundary.frame,loops:side===1?source.positive:source.negative,edges:Object.freeze(source.edges.map(e=>e.curve)),point:(edge:number,t:AlgebraicReal)=>nurbsCapSplitBoundaryPoint3(source.edges[edge]!.curve,t),partition:(edge:number,n:Vector3,offset:AlgebraicReal)=>partition(source.edges[edge]!.curve,n,offset)});map.set(side,data);}return data;}
function assertSide(source:NurbsCapSplitBoundaries3,side:1|-1,options:Readonly<{maxDirections?:number}>):void {assertOwnedNurbsCapSplitBoundaries3(source);if(side!==1&&side!==-1)throw new RangeError('Expected cap side +1 or -1');const budget=options.maxDirections??16;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');}
export function queryNurbsCapSplitLoopWinding3(source:Split,side:1|-1,loop:number,input:Point2|AlgebraicCoordinates2,options:Readonly<{maxDirections?:number}>={}):NurbsCapSplitLoopWinding3 {assertSide(source,side,options);if(source.kind!=='split')throw new RangeError('Expected complete cap split');return Object.freeze({...queryPlanarLoopWinding3(dataOf(source,side),loop,input,options),source,side});}
const owned=new WeakSet<NurbsCapSplitDomainsCertificate3>();
export function assertOwnedNurbsCapSplitDomains3(c:NurbsCapSplitDomainsCertificate3):void {if(!owned.has(c))throw new RangeError('Expected factory-created child cap domains');}
/** The owned straight-cut construction establishes disjoint Jordan cycles;
 * the shared planar engine computes their nesting, not arbitrary embedding. */
export function analyzeNurbsCapSplitDomains3(source:NurbsCapSplitBoundaries3,side:1|-1,options:Readonly<{maxDirections?:number}>={}):NurbsCapSplitDomains3 {
 assertSide(source,side,options);if(source.kind!=='split')return Object.freeze({kind:'unresolved',source,side,reason:'boundary-split'});const q=analyzePlanarLoopDomains3(dataOf(source,side),options);
 if(q.kind==='unresolved')return Object.freeze({kind:'unresolved',reason:q.reason,source,side,...(q.query===undefined?{}:{query:Object.freeze({...q.query,source,side})})});
 const certificate=Object.freeze({source,side,loops:q.loops,faces:q.faces});owned.add(certificate);return Object.freeze({kind:'analyzed',certificate});
}
export function locateNurbsCapSplitFace3(certificate:NurbsCapSplitDomainsCertificate3,face:number,input:Point2|AlgebraicCoordinates2,options:Readonly<{maxDirections?:number}>={}):NurbsCapSplitFaceLocation3 {
 assertOwnedNurbsCapSplitDomains3(certificate);const {source,side}=certificate,q=locatePlanarLoopFace3(dataOf(source,side),certificate.faces,face,input,options);
 if(q.kind==='unresolved')return Object.freeze({...q,certificate,query:Object.freeze({...q.query,source,side})});return Object.freeze({...q,certificate});
}