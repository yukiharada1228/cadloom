import {pointInPlaneFrame3} from './plane-frame3.js';
import type {PlaneFrame3} from './plane-frame3.js';
import {snapshotExactPoint2} from './algebraic-point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {Point2} from './point2.js';
import {point3,dot3} from './point3.js';
import type {Vector3} from './point3.js';
import type {BRepEdgeUse3} from './brep-topology3.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';
/** Internal adapter: callers must establish owned disjoint Jordan loops and
 * complete native curve/plane partitions. Structural data alone is no proof. */
export interface PlanarLoopData3 {
 readonly frame:PlaneFrame3;readonly loops:readonly (readonly BRepEdgeUse3[])[];
 readonly edges:readonly Readonly<{lower:AlgebraicReal;upper:AlgebraicReal}>[];
 readonly point:(edge:number,t:AlgebraicReal)=>AlgebraicCoordinates3;
 readonly partition:(edge:number,n:Vector3,offset:AlgebraicReal)=>Readonly<{vertices:readonly Readonly<{parameter:AlgebraicReal;sign:number}>[];intervals:readonly Readonly<{lower:AlgebraicReal;upper:AlgebraicReal;sign:number}>[]}>;
}
export type PlanarLoopWinding3=
 | Readonly<{kind:'boundary';loop:number;point:AlgebraicCoordinates2;edge:number}>
 | Readonly<{kind:'located';loop:number;point:AlgebraicCoordinates2;winding:number;attempts:number}>
 | Readonly<{kind:'unresolved';loop:number;point:AlgebraicCoordinates2;reason:'direction-budget';attempts:number}>;
export interface PlanarLoopDomainGroups3 {readonly loops:readonly Readonly<{loop:number;sample:AlgebraicCoordinates2;containers:readonly number[];parent:number|null;depth:number}>[];readonly faces:readonly Readonly<{outer:number;holes:readonly number[]}>[];}
export type PlanarLoopDomains3=
 | Readonly<PlanarLoopDomainGroups3&{kind:'analyzed'}>
 | Readonly<{kind:'unresolved';reason:'winding'|'unexpected-contact'|'inconsistent-containment';query?:PlanarLoopWinding3}>;
