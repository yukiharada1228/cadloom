import {Polynomial} from '../numeric/polynomial.js';
import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import type {NurbsSpan3} from './nurbs-curve3.js';
import type {PreparedNurbsParameterDomain2} from './nurbs-parameter-domain2.js';
import {assertOwnedRefinedNurbsAffineIntersectionComplex3} from './nurbs-affine-intersection-refine3.js';
import type {RefinedNurbsAffineIntersectionComplex3} from './nurbs-affine-intersection-refine3.js';
export interface NurbsIntersectionBoundaryVertex2 {
 readonly u:AlgebraicReal;readonly v:AlgebraicReal;
 /** All original refined-graph preimages at this boundary parameter point. */
 readonly intersectionVertices:readonly number[];
}
export interface NurbsIntersectionBoundaryEdge2 {
 readonly ring:number;readonly curve:number;readonly span:number;
 readonly from:number;readonly to:number;readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;
}
export interface NurbsIntersectionBoundaryNodes3 {
 readonly source:RefinedNurbsAffineIntersectionComplex3;readonly side:'source'|'target';
 readonly domain:PreparedNurbsParameterDomain2;
 readonly vertices:readonly NurbsIntersectionBoundaryVertex2[];readonly edges:readonly NurbsIntersectionBoundaryEdge2[];
 /** Closed oriented rings; outer first, followed by holes. */
 readonly rings:readonly (readonly number[])[];
 readonly intersectionVertices:readonly (number|null)[];
}
const real=(x:Parameters<typeof AlgebraicReal.fromRational>[0])=>AlgebraicReal.fromRational(x),one=new Polynomial([1n]);
export function nurbsBoundaryCoordinateRoots3(s:NurbsSpan3,key:'x'|'y'|'z',value:AlgebraicReal):readonly AlgebraicReal[]|null {
 const N=s[key],W=s.weight;
 if(N.derivative().mul(W).sub(N.mul(W.derivative())).degree<0){
  // Composed finite maps can have a pole outside their restricted interval,
  // including at startParameter. A coefficient ratio avoids evaluating there.
  const i=W.coefficients.findIndex(q=>q.sign()!==0);if(i<0)throw new RangeError('Rational coordinate requires a nonzero weight polynomial');
  return real(N.coefficient(i).div(W.coefficient(i))).compare(value)===0?null:[];
 }
 const P=value.recognizeRational().polynomial,n=P.degree,NP=[one],WP=[one];for(let i=1;i<=n;i++){NP.push(NP[i-1]!.mul(N));WP.push(WP[i-1]!.mul(W));}
 let f=new Polynomial();for(let i=0;i<=n;i++)f=f.add(NP[i]!.mul(WP[n-i]!).scale(P.coefficient(i)));
 return isolateRealRoots(f).map(t=>t.recognizeRational()).filter(t=>t.compare(real(s.startParameter))>=0&&t.compare(real(s.endParameter))<=0&&t.signOf(W)!==0&&t.rationalFunction(N,W).compare(value)===0);
}
/** Node every finite trim-boundary span at all refined intersection vertices.
 * Computes exact parameter preimages, including algebraic values and knots.
 * Does not infer interior face loops or merge coincident boundary/cut edges. */
export function nodeNurbsIntersectionBoundary3(source:RefinedNurbsAffineIntersectionComplex3,side:'source'|'target'):NurbsIntersectionBoundaryNodes3 {
 assertOwnedRefinedNurbsAffineIntersectionComplex3(source);if(side!=='source'&&side!=='target')throw new RangeError('Invalid intersection boundary side');
 const trim=source.source.source,domain=side==='source'?trim.sourceDomain:trim.targetDomain,points=source.vertices.map(v=>side==='source'?{u:v.point.u,v:v.point.v}:{u:v.point.targetU,v:v.point.targetV}),vertices:{u:AlgebraicReal;v:AlgebraicReal;intersectionVertices:number[]}[]=[],edges:NurbsIntersectionBoundaryEdge2[]=[],rings:number[][]=[],intersectionVertices:(number|null)[]=points.map(()=>null);
 const vertex=(u:AlgebraicReal,v:AlgebraicReal)=>{let id=vertices.findIndex(p=>p.u.compare(u)===0&&p.v.compare(v)===0);if(id<0){id=vertices.length;vertices.push({u,v,intersectionVertices:[]});}return id;};
 for(const [ring,curves] of [domain.outer,...domain.holes].entries()){
  const ids:number[]=[];
  for(const [curve,c] of curves.entries())for(const s of nurbsCurveSpans3(c)){
   const cuts=[real(s.startParameter),real(s.endParameter)];
   // Monotone coordinate atoms support exact finite-interval matching.
   for(const key of ['x','y'] as const){const f=s[key].derivative().mul(s.weight).sub(s[key].mul(s.weight.derivative()));for(const t of f.degree>0?isolateRealRoots(f):[])if(t.compare(cuts[0]!)>0&&t.compare(cuts[1]!)<0&&!cuts.some(q=>q.compare(t)===0))cuts.push(t);}
   for(const [index,p] of points.entries()){
    const xs=nurbsBoundaryCoordinateRoots3(s,'x',p.u),candidates=xs??nurbsBoundaryCoordinateRoots3(s,'y',p.v)??[real(s.startParameter),real(s.endParameter)];
    for(const t of candidates){const q=evaluateNurbsSpanPoint3(s,t);if(q.x.compare(p.u)!==0||q.y.compare(p.v)!==0)continue;if(!cuts.some(a=>a.compare(t)===0))cuts.push(t);const v=vertex(p.u,p.v);if(!vertices[v]!.intersectionVertices.includes(index))vertices[v]!.intersectionVertices.push(index);intersectionVertices[index]=v;}
   }
   cuts.sort((a,b)=>a.compare(b));const vs=cuts.map(t=>{const q=evaluateNurbsSpanPoint3(s,t);return vertex(q.x,q.y);});
   for(let i=0;i+1<cuts.length;i++){ids.push(edges.length);edges.push(Object.freeze({ring,curve,span:s.index,from:vs[i]!,to:vs[i+1]!,lower:cuts[i]!,upper:cuts[i+1]!}));}
  }
  for(let i=0;i<ids.length;i++)if(edges[ids[i]!]!.to!==edges[ids[(i+1)%ids.length]!]!.from)throw new Error('Noded trim boundary lost closed ring connectivity');rings.push(ids);
 }
 return Object.freeze({source,side,domain,vertices:Object.freeze(vertices.map(v=>Object.freeze({...v,intersectionVertices:Object.freeze(v.intersectionVertices)}))),edges:Object.freeze(edges),rings:Object.freeze(rings.map(r=>Object.freeze(r))),intersectionVertices:Object.freeze(intersectionVertices)});
}
