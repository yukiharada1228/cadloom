import {assertOwnedNurbsCapSplitBoundaries3,nurbsCapSplitBoundaryPoint3} from './nurbs-plane-cap-split-boundaries3.js';
import type {NurbsCapSplitBoundaries3,NurbsCapSplitBoundaryCurve3} from './nurbs-plane-cap-split-boundaries3.js';
import {partitionSewnNurbsSplitEdgeByAlgebraicPlane3} from './sewn-nurbs-split-edge-plane3.js';
import {pointInPlaneFrame3} from './plane-frame3.js';
import {snapshotExactPoint2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import type {Point2} from './point2.js';
import {point3,dot3} from './point3.js';
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
/** Winding of one already noded child loop, retaining curved source pieces and
 * straight cut pieces with independently represented algebraic query points. */
export function queryNurbsCapSplitLoopWinding3(source:Split,side:1|-1,loop:number,input:Point2|AlgebraicCoordinates2,options:Readonly<{maxDirections?:number}>={}):NurbsCapSplitLoopWinding3 {
 assertOwnedNurbsCapSplitBoundaries3(source);if(source.kind!=='split')throw new RangeError('Expected complete cap split');if(side!==1&&side!==-1)throw new RangeError('Expected cap side +1 or -1');const loops=side===1?source.positive:source.negative;if(!Number.isSafeInteger(loop)||loop<0||loop>=loops.length)throw new RangeError('Invalid child cap loop');
 const budget=options.maxDirections??16;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');const point=snapshotExactPoint2(input),F=source.surface.source.boundary.frame,at=(edge:number,t:AlgebraicReal)=>{const p=pointInPlaneFrame3(F,nurbsCapSplitBoundaryPoint3(source.edges[edge]!.curve,t));if(p===null)throw new Error('Child cap boundary left its plane');return p;},boundary=(edge:number):NurbsCapSplitLoopWinding3=>Object.freeze({kind:'boundary',source,side,loop,point,edge});
 for(const use of loops[loop]!){const c=source.edges[use.edge]!.curve,p=at(use.edge,c.lower);if(p.x.compare(point.x)===0&&p.y.compare(point.y)===0)return boundary(use.edge);}
 const uu=dot3(F.u,F.u),vv=dot3(F.v,F.v);if(dot3(F.u,F.v).sign()!==0)throw new Error('Expected factory orthogonal cap chart');
 for(let attempt=0;attempt<budget;attempt++){
  const k=new Rational(attempt===0?0n:BigInt(Math.ceil(attempt/2))*(attempt%2===1?1n:-1n)),n=point3(...(['x','y','z'] as const).map(key=>F.v[key].div(vv).sub(F.u[key].mul(k).div(uu))) as Parameters<typeof point3>),offset=AlgebraicReal.linearCombination([{value:point.y,coefficient:-1n},{value:point.x,coefficient:k}],dot3(n,F.origin).neg());let retry=false,winding=0;
  for(const use of loops[loop]!){const r=partition(source.edges[use.edge]!.curve,n,offset);
   for(const v of r.vertices)if(v.sign===0&&at(use.edge,v.parameter).x.compare(point.x)===0)return boundary(use.edge);
   for(const interval of r.intervals)if(interval.sign===0){if(at(use.edge,interval.lower).x.compare(point.x)*at(use.edge,interval.upper).x.compare(point.x)<=0)return boundary(use.edge);retry=true;}
   if(r.vertices[0]!.sign===0||r.vertices.at(-1)!.sign===0){retry=true;continue;}
   for(let i=1;i+1<r.vertices.length;i++)if(r.vertices[i]!.sign===0){const before=r.intervals[i-1]!.sign,after=r.intervals[i]!.sign;if(before===0||after===0){retry=true;continue;}if(before!==after&&at(use.edge,r.vertices[i]!.parameter).x.compare(point.x)>0)winding+=after*use.direction;}
  }
  if(!retry)return Object.freeze({kind:'located',source,side,loop,point,winding,attempts:attempt+1});
 }
 return Object.freeze({kind:'unresolved',source,side,loop,point,reason:'direction-budget',attempts:budget});
}
export interface NurbsCapSplitDomainsCertificate3 {readonly source:Split;readonly side:1|-1;readonly loops:readonly Readonly<{loop:number;sample:AlgebraicCoordinates2;containers:readonly number[];parent:number|null;depth:number}>[];readonly faces:readonly Readonly<{outer:number;holes:readonly number[]}>[];}
export type NurbsCapSplitDomains3=
 | Readonly<{kind:'analyzed';certificate:NurbsCapSplitDomainsCertificate3}>
 | Readonly<{kind:'unresolved';source:NurbsCapSplitBoundaries3;side:1|-1;reason:'boundary-split'|'winding'|'unexpected-contact'|'inconsistent-containment';query?:NurbsCapSplitLoopWinding3}>;
const owned=new WeakSet<NurbsCapSplitDomainsCertificate3>();
export function assertOwnedNurbsCapSplitDomains3(c:NurbsCapSplitDomainsCertificate3):void {if(!owned.has(c))throw new RangeError('Expected factory-created child cap domains');}
/** Owned original Jordan face + complete straight cut noding + degree-one
 * cycles establish disjoint child Jordan loops. Only under that construction
 * does one boundary point per loop suffice to determine containment. */
export function analyzeNurbsCapSplitDomains3(source:NurbsCapSplitBoundaries3,side:1|-1,options:Readonly<{maxDirections?:number}>={}):NurbsCapSplitDomains3 {
 assertOwnedNurbsCapSplitBoundaries3(source);if(side!==1&&side!==-1)throw new RangeError('Expected cap side +1 or -1');const budget=options.maxDirections??16;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');const fail=(reason:Extract<NurbsCapSplitDomains3,{kind:'unresolved'}>['reason'],query?:NurbsCapSplitLoopWinding3):NurbsCapSplitDomains3=>Object.freeze({kind:'unresolved',source,side,reason,...(query===undefined?{}:{query})});if(source.kind!=='split')return fail('boundary-split');
 const cycles=side===1?source.positive:source.negative,F=source.surface.source.boundary.frame,samples=cycles.map(loop=>{const use=loop[0]!,e=source.edges[use.edge]!,q=pointInPlaneFrame3(F,source.vertices[use.direction===1?e.start:e.end]!);if(q===null)throw new Error('Cap cycle left its plane');return q;}),inside=samples.map(()=>samples.map(()=>false));
 for(let i=0;i<samples.length;i++)for(let j=0;j<samples.length;j++)if(i!==j){const q=queryNurbsCapSplitLoopWinding3(source,side,j,samples[i]!,options);if(q.kind==='boundary')return fail('unexpected-contact',q);if(q.kind==='unresolved')return fail('winding',q);if(Math.abs(q.winding)>1)return fail('inconsistent-containment',q);inside[i]![j]=q.winding!==0;}
 for(let i=0;i<samples.length;i++)for(let j=0;j<samples.length;j++)if(inside[i]![j]){if(inside[j]![i])return fail('inconsistent-containment');for(let k=0;k<samples.length;k++)if(inside[j]![k]&&!inside[i]![k]||inside[i]![k]&&j!==k&&!inside[j]![k]&&!inside[k]![j])return fail('inconsistent-containment');}
 const loops=samples.map((sample,loop)=>{const containers=inside[loop]!.flatMap((yes,id)=>yes?[id]:[]),parent=containers.find(id=>containers.every(other=>other===id||inside[id]![other]))??null;return Object.freeze({loop,sample,containers:Object.freeze(containers),parent,depth:containers.length});});if(loops.some(l=>l.depth!==0&&(l.parent===null||loops[l.parent]!.depth!==l.depth-1)))return fail('inconsistent-containment');
 const certificate=Object.freeze({source,side,loops:Object.freeze(loops),faces:Object.freeze(loops.filter(l=>l.depth%2===0).map(l=>Object.freeze({outer:l.loop,holes:Object.freeze(loops.filter(h=>h.parent===l.loop).map(h=>h.loop))})))});owned.add(certificate);return Object.freeze({kind:'analyzed',certificate});
}
export type NurbsCapSplitFaceLocation3=
 | Readonly<{kind:'located';certificate:NurbsCapSplitDomainsCertificate3;face:number;point:AlgebraicCoordinates2;location:'inside'|'outside'|'boundary';loop?:number}>
 | Readonly<{kind:'unresolved';certificate:NurbsCapSplitDomainsCertificate3;face:number;point:AlgebraicCoordinates2;query:NurbsCapSplitLoopWinding3}>;
/** Closed finite child-face domain, including cut edges and hole boundaries. */
export function locateNurbsCapSplitFace3(certificate:NurbsCapSplitDomainsCertificate3,face:number,input:Point2|AlgebraicCoordinates2,options:Readonly<{maxDirections?:number}>={}):NurbsCapSplitFaceLocation3 {
 assertOwnedNurbsCapSplitDomains3(certificate);if(!Number.isSafeInteger(face)||face<0||face>=certificate.faces.length)throw new RangeError('Invalid child cap face');const point=snapshotExactPoint2(input),group=certificate.faces[face]!,located=(location:'inside'|'outside'|'boundary',loop?:number):NurbsCapSplitFaceLocation3=>Object.freeze({kind:'located',certificate,face,point,location,...(loop===undefined?{}:{loop})});
 for(const [i,loop] of [group.outer,...group.holes].entries()){const query=queryNurbsCapSplitLoopWinding3(certificate.source,certificate.side,loop,point,options);if(query.kind==='unresolved')return Object.freeze({kind:'unresolved',certificate,face,point,query});if(query.kind==='boundary')return located('boundary',loop);if(i===0?query.winding===0:query.winding!==0)return located('outside');}
 return located('inside');
}