const budgetOf=(options:Readonly<{maxDirections?:number}>)=>{const budget=options.maxDirections??16;if(!Number.isSafeInteger(budget)||budget<1)throw new RangeError('maxDirections must be a positive safe integer');return budget;};
export function queryPlanarLoopWinding3(data:PlanarLoopData3,loop:number,input:Point2|AlgebraicCoordinates2,options:Readonly<{maxDirections?:number}>={}):PlanarLoopWinding3 {
 if(!Number.isSafeInteger(loop)||loop<0||loop>=data.loops.length)throw new RangeError('Invalid planar boundary loop');const budget=budgetOf(options),point=snapshotExactPoint2(input),F=data.frame,at=(edge:number,t:AlgebraicReal)=>{const q=pointInPlaneFrame3(F,data.point(edge,t));if(q===null)throw new Error('Planar boundary left its frame');return q;},boundary=(edge:number):PlanarLoopWinding3=>Object.freeze({kind:'boundary',loop,point,edge});
 for(const use of data.loops[loop]!){const p=at(use.edge,data.edges[use.edge]!.lower);if(p.x.compare(point.x)===0&&p.y.compare(point.y)===0)return boundary(use.edge);}
 const uu=dot3(F.u,F.u),uv=dot3(F.u,F.v),vv=dot3(F.v,F.v),det=uu.mul(vv).sub(uv.mul(uv));if(det.sign()<=0)throw new RangeError('Planar loop frame directions must be independent');
 const U=point3(...(['x','y','z'] as const).map(k=>F.u[k].mul(vv).sub(F.v[k].mul(uv)).div(det)) as Parameters<typeof point3>),V=point3(...(['x','y','z'] as const).map(k=>F.v[k].mul(uu).sub(F.u[k].mul(uv)).div(det)) as Parameters<typeof point3>);
 for(let attempt=0;attempt<budget;attempt++){const k=new Rational(attempt===0?0n:BigInt(Math.ceil(attempt/2))*(attempt%2===1?1n:-1n)),n=point3(V.x.sub(U.x.mul(k)),V.y.sub(U.y.mul(k)),V.z.sub(U.z.mul(k))),offset=AlgebraicReal.linearCombination([{value:point.y,coefficient:-1n},{value:point.x,coefficient:k}],dot3(n,F.origin).neg());let retry=false,winding=0;
  for(const use of data.loops[loop]!){const r=data.partition(use.edge,n,offset);
   for(const v of r.vertices)if(v.sign===0&&at(use.edge,v.parameter).x.compare(point.x)===0)return boundary(use.edge);
   for(const interval of r.intervals)if(interval.sign===0){if(at(use.edge,interval.lower).x.compare(point.x)*at(use.edge,interval.upper).x.compare(point.x)<=0)return boundary(use.edge);retry=true;}
   if(r.vertices[0]!.sign===0||r.vertices.at(-1)!.sign===0){retry=true;continue;}
   for(let i=1;i+1<r.vertices.length;i++)if(r.vertices[i]!.sign===0){const before=r.intervals[i-1]!.sign,after=r.intervals[i]!.sign;if(before===0||after===0){retry=true;continue;}if(before!==after&&at(use.edge,r.vertices[i]!.parameter).x.compare(point.x)>0)winding+=after*use.direction;}
  }
  if(!retry)return Object.freeze({kind:'located',loop,point,winding,attempts:attempt+1});
 }
 return Object.freeze({kind:'unresolved',loop,point,reason:'direction-budget',attempts:budget});
}
export function analyzePlanarLoopDomains3(data:PlanarLoopData3,options:Readonly<{maxDirections?:number}>={}):PlanarLoopDomains3 {
 budgetOf(options);const fail=(reason:Extract<PlanarLoopDomains3,{kind:'unresolved'}>['reason'],query?:PlanarLoopWinding3):PlanarLoopDomains3=>Object.freeze({kind:'unresolved',reason,...(query===undefined?{}:{query})}),samples=data.loops.map(loop=>{const use=loop[0]!,edge=data.edges[use.edge]!,q=pointInPlaneFrame3(data.frame,data.point(use.edge,use.direction===1?edge.lower:edge.upper));if(q===null)throw new Error('Planar loop left its frame');return q;}),inside=samples.map(()=>samples.map(()=>false));
 for(let i=0;i<samples.length;i++)for(let j=0;j<samples.length;j++)if(i!==j){const q=queryPlanarLoopWinding3(data,j,samples[i]!,options);if(q.kind==='boundary')return fail('unexpected-contact',q);if(q.kind==='unresolved')return fail('winding',q);if(Math.abs(q.winding)>1)return fail('inconsistent-containment',q);inside[i]![j]=q.winding!==0;}
 for(let i=0;i<samples.length;i++)for(let j=0;j<samples.length;j++)if(inside[i]![j]){if(inside[j]![i])return fail('inconsistent-containment');for(let k=0;k<samples.length;k++)if(inside[j]![k]&&!inside[i]![k]||inside[i]![k]&&j!==k&&!inside[j]![k]&&!inside[k]![j])return fail('inconsistent-containment');}
 const loops=samples.map((sample,loop)=>{const containers=inside[loop]!.flatMap((yes,id)=>yes?[id]:[]),parent=containers.find(id=>containers.every(other=>other===id||inside[id]![other]))??null;return Object.freeze({loop,sample,containers:Object.freeze(containers),parent,depth:containers.length});});if(loops.some(l=>l.depth!==0&&(l.parent===null||loops[l.parent]!.depth!==l.depth-1)))return fail('inconsistent-containment');
 return Object.freeze({kind:'analyzed',loops:Object.freeze(loops),faces:Object.freeze(loops.filter(l=>l.depth%2===0).map(l=>Object.freeze({outer:l.loop,holes:Object.freeze(loops.filter(h=>h.parent===l.loop).map(h=>h.loop))})))});
}
export type PlanarLoopFaceLocation3=
 | Readonly<{kind:'located';face:number;point:AlgebraicCoordinates2;location:'inside'|'outside'|'boundary';loop?:number}>
 | Readonly<{kind:'unresolved';face:number;point:AlgebraicCoordinates2;query:PlanarLoopWinding3}>;
export function locatePlanarLoopFace3(data:PlanarLoopData3,faces:PlanarLoopDomainGroups3['faces'],face:number,input:Point2|AlgebraicCoordinates2,options:Readonly<{maxDirections?:number}>={}):PlanarLoopFaceLocation3 {
 if(!Number.isSafeInteger(face)||face<0||face>=faces.length)throw new RangeError('Invalid planar domain face');budgetOf(options);const point=snapshotExactPoint2(input),group=faces[face]!,located=(location:'inside'|'outside'|'boundary',loop?:number):PlanarLoopFaceLocation3=>Object.freeze({kind:'located',face,point,location,...(loop===undefined?{}:{loop})});
 for(const [i,loop] of [group.outer,...group.holes].entries()){const query=queryPlanarLoopWinding3(data,loop,point,options);if(query.kind==='unresolved')return Object.freeze({kind:'unresolved',face,point,query});if(query.kind==='boundary')return located('boundary',loop);if(i===0?query.winding===0:query.winding!==0)return located('outside');}return located('inside');
}
