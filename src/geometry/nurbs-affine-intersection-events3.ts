import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {BivariatePolynomial} from '../numeric/bivariate-polynomial.js';
import {prepareAlgebraicCurvePolynomialCuts2} from './algebraic-curve-inequalities2.js';
import {assertOwnedNurbsAffineIntersection3,nurbsAffineIntersectionEdgePoint3} from './nurbs-affine-intersection3.js';
import type {NurbsAffineIntersection3} from './nurbs-affine-intersection3.js';
import {nurbsAffineIntersectionEdgeDifferential3,trimmedNurbsAffineIntersectionEdgeDifferential3,nurbsAffineIntersectionComplexEdgeDifferential3} from './nurbs-affine-intersection-differential3.js';
import type {NurbsAffineIntersectionEdgeDifferential3,TrimmedNurbsAffineIntersectionEdgeDifferential3} from './nurbs-affine-intersection-differential3.js';
import {assertOwnedTrimmedNurbsAffineIntersection3} from './nurbs-affine-intersection-trim3.js';
import type {TrimmedNurbsAffineIntersection3} from './nurbs-affine-intersection-trim3.js';
import {assertOwnedNurbsAffineIntersectionComplex3} from './nurbs-affine-intersection-seams3.js';
import type {NurbsAffineIntersectionComplex3} from './nurbs-affine-intersection-seams3.js';
export interface NurbsIntersectionDifferentialInterval3 {
 readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;
 /** Representative jet. The three flags below apply to the whole OPEN interval. */
 readonly sample:NurbsAffineIntersectionEdgeDifferential3;
 readonly kind:NurbsAffineIntersectionEdgeDifferential3['kind'];
 readonly sourceRegular:boolean;readonly transverse:boolean;
}
export interface NurbsIntersectionDifferentialEvents3 {
 readonly source:NurbsAffineIntersection3;readonly patch:number;readonly edge:number;
 /** Includes both closed endpoints; extra polynomial events are allowed. */
 readonly events:readonly Readonly<{parameter:AlgebraicReal;differential:NurbsAffineIntersectionEdgeDifferential3}>[];
 readonly intervals:readonly NurbsIntersectionDifferentialInterval3[];
}
function between(a:AlgebraicReal,b:AlgebraicReal):Rational {while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(new Rational(2n));}
/** Partition an owned finite edge at all zeros relevant to source rank,
 * implicit-chart rank, spatial tangent rank and transverse intersection.
 * Does not resolve singular branches or certify an embedded face. */
