import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {point3,dot3,cross3,subtract3} from './point3.js';
import {plane3} from './plane3.js';
import {surfacesCoincide3} from './surface3.js';
import type {Cylinder3} from './surface3.js';
import {prepareCylinderFace3} from './cylinder-face3.js';
import type {PreparedCylinderFace3} from './cylinder-face3.js';
import {snapshotExactPoint3,compareAlgebraicPoints3,getPointParameterization3,algebraicPoint3,algebraicCoordinates3,algebraicBiparametricPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {evaluatePlaneAtAlgebraicPoint3 as evaluate} from './algebraic-segment-plane3.js';
import {cylinderIntersectionSupports3,pointOnCylinderIntersectionArc3,splitCylinderIntersectionArc3,rebuildCylinderIntersectionGraph3} from './cylinder-cylinder3.js';
import type {BoundedCylinderIntersection3,CylinderIntersectionArc3} from './cylinder-cylinder3.js';
import {clipCylinderIntersectionByHalfspaces3} from './cylinder-intersection-plane3.js';
const axes=['x','y','z'] as const,one=new Rational(1n),two=new Rational(2n);
const same=(p:AlgebraicCoordinates3,q:AlgebraicCoordinates3)=>compareAlgebraicPoints3(p,q)===0;
/** Complete intersections of an algebraic-origin boundary generator and the
 * other cylinder. Nonparallel axes give a positive rational quadratic term.
 */
function generator(q:AlgebraicCoordinates3,first:Cylinder3,other:Cylinder3):AlgebraicCoordinates3[]{
 const d=first.axis.direction,e=other.axis.direction,o=other.axis.origin,w=cross3(e,d),a=dot3(w,w);if(a.sign()<=0)throw new Error('Bounded SSI requires nonparallel supporting axes');
 const E=dot3(e,e),ed=dot3(e,d),m=point3(d.x.mul(E).sub(e.x.mul(ed)),d.y.mul(E).sub(e.y.mul(ed)),d.z.mul(E).sub(e.z.mul(ed))),b=evaluate({normal:m,offset:dot3(m,o).neg()},q),data=getPointParameterization3(q);let c:AlgebraicReal;
 if(data){const u=cross3(e,subtract3(data.origin,o)),v=cross3(e,data.direction);c=data.parameter.rationalFunction(new Polynomial([dot3(u,u).sub(other.radiusSquared.mul(E)),dot3(u,v).mul(two),dot3(v,v)]));}
 else {const Q=axes.map(k=>q[k].affine(1n,o[k].neg())),cross=[Q[1]!.affine(e.z).sub(Q[2]!.affine(e.y)),Q[2]!.affine(e.x).sub(Q[0]!.affine(e.z)),Q[0]!.affine(e.y).sub(Q[1]!.affine(e.x))];c=cross.reduce((sum,v)=>sum.add(v.mul(v)),AlgebraicReal.fromRational(0n)).affine(1n,other.radiusSquared.mul(E).neg());}
 const disc=b.mul(b).sub(c.affine(a)),sign=disc.sign();if(sign<0)return [];const root=disc.sqrt(),values=(sign===0?[1n]:[-1n,1n]).map(s=>b.neg().add(root.affine(s)).affine(one.div(a)));
 return values.map(t=>{
  if(data){if(t.rational!==null)return algebraicPoint3(point3(...axes.map(k=>data.origin[k].add(d[k].mul(t.rational!))) as Parameters<typeof point3>),data.direction,data.parameter);return algebraicBiparametricPoint3(data.origin,data.direction,data.parameter,d,t);}
  return algebraicCoordinates3(...axes.map(k=>q[k].add(t.affine(d[k]))) as Parameters<typeof algebraicCoordinates3>);
 });
}
/** Restrict an owned bounded supporting/subset SSI graph to two finite cylinder
 * bands/angular patches, including arbitrary algebraic angular endpoints.
 * Reconstructs domains rather than trusting input locate callbacks. Closed-set
 * contacts remain points; this does not split faces or certify solid material.
 */
export function clipCylinderIntersectionToFaces3(input:BoundedCylinderIntersection3,inputFirst:PreparedCylinderFace3,inputSecond:PreparedCylinderFace3):BoundedCylinderIntersection3 {
 const supports=cylinderIntersectionSupports3(input),faces=[inputFirst,inputSecond].map(f=>prepareCylinderFace3(f.surface,f.lower,f.upper,{angular:f.angular,sense:f.sense}));
 const coincident=(a:Cylinder3,b:Cylinder3)=>surfacesCoincide3({kind:'cylinder',cylinder:a},{kind:'cylinder',cylinder:b});
 if(!((coincident(faces[0]!.surface,supports[0])&&coincident(faces[1]!.surface,supports[1]))||(coincident(faces[0]!.surface,supports[1])&&coincident(faces[1]!.surface,supports[0]))))throw new RangeError('Cylinder faces must match the SSI supporting pair');
 const heightSpaces=faces.flatMap(f=>{const d=f.surface.axis.direction,o=f.surface.axis.origin,D=dot3(d,d),at=(t:Rational)=>plane3(d.x,d.y,d.z,dot3(d,o).add(D.mul(t)).neg());return [{plane:at(f.lower),side:1 as const},{plane:at(f.upper),side:-1 as const}];}),bounded=clipCylinderIntersectionByHalfspaces3(input,heightSpaces),cuts:AlgebraicCoordinates3[]=[];
 for(const f of faces)if(!f.angular.fullCircle){const other=coincident(f.surface,supports[0])?supports[1]:supports[0];for(const q of [f.angular.start,f.angular.end])cuts.push(...generator(snapshotExactPoint3(q),f.surface,other));}
 const inside=(p:AlgebraicCoordinates3)=>faces.every(f=>f.locate(p)!=='outside'),arcs:CylinderIntersectionArc3[]=[],contacts=[...bounded.isolatedPoints,...bounded.arcs.flatMap(a=>[a.start,a.end]),...cuts];
 for(const arc of bounded.arcs){const pieces=splitCylinderIntersectionArc3(arc,cuts.filter(p=>pointOnCylinderIntersectionArc3(p,arc)));for(const piece of pieces)if(inside(piece.sample))arcs.push(piece);}
 const points=contacts.filter((p,i,all)=>all.findIndex(q=>same(p,q))===i&&inside(p)&&(bounded.isolatedPoints.some(q=>same(p,q))||bounded.arcs.some(a=>pointOnCylinderIntersectionArc3(p,a)))&&!arcs.some(a=>same(p,a.start)||same(p,a.end)));
 return rebuildCylinderIntersectionGraph3(bounded,arcs,points);
}
