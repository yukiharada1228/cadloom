import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import {assertOwnedNurbsSourceFacePatches3} from './nurbs-source-face-patches3.js';
import type {NurbsSourceFacePatches3,NurbsSourceFacePatchUse3} from './nurbs-source-face-patches3.js';
import {analyzeNurbsSurfaceRegularity3} from './nurbs-surface-regularity3.js';
import type {NurbsSurfaceRegularity3} from './nurbs-surface-regularity3.js';
import {nurbsCurveSpans3,evaluateNurbsSpanPoint3} from './nurbs-curve3.js';
import {nurbsParameterPolynomial3} from './nurbs-surface-boundary3.js';
import {prepareAlgebraicCurvePolynomialCuts2} from './algebraic-curve-inequalities2.js';
import {sourceUvEdgeAtCoordinate3} from './nurbs-source-uv-edge3.js';
import {liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
export interface NurbsSourceBoundaryRankEvent3 {readonly parameter:AlgebraicReal;readonly u:AlgebraicReal;readonly v:AlgebraicReal;readonly point:AlgebraicCoordinates3;readonly regular:boolean;}
export interface NurbsSourceBoundaryRankUse3 extends NurbsSourceFacePatchUse3 {
 readonly cycle:number;readonly axis:'u'|'v';readonly regular:boolean;
 readonly events:readonly NurbsSourceBoundaryRankEvent3[];
 readonly intervals:readonly Readonly<{lower:AlgebraicReal;upper:AlgebraicReal;regular:boolean}>[];
}
export type NurbsSourceBoundaryRegularity3=
 | Readonly<{kind:'unresolved';source:NurbsSourceFacePatches3;reason:'unresolved-patches'|'uv-fiber'}>
 | Readonly<{kind:'analyzed';source:Extract<NurbsSourceFacePatches3,{kind:'selected'}>;support:NurbsSurfaceRegularity3;vertexSectorCoverage:'not-certified';faces:readonly Readonly<{face:number;selectedBoundaryRegular:boolean;uses:readonly NurbsSourceBoundaryRankUse3[]}>[]}>;
const one=new BivariatePolynomial([[1n]]);
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Rank-two on every selected closed boundary use. Includes isolated parameter
 * events and whole singular intervals, without certifying all vertex sectors. */
export function analyzeNurbsSourceFaceBoundaryRegularity3(source:NurbsSourceFacePatches3):NurbsSourceBoundaryRegularity3 {
 assertOwnedNurbsSourceFacePatches3(source);if(source.kind==='unresolved')return Object.freeze({kind:'unresolved',source,reason:'unresolved-patches'});
 const L=source.source,F=L.source,c=F.source.source,R=c.source,support=analyzeNurbsSurfaceRegularity3(R.source.source.source.equations.source),faces:{face:number;selectedBoundaryRegular:boolean;uses:readonly NurbsSourceBoundaryRankUse3[]}[]=[];
 for(const face of source.faces){const uses:NurbsSourceBoundaryRankUse3[]=[];
  for(const cycle of face.cycles)for(const use of cycle.uses){
   const p=support.patches[use.patch]!,original=L.patches[use.patch]!;if(p.patch.uSpan!==original.uSpan||p.patch.vSpan!==original.vSpan)throw new Error('Source patch order changed in boundary rank snapshot');
   const edge=c.edges[use.edge]!,lift=L.edges[use.edge]!,piece=lift.pieces[use.piece]!,axis=lift.axis,normals=[p.normalX,p.normalY,p.normalZ],cuts=[piece.lower,piece.upper],add=(t:AlgebraicReal)=>{if(t.compare(piece.lower)>0&&t.compare(piece.upper)<0&&!cuts.some(q=>q.compare(t)===0))cuts.push(t);};
   if(!p.regular){const b=edge.boundaryUses[0];
    if(b){const old=c.sharing.boundary.edges[b.edge]!,domain=c.sharing.boundary.domain,curve=[domain.outer,...domain.holes][old.ring]![old.curve]!,span=nurbsCurveSpans3(curve).find(s=>s.index===old.span)!,gcd=normals.map(f=>nurbsParameterPolynomial3(f,span)).reduce((g,f)=>g.gcd(f),new Polynomial());
     if(gcd.degree>0)for(const t of isolateRealRoots(gcd))if(t.compare(b.lower)>=0&&t.compare(b.upper)<=0){const q=evaluateNurbsSpanPoint3(span,t);add(axis==='u'?q.x:q.y);}
    }else{const ref=edge.intersectionUses[0]!,re=R.edges[ref.edge]!,old=R.source.edges[re.sourceEdge]!,u=old.uses[0]!,tp=R.source.source.patches[u.patch]!,te=tp.edges[u.edge]!,raw=R.source.source.source.patches[tp.sourceIntersectionPatch]!.edges[te.sourceEdge]!;
     if(axis!==(raw.graph.edges[raw.sourceEdge]!.kind==='vertical'?'v':'u'))throw new Error('Boundary rank chart disagrees with selected graph');
     prepareAlgebraicCurvePolynomialCuts2(raw.graph,normals)(raw.sourceEdge,piece.lower,piece.upper).forEach(add);
    }
   }
   cuts.sort((a,b)=>a.compare(b));const evaluate=(parameter:AlgebraicReal)=>{const qs=sourceUvEdgeAtCoordinate3(c,use.edge,axis,parameter);if(qs?.length!==1)return null;const q=qs[0]!,regular=p.regular||normals.some(f=>f.rationalImage(q.u,q.v,one).sign()!==0);return Object.freeze({...q,parameter,point:liftNurbsSectionPatch3(p.patch,q.u,q.v),regular});};
   const events:NurbsSourceBoundaryRankEvent3[]=[],intervals:{lower:AlgebraicReal;upper:AlgebraicReal;regular:boolean}[]=[];
   for(const t of cuts){const q=evaluate(t);if(!q)return Object.freeze({kind:'unresolved',source,reason:'uv-fiber'});events.push(q);}
   for(let i=0;i+1<cuts.length;i++){const lower=cuts[i]!,upper=cuts[i+1]!,q=evaluate(AlgebraicReal.fromRational(between(lower,upper)));if(!q)return Object.freeze({kind:'unresolved',source,reason:'uv-fiber'});intervals.push(Object.freeze({lower,upper,regular:q.regular}));}
   uses.push(Object.freeze({...use,cycle:cycle.cycle,axis,regular:events.every(q=>q.regular)&&intervals.every(q=>q.regular),events:Object.freeze(events),intervals:Object.freeze(intervals)}));
  }
  faces.push(Object.freeze({face:face.face,selectedBoundaryRegular:uses.every(u=>u.regular),uses:Object.freeze(uses)}));
 }
 return Object.freeze({kind:'analyzed',source,support,vertexSectorCoverage:'not-certified',faces:Object.freeze(faces)});
}