function polynomialCuts(source:NurbsAffineIntersection3,patch:number,edge:number,lower?:AlgebraicReal,upper?:AlgebraicReal):readonly AlgebraicReal[] {
 // Validate ownership and indices before accessing caller-provided structure.
 assertOwnedNurbsAffineIntersection3(source);
 nurbsAffineIntersectionEdgePoint3(source,patch,edge,source.patches[patch]?.edges[edge]?.lower??0n);
 const p=source.patches[patch]!,e=p.edges[edge]!,pair=source.equations.pairs[p.pair]!,s=pair.sourcePatch,W=s.weight,graph=e.graph,F=graph.nonvertical,Fu=F.derivativeU(),Fv=F.derivativeV(),keys=['x','y','z'] as const;
 const du=keys.map(k=>s[k].derivativeU().mul(W).sub(s[k].mul(W.derivativeU()))),dv=keys.map(k=>s[k].derivativeV().mul(W).sub(s[k].mul(W.derivativeV())));
 const normals=[0,1,2].map(i=>{const j=(i+1)%3,k=(i+2)%3;return du[j]!.mul(dv[k]!).sub(du[k]!.mul(dv[j]!));});
 const vertical=graph.edges[e.sourceEdge]!.kind==='vertical';
 const tangents=du.map((x,i)=>vertical?dv[i]!:x.mul(Fv).sub(dv[i]!.mul(Fu)));
 // On the common zero set, positive homogeneous denominators remove only
 // nonzero factors. The residual differential is nonzero exactly when the
 // source differential leaves the target tangent plane (target has rank two).
 const residualDerivatives=pair.equations.flatMap(f=>[f.derivativeU(),f.derivativeV()]);
 const polynomials:BivariatePolynomial[]=[...normals,...tangents,...residualDerivatives,...(vertical?[]:[Fu,Fv])];
 return prepareAlgebraicCurvePolynomialCuts2(graph,polynomials)(e.sourceEdge,lower??e.lower,upper??e.upper);
}
function classify<T extends NurbsAffineIntersectionEdgeDifferential3>(cuts:readonly AlgebraicReal[],evaluate:(t:AlgebraicReal|Rational)=>T) {
 const events=Object.freeze(cuts.map(parameter=>Object.freeze({parameter,differential:evaluate(parameter)})));
 const intervals=Object.freeze(cuts.slice(0,-1).map((lower,i)=>{const upper=cuts[i+1]!,sample=evaluate(between(lower,upper));return Object.freeze({lower,upper,sample,kind:sample.kind,sourceRegular:sample.sourceRegular,transverse:sample.transverse});}));
 return {events,intervals};
}
export function analyzeNurbsAffineIntersectionEdgeEvents3(source:NurbsAffineIntersection3,patch:number,edge:number):NurbsIntersectionDifferentialEvents3 {
 return Object.freeze({source,patch,edge,...classify(polynomialCuts(source,patch,edge),t=>nurbsAffineIntersectionEdgeDifferential3(source,patch,edge,t))});
}
export interface TrimmedNurbsIntersectionDifferentialEvents3 {
 readonly source:TrimmedNurbsAffineIntersection3;readonly patch:number;readonly edge:number;
 readonly events:readonly Readonly<{parameter:AlgebraicReal;differential:TrimmedNurbsAffineIntersectionEdgeDifferential3}>[];
 readonly intervals:readonly (Omit<NurbsIntersectionDifferentialInterval3,'sample'>&Readonly<{sample:TrimmedNurbsAffineIntersectionEdgeDifferential3}>)[];
}
/** Classify only the retained closed trim interval, retaining both domain labels. */
export function analyzeTrimmedNurbsAffineIntersectionEdgeEvents3(source:TrimmedNurbsAffineIntersection3,patch:number,edge:number):TrimmedNurbsIntersectionDifferentialEvents3 {
 assertOwnedTrimmedNurbsAffineIntersection3(source);
 if(!Number.isSafeInteger(patch)||patch<0||patch>=source.patches.length)throw new RangeError('Invalid trimmed event patch');
 const p=source.patches[patch]!;
 if(!Number.isSafeInteger(edge)||edge<0||edge>=p.edges.length)throw new RangeError('Invalid trimmed event edge');
 const e=p.edges[edge]!,cuts=polynomialCuts(source.source,p.sourceIntersectionPatch,e.sourceEdge,e.lower,e.upper);
 return Object.freeze({source,patch,edge,...classify(cuts,t=>trimmedNurbsAffineIntersectionEdgeDifferential3(source,patch,edge,t))});
}
export interface NurbsIntersectionComplexDifferentialEvents3 {
 readonly source:NurbsAffineIntersectionComplex3;readonly edge:number;
 /** Union of events from every one-sided incident use. */
 readonly parameters:readonly AlgebraicReal[];
 readonly uses:readonly Readonly<{use:number;patch:number;edge:number;events:TrimmedNurbsIntersectionDifferentialEvents3['events'];intervals:TrimmedNurbsIntersectionDifferentialEvents3['intervals']}>[];
}
/** Synchronize every incident use on the common edge range without averaging
 * crease normals or merging pointwise classifications from different sides. */
export function analyzeNurbsAffineIntersectionComplexEdgeEvents3(source:NurbsAffineIntersectionComplex3,edge:number):NurbsIntersectionComplexDifferentialEvents3 {
 assertOwnedNurbsAffineIntersectionComplex3(source);
 if(!Number.isSafeInteger(edge)||edge<0||edge>=source.edges.length)throw new RangeError('Invalid complex event edge');
 const e=source.edges[edge]!,parameters:AlgebraicReal[]=[];
 for(const u of e.uses){const p=source.source.patches[u.patch]!,original=p.edges[u.edge]!;for(const t of polynomialCuts(source.source.source,p.sourceIntersectionPatch,original.sourceEdge,e.lower,e.upper))if(!parameters.some(q=>q.compare(t)===0))parameters.push(t);}
 parameters.sort((a,b)=>a.compare(b));
 const uses=Object.freeze(e.uses.map((u,use)=>Object.freeze({...u,use,...classify(parameters,t=>nurbsAffineIntersectionComplexEdgeDifferential3(source,edge,use,t))})));
 return Object.freeze({source,edge,parameters:Object.freeze(parameters),uses});
}
