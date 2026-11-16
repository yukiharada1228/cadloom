import {AlgebraicReal} from '../numeric/real-roots.js';
import {solveBivariateEquations} from '../numeric/bivariate-system.js';
import type {ExactInput} from './point2.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {assertOwnedNurbsSourceBRep3} from './nurbs-source-brep3.js';
import type {NurbsSourceBRep3} from './nurbs-source-brep3.js';
import {nurbsSourceBoundaryMap3} from './nurbs-source-boundary-map3.js';
import type {NurbsSourceBoundaryMap3} from './nurbs-source-boundary-map3.js';
import {evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import {nurbsSpanPairEquations3} from './nurbs-curve-intersection3.js';
import {traceAlgebraicCurve2} from './algebraic-curve-topology2.js';
import {restrictAlgebraicCurveRectangle2} from './algebraic-curve-rectangle2.js';
import type {RestrictedAlgebraicCurve2} from './algebraic-curve-rectangle2.js';
import {buildBRepTopologyWithGeometryAdapters3} from './brep-topology3.js';
import type {BRepTopology3,BRepEdgeUse3} from './brep-topology3.js';
export interface SewnNurbsSourceEdge3 {readonly source:NurbsSourceBRep3;readonly sourceEdge:number;readonly map:NurbsSourceBoundaryMap3;readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;}
export interface SewnNurbsSourceFace3 {readonly source:NurbsSourceBRep3;readonly face:number;}
export type SewnNurbsSourceBReps3=
 | Readonly<{kind:'unresolved';reason:'rational-map-unavailable';input:number;edge:number}>
 | Readonly<{kind:'sewn';sources:readonly NurbsSourceBRep3[];topology:BRepTopology3<SewnNurbsSourceEdge3,SewnNurbsSourceFace3>;
   /** Input BRep -> original edge -> ordered children in its original direction. */
   sourceUses:readonly (readonly (readonly BRepEdgeUse3[])[])[]}>;
const ownedEdges=new WeakSet<SewnNurbsSourceEdge3>(),ownedFaces=new WeakSet<SewnNurbsSourceFace3>();
/** Complete pairwise rational boundary intersection/coverage, not arbitrary
 * surface-interior intersection or a global solid/material certificate. */
export function sewNurbsSourceBReps3(input:readonly NurbsSourceBRep3[]):SewnNurbsSourceBReps3 {
 const sources=Object.freeze(Array.from(input,s=>{assertOwnedNurbsSourceBRep3(s);return s;})),maps:NurbsSourceBoundaryMap3[]=[],references:{source:NurbsSourceBRep3;sourceEdge:number}[]=[],indices:number[][]=[];
 for(const [i,s] of sources.entries()){const ids:number[]=[];for(let edge=0;edge<s.complex.edges.length;edge++){const map=nurbsSourceBoundaryMap3(s,edge);if(map===null)return Object.freeze({kind:'unresolved',reason:'rational-map-unavailable',input:i,edge});ids.push(maps.length);maps.push(map);references.push({source:s,sourceEdge:edge});}indices.push(ids);}
 const cuts=maps.map(m=>[m.lower,m.upper]),relations:{a:number;b:number;locus:RestrictedAlgebraicCurve2}[]=[];
 const add=(id:number,t:AlgebraicReal)=>{const m=maps[id]!;if(t.compare(m.lower)>=0&&t.compare(m.upper)<=0&&!cuts[id]!.some(q=>q.compare(t)===0))cuts[id]!.push(t);};
 for(let a=0;a<maps.length;a++)for(let b=a+1;b<maps.length;b++){
  const A=maps[a]!,B=maps[b]!,r=solveBivariateEquations(nurbsSpanPairEquations3(A.span,B.span)),point=(u:AlgebraicReal,v:AlgebraicReal)=>{if(u.compare(A.lower)<0||u.compare(A.upper)>0||v.compare(B.lower)<0||v.compare(B.upper)>0)return;if(compareAlgebraicPoints3(evaluateNurbsSpanPoint3(A.span,u),evaluateNurbsSpanPoint3(B.span,v))!==0)throw new Error('Source boundary intersection lost XYZ equality');add(a,u);add(b,v);};
  r.points.forEach(q=>point(q.u,q.v));if(r.kind!=='finite'){if(r.kind==='all')throw new Error('Embedded finite boundaries cannot both be constant');const graph=traceAlgebraicCurve2(r.commonFactor,{uMin:A.span.startParameter,uMax:A.span.endParameter,vMin:B.span.startParameter,vMax:B.span.endParameter}),locus=restrictAlgebraicCurveRectangle2(graph,{uMin:A.lower,uMax:A.upper,vMin:B.lower,vMax:B.upper});locus.vertices.forEach(q=>point(q.u,q.v));if(locus.edges.length)relations.push({a,b,locus});}
 }
 const edges:SewnNurbsSourceEdge3[]=[],edgeMaps:number[]=[];
 const ends=(e:SewnNurbsSourceEdge3)=>[evaluateNurbsSpanPoint3(e.map.span,e.lower),evaluateNurbsSpanPoint3(e.map.span,e.upper)] as const;
 const covered=(intervals:readonly (readonly [AlgebraicReal,AlgebraicReal])[],lower:AlgebraicReal,upper:AlgebraicReal)=>{let cursor=lower;for(const [a,b] of [...intervals].sort((a,b)=>a[0].compare(b[0]))){if(a.compare(cursor)>0)return false;if(b.compare(cursor)>0)cursor=b;if(cursor.compare(upper)>=0)return true;}return false;};
 const equal=(id:number,lower:AlgebraicReal,upper:AlgebraicReal,index:number):1|-1|0=>{
  const A=maps[id]!,B=edges[index]!,other=edgeMaps[index]!;
  if(id===other)return lower.compare(B.lower)===0&&upper.compare(B.upper)===0?1:0;
  const a=evaluateNurbsSpanPoint3(A.span,lower),z=evaluateNurbsSpanPoint3(A.span,upper),[b,y]=ends(B);
  for(const direction of [1,-1] as const){if(compareAlgebraicPoints3(a,direction===1?b:y)!==0||compareAlgebraicPoints3(z,direction===1?y:b)!==0)continue;
   for(const r of relations){const forward=r.a===id&&r.b===other,reverse=r.b===id&&r.a===other;if(!forward&&!reverse)continue;const locus=restrictAlgebraicCurveRectangle2(r.locus.graph,forward?{uMin:lower,uMax:upper,vMin:B.lower,vMax:B.upper}:{uMin:B.lower,uMax:B.upper,vMin:lower,vMax:upper}),xs:[AlgebraicReal,AlgebraicReal][]=[],ys:[AlgebraicReal,AlgebraicReal][]=[];let aligned=true;
    for(const e of locus.edges){const p=locus.vertices[e.from]!,q=locus.vertices[e.to]!,u=p.u.compare(q.u),v=p.v.compare(q.v);if(!u||!v)continue;if(u*v!==direction){aligned=false;break;}xs.push(p.u.compare(q.u)<0?[p.u,q.u]:[q.u,p.u]);ys.push(p.v.compare(q.v)<0?[p.v,q.v]:[q.v,p.v]);}
    if(aligned&&covered(forward?xs:ys,lower,upper)&&covered(forward?ys:xs,B.lower,B.upper))return direction;
   }
  }return 0;
 };
 const uses=maps.map((m,id)=>{const ts=cuts[id]!.sort((a,b)=>a.compare(b)),children:BRepEdgeUse3[]=[];for(let i=0;i+1<ts.length;i++){const lower=ts[i]!,upper=ts[i+1]!;let direction:1|-1=1,index=edges.findIndex((_,e)=>{const d=equal(id,lower,upper,e);if(!d)return false;direction=d;return true;});if(index<0){index=edges.length;const e=Object.freeze({...references[id]!,map:m,lower,upper});edges.push(e);edgeMaps.push(id);ownedEdges.add(e);}children.push(Object.freeze({edge:index,direction:(direction*m.direction) as 1|-1}));}return Object.freeze(m.direction===1?children:children.reverse());});
 const sourceUses=Object.freeze(indices.map(ids=>Object.freeze(ids.map(id=>uses[id]!)))),faces=sources.flatMap((s,i)=>s.topology.faces.map((f,face)=>{const surface=Object.freeze({source:s,face:f.surface.face});ownedFaces.add(surface);return {surface,sense:f.sense,loops:f.loops.map(loop=>s.topology.loops[loop]!.coedges.flatMap(id=>{const c=s.topology.coedges[id]!,children=sourceUses[i]![c.edge]!;return c.direction===1?children:[...children].reverse().map(u=>Object.freeze({edge:u.edge,direction:(-u.direction) as 1|-1}));}))};}));
 const topology=buildBRepTopologyWithGeometryAdapters3(edges,faces,{
  snapshot:(e:SewnNurbsSourceEdge3)=>{if(!ownedEdges.has(e))throw new RangeError('Expected sewn source edge');return e;},endpoints:ends,closed:()=>false,
  snapshotSurface:(f:SewnNurbsSourceFace3)=>{if(!ownedFaces.has(f))throw new RangeError('Expected sewn source face');return f;},
  onSurface:(e,f)=>{const index=edges.indexOf(e);return faces.some(candidate=>candidate.surface===f&&candidate.loops.some(loop=>loop.some(u=>u.edge===index)));},
 });return Object.freeze({kind:'sewn',sources,topology,sourceUses});
}
export function sewnNurbsSourceEdgePoint3(edge:SewnNurbsSourceEdge3,input:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
 if(!ownedEdges.has(edge))throw new RangeError('Expected factory-created sewn source edge');const t=input instanceof AlgebraicReal?input:AlgebraicReal.fromRational(input);if(t.compare(edge.lower)<0||t.compare(edge.upper)>0)throw new RangeError('Parameter is outside the sewn source edge');return evaluateNurbsSpanPoint3(edge.map.span,t);
}
