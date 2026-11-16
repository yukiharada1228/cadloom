import {AlgebraicReal} from '../numeric/real-roots.js';
import {Rational} from '../numeric/rational.js';
import {matchNurbsPlaneCellSourceVertices3} from './nurbs-plane-cell-source-vertices3.js';
import type {NurbsPlaneCellSourceVertices3} from './nurbs-plane-cell-source-vertices3.js';
import type {SewnNurbsSourceEdgePlane3} from './sewn-nurbs-source-edge-plane3.js';
import {nurbsSourcePlaneCellComplexEdgePoint3} from './nurbs-source-plane-cell-complex3.js';
import type {NurbsSourcePlaneCellComplex3} from './nurbs-source-plane-cell-complex3.js';
import {matchNurbsSpanIntervals3} from './nurbs-span-interval-match3.js';
import type {NurbsSpanIntervalMatchCertificate3} from './nurbs-span-interval-match3.js';
export type NurbsPlaneCellSourceEdge3=
 | Readonly<{kind:'interior';edge:number}>
 | Readonly<{kind:'unresolved';edge:number;reason:'implicit-curve-map'|'algebraic-constant-map'|'whole-curve-match'|'ambiguous-source'}>
 | Readonly<{kind:'matched';edge:number;parent:number;certificate:NurbsSpanIntervalMatchCertificate3;fragments:readonly Readonly<{edge:number;lower:AlgebraicReal;upper:AlgebraicReal;direction:1|-1}>[]}>;
export interface NurbsPlaneCellSourceEdges3 {
 readonly vertices:NurbsPlaneCellSourceVertices3;readonly edges:readonly NurbsPlaneCellSourceEdge3[];
 readonly allOriginalBoundariesMatched:boolean;
}
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {
 while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}
 return a.upper.add(b.lower).div(new Rational(2n));
}
/** Whole-interval matching for rational constant-UV paths. General implicit
 * boundary paths remain explicit unresolved entries, never chordal guesses. */
export function matchNurbsPlaneCellSourceEdges3(source:SewnNurbsSourceEdgePlane3,face:number,cells:NurbsSourcePlaneCellComplex3):NurbsPlaneCellSourceEdges3 {
 const vertices=matchNurbsPlaneCellSourceVertices3(source,face,cells);
 const edges=cells.edges.map((e,edge):NurbsPlaneCellSourceEdge3=>{
  const sample=nurbsSourcePlaneCellComplexEdgePoint3(cells,edge,between(e.lower,e.upper));
  if(sample.stratum==='face')return Object.freeze({kind:'interior',edge});
  const boundary=cells.boundaries[e.boundary]!,path=boundary.edges[e.edge]!.path;
  if(path.kind==='curve')return Object.freeze({kind:'unresolved',edge,reason:'implicit-curve-map'});
  const fixed=(path.kind==='u'?path.u:path.v).recognizeRational().rational;
  if(fixed===null)return Object.freeze({kind:'unresolved',edge,reason:'algebraic-constant-map'});
  const cell=cells.source.cells[e.boundary]!,p=cells.source.complex.source.source.patches[cell.patch]!,g=cell.graph;
  const at=(key:'x'|'y'|'z'|'weight')=>path.kind==='u'?p[key].specializeU(fixed):p[key].specializeV(fixed);
  const span=Object.freeze({index:0,startParameter:path.kind==='u'?g.bounds.vMin:g.bounds.uMin,endParameter:path.kind==='u'?g.bounds.vMax:g.bounds.uMax,x:at('x'),y:at('y'),z:at('z'),weight:at('weight')});
  const starts=vertices.vertices[e.from]!.edges,ends=vertices.vertices[e.to]!.edges,candidates:{parent:number;lower:AlgebraicReal;upper:AlgebraicReal;direction:1|-1}[]=[];
  for(const a of starts)for(const b of ends){
   const parent=source.topology.edges[a.edge]!.curve.parent;if(parent!==source.topology.edges[b.edge]!.curve.parent)continue;
   const order=a.parameter.compare(b.parameter);if(!order)continue;const lower=order<0?a.parameter:b.parameter,upper=order<0?b.parameter:a.parameter,direction=order<0?1:-1;
   if(!candidates.some(c=>c.parent===parent&&c.lower.compare(lower)===0&&c.upper.compare(upper)===0))candidates.push({parent,lower,upper,direction});
  }
  const matches:Extract<NurbsPlaneCellSourceEdge3,{kind:'matched'}>[]=[];
  for(const c of candidates){
   const original=source.source.topology.edges[c.parent]!.curve,r=matchNurbsSpanIntervals3({span,lower:e.lower,upper:e.upper},{span:original.map.span,lower:c.lower,upper:c.upper});
   if(r.kind!=='matched'||r.certificate.direction!==c.direction)continue;
   const fragments=source.sourceUses[c.parent]!.flatMap(u=>{const f=source.topology.edges[u.edge]!.curve,lower=f.lower.compare(c.lower)>0?f.lower:c.lower,upper=f.upper.compare(c.upper)<0?f.upper:c.upper;return lower.compare(upper)<0?[Object.freeze({edge:u.edge,lower,upper,direction:c.direction})]:[];});
   let cursor=c.lower;for(const f of fragments){if(f.lower.compare(cursor)!==0)throw new Error('Whole curve match lost refined fragment coverage');cursor=f.upper;}if(cursor.compare(c.upper)!==0)throw new Error('Whole curve match lost final refined endpoint');
   if(c.direction===-1)fragments.reverse();matches.push(Object.freeze({kind:'matched',edge,parent:c.parent,certificate:r.certificate,fragments:Object.freeze(fragments)}));
  }
  if(matches.length!==1)return Object.freeze({kind:'unresolved',edge,reason:matches.length?'ambiguous-source':'whole-curve-match'});
  return matches[0]!;
 });
 return Object.freeze({vertices,edges:Object.freeze(edges),allOriginalBoundariesMatched:edges.every(e=>e.kind!=='unresolved')});
}
