import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {algebraicCoordinates3,compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {secondDifferentialNurbsSurfacePatch3} from './nurbs-surface3.js';
import {implicitNurbsPatchEdgeDifferential3} from './nurbs-section-differential3.js';
import {nurbsAffineIntersectionEdgePoint3} from './nurbs-affine-intersection3.js';
import type {NurbsAffineIntersection3} from './nurbs-affine-intersection3.js';
import type {NurbsAffineIntersectionPoint3} from './nurbs-affine-intersection-equations3.js';
import {trimmedNurbsAffineIntersectionEdgePoint3} from './nurbs-affine-intersection-trim3.js';
import type {TrimmedNurbsAffineIntersection3} from './nurbs-affine-intersection-trim3.js';
import {assertOwnedNurbsAffineIntersectionComplex3} from './nurbs-affine-intersection-seams3.js';
import type {NurbsAffineIntersectionComplex3} from './nurbs-affine-intersection-seams3.js';
import type {NurbsAffineParameterRow3} from './nurbs-affine-projection3.js';
interface IntersectionDifferentialBase3 {
 readonly intersectionPoint:NurbsAffineIntersectionPoint3;
 readonly sourceNormal:AlgebraicCoordinates3;readonly targetNormal:AlgebraicCoordinates3;readonly normalCross:AlgebraicCoordinates3;
 readonly sourceRegular:boolean;readonly targetRegular:boolean;readonly transverse:boolean;
}
interface IntersectionJet3 {
 /** Local increasing coordinate, possibly different from the stored edge axis
  * at a projection-critical endpoint. It does not imply traversal direction. */
 readonly coordinate:'u'|'v';readonly derivative:AlgebraicCoordinates3;readonly secondDerivative:AlgebraicCoordinates3;
 readonly sourceDerivative:Readonly<{u:AlgebraicReal;v:AlgebraicReal}>;readonly sourceSecondDerivative:Readonly<{u:AlgebraicReal;v:AlgebraicReal}>;
 readonly targetDerivative:Readonly<{u:AlgebraicReal;v:AlgebraicReal}>;readonly targetSecondDerivative:Readonly<{u:AlgebraicReal;v:AlgebraicReal}>;
 /** Sign of tangent dot (sourceNormal cross targetNormal), in this chart.
  * Normals use positive surface parameters, without trim-domain sense. */
 readonly orientation:-1|0|1;
}
export type NurbsAffineIntersectionEdgeDifferential3=
 | Readonly<IntersectionDifferentialBase3&{kind:'singular-parameter'}>
 | Readonly<IntersectionDifferentialBase3&IntersectionJet3&{kind:'stationary-image'}>
 | Readonly<IntersectionDifferentialBase3&IntersectionJet3&{kind:'regular';curvatureSquared:AlgebraicReal}>;
export type TrimmedNurbsAffineIntersectionEdgeDifferential3=NurbsAffineIntersectionEdgeDifferential3&Readonly<{sourceLocation:'inside'|'boundary';targetLocation:'inside'|'boundary'}>;
const two=AlgebraicReal.fromRational(2n),dot=(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3)=>a.x.mul(b.x).add(a.y.mul(b.y)).add(a.z.mul(b.z)),nonzero=(p:AlgebraicCoordinates3)=>p.x.sign()!==0||p.y.sign()!==0||p.z.sign()!==0;
const cross=(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3)=>algebraicCoordinates3(a.y.mul(b.z).sub(a.z.mul(b.y)),a.z.mul(b.x).sub(a.x.mul(b.z)),a.x.mul(b.y).sub(a.y.mul(b.x)));
function project(row:NurbsAffineParameterRow3,p:AlgebraicCoordinates3):AlgebraicReal {return AlgebraicReal.linearCombination([{value:p.x,coefficient:row.normal.x},{value:p.y,coefficient:row.normal.y},{value:p.z,coefficient:row.normal.z}]);}
/** Exact one-sided source and target jets. The target chain rules are checked
 * independently; singular implicit gradients are unresolved, not guessed. */
export function nurbsAffineIntersectionEdgeDifferential3(source:NurbsAffineIntersection3,patch:number,edge:number,parameter:AlgebraicReal|ExactInput):NurbsAffineIntersectionEdgeDifferential3 {
 const intersectionPoint=nurbsAffineIntersectionEdgePoint3(source,patch,edge,parameter),p=source.patches[patch]!,e=p.edges[edge]!,pair=source.equations.pairs[p.pair]!,point=intersectionPoint,jet=implicitNurbsPatchEdgeDifferential3(pair.sourcePatch,e.graph,e.sourceEdge,parameter),S=secondDifferentialNurbsSurfacePatch3(pair.sourcePatch,point.u,point.v),T=secondDifferentialNurbsSurfacePatch3(pair.targetPatch,point.targetU,point.targetV),normalCross=cross(S.normal,T.normal),base={intersectionPoint,sourceNormal:S.normal,targetNormal:T.normal,normalCross,sourceRegular:S.regular,targetRegular:T.regular,transverse:nonzero(normalCross)};
 if(compareAlgebraicPoints3(jet.point,point.point)!==0||jet.parameterPoint.u.compare(point.u)!==0||jet.parameterPoint.v.compare(point.v)!==0)throw new Error('Intersection differential selected a different source branch');
 if(jet.kind==='singular-parameter')return Object.freeze({...base,kind:'singular-parameter'});
 const inverse=source.equations.target,targetDerivative=Object.freeze({u:project(inverse.u,jet.derivative),v:project(inverse.v,jet.derivative)}),targetSecondDerivative=Object.freeze({u:project(inverse.u,jet.secondDerivative),v:project(inverse.v,jet.secondDerivative)}),a=targetDerivative.u,b=targetDerivative.v,aa=targetSecondDerivative.u,bb=targetSecondDerivative.v,first=(k:'x'|'y'|'z')=>T.du[k].mul(a).add(T.dv[k].mul(b)),second=(k:'x'|'y'|'z')=>T.duu[k].mul(a.mul(a)).add(two.mul(T.duv[k]).mul(a).mul(b)).add(T.dvv[k].mul(b.mul(b))).add(T.du[k].mul(aa)).add(T.dv[k].mul(bb));
 if(compareAlgebraicPoints3(algebraicCoordinates3(first('x'),first('y'),first('z')),jet.derivative)!==0||compareAlgebraicPoints3(algebraicCoordinates3(second('x'),second('y'),second('z')),jet.secondDerivative)!==0)throw new Error('Target first/second chain rule failed exact equality');
 if(dot(jet.derivative,S.normal).sign()!==0||dot(jet.derivative,T.normal).sign()!==0)throw new Error('Intersection derivative is not tangent to both patches');
 const orientation=dot(jet.derivative,normalCross).sign();if(base.transverse&&orientation===0)throw new Error('Transverse intersection has no oriented tangent');const data={...base,coordinate:jet.coordinate,derivative:jet.derivative,secondDerivative:jet.secondDerivative,sourceDerivative:jet.parameterDerivative,sourceSecondDerivative:jet.parameterSecondDerivative,targetDerivative,targetSecondDerivative,orientation};
 return jet.kind==='regular'?Object.freeze({...data,kind:'regular',curvatureSquared:jet.curvatureSquared}):Object.freeze({...data,kind:'stationary-image'});
}
export function trimmedNurbsAffineIntersectionEdgeDifferential3(source:TrimmedNurbsAffineIntersection3,patch:number,edge:number,parameter:AlgebraicReal|ExactInput):TrimmedNurbsAffineIntersectionEdgeDifferential3 {
 const point=trimmedNurbsAffineIntersectionEdgePoint3(source,patch,edge,parameter),p=source.patches[patch]!,e=p.edges[edge]!,result=nurbsAffineIntersectionEdgeDifferential3(source.source,p.sourceIntersectionPatch,e.sourceEdge,parameter);return Object.freeze({...result,sourceLocation:point.sourceLocation,targetLocation:point.targetLocation});
}
/** Select an explicit incident use: crease normals are never averaged. */
export function nurbsAffineIntersectionComplexEdgeDifferential3(source:NurbsAffineIntersectionComplex3,edge:number,use:number,parameter:AlgebraicReal|ExactInput):TrimmedNurbsAffineIntersectionEdgeDifferential3 {
 assertOwnedNurbsAffineIntersectionComplex3(source);if(!Number.isSafeInteger(edge)||edge<0||edge>=source.edges.length)throw new RangeError('Invalid differential complex edge');const e=source.edges[edge]!;if(!Number.isSafeInteger(use)||use<0||use>=e.uses.length)throw new RangeError('Invalid differential edge use');const t=parameter instanceof AlgebraicReal?parameter:AlgebraicReal.fromRational(parameter);if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the differential complex edge');const selected=e.uses[use]!;return trimmedNurbsAffineIntersectionEdgeDifferential3(source.source,selected.patch,selected.edge,t);
}
