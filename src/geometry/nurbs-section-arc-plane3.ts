import {AlgebraicReal} from '../numeric/real-roots.js';
import {bivariateFiberRoots,solveBivariateSystem} from '../numeric/bivariate-system.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {classifyPointToSurface3} from './surface3.js';
import {evaluateAlgebraicCurveEdge2} from './algebraic-curve-topology2.js';
import {liftNurbsSectionPatch3} from './nurbs-plane-section3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {assertOwnedNurbsSectionArc3,nurbsSectionArcPoint3,splitNurbsSectionArc3} from './nurbs-section-arc3.js';
import type {NurbsSectionArc3} from './nurbs-section-arc3.js';

export interface NurbsSectionArcPlanePoint3 {
 readonly parameter:AlgebraicReal;readonly parameterPoint:Readonly<{u:AlgebraicReal;v:AlgebraicReal}>;readonly point:AlgebraicCoordinates3;
}
export type NurbsSectionArcPlaneIntersection3=
 | Readonly<{kind:'none';plane:Plane3}>
 | Readonly<{kind:'points';plane:Plane3;points:readonly NurbsSectionArcPlanePoint3[]}>
 | Readonly<{kind:'overlap';plane:Plane3;arc:NurbsSectionArc3}>;
export interface NurbsSectionArcPlaneSplit3 {
 readonly intersection:NurbsSectionArcPlaneIntersection3;
 /** Side describes the relative OPEN interior; shared endpoints may be zero. */
 readonly pieces:readonly Readonly<{arc:NurbsSectionArc3;side:-1|0|1}>[];
}
/** Exact finite-branch intersection, retaining distinct parameter preimages
 * even when the spatial points coincide. No intersection multiplicity claim. */
export function intersectNurbsSectionArcPlane3(arc:NurbsSectionArc3,input:Plane3):NurbsSectionArcPlaneIntersection3 {
 assertOwnedNurbsSectionArc3(arc);const n=input.normal,plane=plane3(n.x,n.y,n.z,input.offset),item=arc.section.pieces[arc.piece]!,p=item.patch,t=item.topology,e=t.edges[arc.edge]!,G=p.x.scale(plane.normal.x).add(p.y.scale(plane.normal.y)).add(p.z.scale(plane.normal.z)).add(p.weight.scale(plane.offset));
 const overlap=():NurbsSectionArcPlaneIntersection3=>Object.freeze({kind:'overlap',plane,arc});if(G.degreeU<0)return overlap();
 const points:NurbsSectionArcPlanePoint3[]=[];
 const add=(parameter:AlgebraicReal,expectedV?:AlgebraicReal)=>{
  if(parameter.compare(arc.lower)<0||parameter.compare(arc.upper)>0||points.some(p=>p.parameter.compare(parameter)===0))return;
  const parameterPoint=evaluateAlgebraicCurveEdge2(t,arc.edge,parameter);if(expectedV!==undefined&&parameterPoint.v.compare(expectedV)!==0)return;
  if(G.evaluateAlgebraic(parameterPoint.u,parameterPoint.v).sign()!==0)return;
  points.push(Object.freeze({parameter,parameterPoint,point:liftNurbsSectionPatch3(p,parameterPoint.u,parameterPoint.v)}));
 };
 if(e.kind==='vertical'){
  const fiber=bivariateFiberRoots(G,e.sample.u);if(fiber.kind==='whole')return overlap();for(const v of fiber.roots)add(v);
 }else {
  const solutions=solveBivariateSystem(t.nonvertical,G),D=solutions.commonFactor;
  // A source edge lies in one projection-open slab with no singular event.
  // A polynomial divisor of its square-free defining equation either contains
  // the whole open branch or meets it only at event endpoints. Thus this exact
  // divisor test at the certified interior witness establishes whole overlap.
  if(D.evaluateAlgebraic(e.sample.u,e.sample.v).sign()===0)return overlap();
  for(const point of solutions.points)add(point.u,point.v);
 }
 // Solvers omit points on shared components. Another branch can meet such a
 // component at this edge's event endpoint, so always check both closed ends.
 add(arc.lower);add(arc.upper);
 if(!points.length)return Object.freeze({kind:'none',plane});
 points.sort((a,b)=>a.parameter.compare(b.parameter)*arc.direction);return Object.freeze({kind:'points',plane,points:Object.freeze(points)});
}
export function splitNurbsSectionArcByPlane3(arc:NurbsSectionArc3,input:Plane3):NurbsSectionArcPlaneSplit3 {
 const intersection=intersectNurbsSectionArcPlane3(arc,input);if(intersection.kind==='overlap')return Object.freeze({intersection,pieces:Object.freeze([Object.freeze({arc,side:0 as const})])});
 const cuts=intersection.kind==='points'?intersection.points.map(p=>p.parameter):[],pieces=splitNurbsSectionArc3(arc,cuts).map(piece=>{
  const mid=piece.lower.add(piece.upper).div(AlgebraicReal.fromRational(2n)),side=classifyPointToSurface3(nurbsSectionArcPoint3(piece,mid),{kind:'plane',plane:intersection.plane});
  if(side===0)throw new Error('Finite plane intersection left an unclassified zero in an open arc');return Object.freeze({arc:piece,side});
 });return Object.freeze({intersection,pieces:Object.freeze(pieces)});
}
