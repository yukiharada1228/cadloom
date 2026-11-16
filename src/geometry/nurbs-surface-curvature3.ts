import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {secondDifferentialNurbsSurface3} from './nurbs-surface3.js';
import type {NurbsSurface3,NurbsSurfaceSides3,NurbsSurfaceSecondDifferential3} from './nurbs-surface3.js';

export type NurbsSurfaceCurvature3=
 | Readonly<{regular:false;differential:NurbsSurfaceSecondDifferential3}>
 | Readonly<{regular:true;differential:NurbsSurfaceSecondDifferential3;
   gaussian:AlgebraicReal;mean:AlgebraicReal;
   /** Signed principal curvatures in ascending order, using du × dv orientation. */
   principal:readonly [AlgebraicReal,AlgebraicReal]}>;
const dot=(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3)=>a.x.mul(b.x).add(a.y.mul(b.y)).add(a.z.mul(b.z));
/** Exact local curvature of the selected one-sided NURBS patch. Singular
 * parameters return no curvature, rather than dividing by a zero metric. */
export function curvatureNurbsSurface3(surface:NurbsSurface3,u:AlgebraicReal|ExactInput,v:AlgebraicReal|ExactInput,sides:NurbsSurfaceSides3={}):NurbsSurfaceCurvature3 {
 const differential=secondDifferentialNurbsSurface3(surface,u,v,sides),d=differential;
 if(!d.regular)return Object.freeze({regular:false,differential});
 const E=dot(d.du,d.du),F=dot(d.du,d.dv),G=dot(d.dv,d.dv),D=dot(d.normal,d.normal),L=dot(d.normal,d.duu),M=dot(d.normal,d.duv),N=dot(d.normal,d.dvv),two=AlgebraicReal.fromRational(2n);
 const gaussian=L.mul(N).sub(M.mul(M)).div(D.mul(D)),mean=E.mul(N).sub(two.mul(F).mul(M)).add(G.mul(L)).div(two.mul(D).mul(D.sqrt())),offset=mean.mul(mean).sub(gaussian).sqrt();
 return Object.freeze({regular:true,differential,gaussian,mean,principal:Object.freeze([mean.sub(offset),mean.add(offset)] as const)});
}
