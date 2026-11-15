import {Rational} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {point3,dot3,cross3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3} from './plane3.js';
import {evaluatePlaneAtAlgebraicPoint3 as evaluate} from './algebraic-segment-plane3.js';
import {cylinder3,classifyPointToSurface3} from './surface3.js';
import type {Cylinder3} from './surface3.js';
import {prepareCylinderFace3} from './cylinder-face3.js';
import type {PreparedCylinderFace3} from './cylinder-face3.js';
import {cylinderCoordinates3} from './cylinder-coordinates3.js';
import {circle3,circularArc3,splitCircularArc3,interiorPointOnArc3,pointOnArc3,locatePointOnArc3} from './circle3.js';
import type {CircularArc3} from './circle3.js';
import {snapshotExactPoint3,algebraicPoint3,algebraicCoordinates3,algebraicBiparametricPoint3,getPointParameterization3,compareAlgebraicPoints3,translateAlgebraicPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {intersectCylinders3,evaluateCylinderIntersectionArc3,splitCylinderIntersectionArc3} from './cylinder-cylinder3.js';
import type {CylinderIntersectionArc3,CylinderCylinderIntersection3} from './cylinder-cylinder3.js';
import {clipCylinderIntersectionByHalfspaces3} from './cylinder-intersection-plane3.js';
import {algebraicSegment3,pointOnAlgebraicSegment3} from './algebraic-segment3.js';
import {nativeBRepCurve3,cylinderIntersectionBRepCurve3,reverseBRepCurve3} from './brep-curve3.js';
import type {BRepCurve3} from './brep-curve3.js';
import {sewMixedBRepFaces3} from './sew-mixed-brep3.js';
import type {SewnMixedBRep3} from './sew-mixed-brep3.js';
import type {CurveRegionLocation2} from './curve-boolean2.js';
import type {Sign} from '../numeric/rational.js';
const axes=['x','y','z'] as const,one=new Rational(1n),two=new Rational(2n);
const same=(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3)=>compareAlgebraicPoints3(a,b)===0;
export type CylinderHeightBound3={readonly kind:'constant';readonly value:Rational}|{readonly kind:'ssi';readonly arc:CylinderIntersectionArc3};
/** One embedded circle-times-height strip. Artificial generator cuts are retained
 * as shared edges; adjacent strips are not claimed to be maximal connected faces.
 */
export interface CylinderFaceCell3 {
 readonly angular:CircularArc3;readonly lower:CylinderHeightBound3;readonly upper:CylinderHeightBound3;
 readonly side:Sign;readonly sample:AlgebraicCoordinates3;readonly boundary:readonly BRepCurve3[];
 locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
export interface CylinderFaceCylinderPartition3 {
 readonly base:PreparedCylinderFace3;readonly cutter:Cylinder3;readonly intersection:CylinderCylinderIntersection3;
 readonly cells:readonly CylinderFaceCell3[];readonly sewn:SewnMixedBRep3;
 /** Isolated zero-set contacts in the closed source face. */
 readonly contacts:readonly AlgebraicCoordinates3[];
}
const owned=new WeakSet<CylinderFaceCylinderPartition3>();
/** Reject copies when consuming the constructive face partition downstream. */
export function assertOwnedCylinderFaceCylinderPartition3(input:CylinderFaceCylinderPartition3):void {if(!owned.has(input))throw new RangeError('Expected a factory-created cylinder face partition');}
/** Rational density gives a strict witness without combining root fields. */
function between(lower:AlgebraicReal,upper:AlgebraicReal):Rational {let lo=lower,hi=upper;while(lo.upper.compare(hi.lower)>=0){lo=lo.refine();hi=hi.refine();}return lo.upper.add(hi.lower).div(two);}
function at(base:PreparedCylinderFace3,q:AlgebraicCoordinates3,t:AlgebraicReal):AlgebraicCoordinates3 {
 const d=base.surface.axis.direction,data=getPointParameterization3(q);
 if(t.rational!==null)return translateAlgebraicPoint3(q,point3(d.x.mul(t.rational),d.y.mul(t.rational),d.z.mul(t.rational)));
 if(data)return algebraicBiparametricPoint3(data.origin,data.direction,data.parameter,d,t);
 return algebraicCoordinates3(...axes.map(k=>q[k].add(t.affine(d[k]))) as Parameters<typeof algebraicCoordinates3>);
}
function height(base:PreparedCylinderFace3,bound:CylinderHeightBound3,q:AlgebraicCoordinates3):AlgebraicReal {return bound.kind==='constant'?AlgebraicReal.fromRational(bound.value):cylinderCoordinates3(base.surface,evaluateCylinderIntersectionArc3(bound.arc,q)).height;}
/** Compare axial position with a selected quadratic root, without rebuilding
 * nested radicals at every point query. The angular domain guarantees real roots.
 */
function compareBound(bound:CylinderHeightBound3,p:AlgebraicCoordinates3,t:AlgebraicReal):Sign {
 if(bound.kind==='constant')return t.compare(AlgebraicReal.fromRational(bound.value));
 const arc=bound.arc,d=arc.first.axis.direction,e=arc.second.axis.direction,E=dot3(e,e),ed=dot3(e,d),m=point3(d.x.mul(E).sub(e.x.mul(ed)),d.y.mul(E).sub(e.y.mul(ed)),d.z.mul(E).sub(e.z.mul(ed))),vertex=evaluate({normal:m,offset:dot3(m,arc.second.axis.origin).neg()},p).sign(),value=classifyPointToSurface3(p,{kind:'cylinder',cylinder:arc.second});
 return arc.branch===-1?vertex>0?1:value===0?0:value>0?-1:1:vertex<0?-1:value===0?0:value>0?1:-1;
}
function boundPoint(base:PreparedCylinderFace3,bound:CylinderHeightBound3,q:AlgebraicCoordinates3):AlgebraicCoordinates3 {return bound.kind==='ssi'?evaluateCylinderIntersectionArc3(bound.arc,q):at(base,q,AlgebraicReal.fromRational(bound.value));}
function generatorBoundary(base:PreparedCylinderFace3,start:AlgebraicCoordinates3,end:AlgebraicCoordinates3,contacts:readonly AlgebraicCoordinates3[]):BRepCurve3[] {
 if(same(start,end))return [];const segment=algebraicSegment3(start,end),direction=cylinderCoordinates3(base.surface,start).height.compare(cylinderCoordinates3(base.surface,end).height)<0?1:-1,points=[start,end,...contacts.filter(p=>pointOnAlgebraicSegment3(p,segment))].filter((p,i,all)=>all.findIndex(q=>same(p,q))===i).sort((a,b)=>cylinderCoordinates3(base.surface,a).height.compare(cylinderCoordinates3(base.surface,b).height)*direction);
 return points.slice(0,-1).map((p,i)=>nativeBRepCurve3({kind:'algebraic-segment',segment:algebraicSegment3(p,points[i+1]!)}));
}
function boundary(base:PreparedCylinderFace3,angular:CircularArc3,bound:CylinderHeightBound3):BRepCurve3 {
 if(bound.kind==='ssi')return cylinderIntersectionBRepCurve3(bound.arc);
 const d=base.surface.axis.direction,t=bound.value,shift=point3(d.x.mul(t),d.y.mul(t),d.z.mul(t)),o=base.surface.axis.origin,center=point3(o.x.add(shift.x),o.y.add(shift.y),o.z.add(shift.z));
 return nativeBRepCurve3({kind:'circular-arc',arc:circularArc3(circle3(center,d,base.surface.radiusSquared),translateAlgebraicPoint3(angular.start,shift),translateAlgebraicPoint3(angular.end,shift),{direction:'ccw'})});
}
/** Split an exact finite cylinder band/angular patch by another circular cylinder.
 * Complete height/critical events produce embedded monotone strip faces with
 * exact location, oriented native/SSI boundaries and common edge provenance.
 * Keeps artificial generator cuts, including same-side contact subdivisions.
 */
export function partitionCylinderFaceByCylinder3(input:PreparedCylinderFace3,inputCutter:Cylinder3):CylinderFaceCylinderPartition3 {
 const base=prepareCylinderFace3(input.surface,input.lower,input.upper,{angular:input.angular,sense:input.sense}),cutter=cylinder3(inputCutter.axis,inputCutter.radiusSquared),intersection=intersectCylinders3(base.surface,cutter),d=base.surface.axis.direction,o=base.surface.axis.origin,D=dot3(d,d),C=base.angular.circle,cuts:AlgebraicCoordinates3[]=[],contacts:AlgebraicCoordinates3[]=[];let sourceArcs:readonly CylinderIntersectionArc3[]=[];
 if(intersection.kind==='bounded'){
  const atHeight=(t:Rational)=>plane3(d.x,d.y,d.z,dot3(d,o).add(D.mul(t)).neg()),clipped=clipCylinderIntersectionByHalfspaces3(intersection,[{plane:atHeight(base.lower),side:1},{plane:atHeight(base.upper),side:-1}]);
  sourceArcs=clipped.arcs;for(const p of [...intersection.vertices,...clipped.vertices])cuts.push(cylinderCoordinates3(base.surface,p).base);contacts.push(...clipped.isolatedPoints.filter(p=>base.locate(p)!=='outside'));
 }else if(intersection.kind==='lines')for(const line of intersection.lines)cuts.push(cylinderCoordinates3(base.surface,line.line.origin).base);
 const u=d.y.sign()!==0||d.z.sign()!==0?cross3(d,point3(1n,0n)):cross3(d,point3(0n,1n)),v=cross3(d,u);
 for(const ray of [u,v,point3(u.x.neg(),u.y.neg(),u.z.neg()),point3(v.x.neg(),v.y.neg(),v.z.neg())])cuts.push(algebraicPoint3(o,ray,AlgebraicReal.fromRational(base.surface.radiusSquared.div(dot3(ray,ray))).sqrt()));
 const unique=cuts.filter((p,i,all)=>all.findIndex(q=>same(p,q))===i&&pointOnArc3(p,base.angular)),angularCells=splitCircularArc3(base.angular,unique),cells:CylinderFaceCell3[]=[];
 for(const angular of angularCells){
  const q=interiorPointOnArc3(angular),rootBounds=sourceArcs.filter(a=>pointOnArc3(q,a.base)).map(a=>{
   const pieces=splitCylinderIntersectionArc3(a,[angular.start,angular.end].map(p=>evaluateCylinderIntersectionArc3(a,p))),arc=pieces.find(piece=>pointOnArc3(q,piece.base));if(!arc)throw new Error('SSI strip boundary does not cover its angular cell');return Object.freeze({kind:'ssi' as const,arc});
  }).sort((a,b)=>height(base,a,q).compare(height(base,b,q))),bounds:readonly CylinderHeightBound3[]=[Object.freeze({kind:'constant',value:base.lower}),...rootBounds,Object.freeze({kind:'constant',value:base.upper})];
  for(let i=0;i+1<bounds.length;i++){
   const lower=bounds[i]!,upper=bounds[i+1]!,lo=height(base,lower,q),hi=height(base,upper,q);if(lo.compare(hi)>=0)throw new Error('Cylinder strip roots are not strictly ordered');
   const sample=at(base,q,AlgebraicReal.fromRational(between(lo,hi))),side=classifyPointToSurface3(sample,{kind:'cylinder',cylinder:cutter}),loStart=boundPoint(base,lower,angular.start),loEnd=boundPoint(base,lower,angular.end),hiStart=boundPoint(base,upper,angular.start),hiEnd=boundPoint(base,upper,angular.end),loop:BRepCurve3[]=[boundary(base,angular,lower)];
   if(side===0&&intersection.kind!=='coincident')throw new Error('Open cylinder face cell contains an unpartitioned cutter root');
   if(cylinderCoordinates3(base.surface,loStart).height.compare(cylinderCoordinates3(base.surface,hiStart).height)>0||cylinderCoordinates3(base.surface,loEnd).height.compare(cylinderCoordinates3(base.surface,hiEnd).height)>0)throw new Error('Cylinder cell boundary bounds cross');
   loop.push(...generatorBoundary(base,loEnd,hiEnd,contacts),reverseBRepCurve3(boundary(base,angular,upper)),...generatorBoundary(base,hiStart,loStart,contacts));
   const oriented=Object.freeze(base.sense===1?loop:[...loop].reverse().map(reverseBRepCurve3));
   const locate:CylinderFaceCell3['locate']=inputPoint=>{
    const p=snapshotExactPoint3(inputPoint);if(classifyPointToSurface3(p,{kind:'cylinder',cylinder:base.surface})!==0)return 'outside';const coordinates=cylinderCoordinates3(base.surface,p),position=locatePointOnArc3(coordinates.base,angular);if(position==='outside')return 'outside';const low=compareBound(lower,p,coordinates.height),high=compareBound(upper,p,coordinates.height);return low<0||high>0?'outside':low===0||high===0||position==='endpoint'?'boundary':'inside';
   };
   const cell=Object.freeze({angular,lower,upper,side,sample,boundary:oriented,locate});if(cell.locate(sample)!=='inside')throw new Error('Cylinder face cell lacks an interior witness');cells.push(cell);
  }
 }
 const sewn=sewMixedBRepFaces3(cells.map(c=>({surface:{kind:'cylinder' as const,cylinder:base.surface},sense:base.sense,loops:[c.boundary]}))),result=Object.freeze({base,cutter,intersection,cells:Object.freeze(cells),sewn,contacts:Object.freeze(contacts)});owned.add(result);return result;
}
