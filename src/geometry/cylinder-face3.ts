import {Rational} from '../numeric/rational.js';
import {exactRational} from '../numeric/polynomial.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {point3,vector3,dot3,subtract3} from './point3.js';
import type {Point3,Vector3} from './point3.js';
import {cylinder3,classifyPointToSurface3} from './surface3.js';
import type {Cylinder3} from './surface3.js';
import {algebraicCoordinates3,algebraicPoint3,snapshotExactPoint3,getPointParameterization3,translateAlgebraicPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {algebraicSegment3} from './algebraic-segment3.js';
import {reverseCurve3} from './curve3.js';
import type {Curve3} from './curve3.js';
import {circle3,circlesCoincide3,circularArc3,fullCircleArc3,locatePointOnArc3,interiorPointOnArc3} from './circle3.js';
import type {CircularArc3} from './circle3.js';
import type {CurveRegionLocation2} from './curve-boolean2.js';
import {buildBRepTopology3} from './brep-topology3.js';
import type {BRepEdgeUse3,BRepTopology3} from './brep-topology3.js';

export interface CylinderFaceOptions3 {
  /** Angular set on the circle centered at the input axis origin, normal parallel
   * to the axis. Either traversal/normal sign is accepted; point arcs are rejected.
   */
  readonly angular?:CircularArc3;
  readonly sense?:1|-1;
}
/** Embedded finite cylinder band or angular patch, with exact rational axial bounds.
 * Bounds are input axis parameters, not distances measured along a unit vector.
 */
export interface PreparedCylinderFace3 {
  readonly surface:Cylinder3;
  readonly lower:Rational;readonly upper:Rational;
  /** Equivalent angular set normalized CCW about the input axis direction. */
  readonly angular:CircularArc3;
  readonly sense:1|-1;
  readonly boundary:readonly (readonly Curve3[])[];
  readonly topology:BRepTopology3;
  readonly sample:AlgebraicCoordinates3;
  locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
  /** Non-unit outward/inward normal, only for points in the closed face. */
  normalAt(point:Point3|AlgebraicCoordinates3):AlgebraicCoordinates3;
}
const axes=['x','y','z'] as const;
function scale(v:Vector3,t:Rational):Vector3{return vector3(v.x.mul(t),v.y.mul(t),v.z.mul(t));}
function linear(p:AlgebraicCoordinates3,v:Vector3,offset:Rational):AlgebraicReal{return p.x.affine(v.x,offset).add(p.y.affine(v.y)).add(p.z.affine(v.z));}
export function prepareCylinderFace3(input:Cylinder3,inputLower:ExactInput,inputUpper:ExactInput,options:CylinderFaceOptions3={}):PreparedCylinderFace3 {
  const surface=cylinder3(input.axis,input.radiusSquared),lower=exactRational(inputLower),upper=exactRational(inputUpper),sense=options.sense??1,o=surface.axis.origin,d=surface.axis.direction,D=dot3(d,d);
  if(lower.compare(upper)>=0)throw new RangeError('Cylinder face requires strictly increasing axial bounds');
  if(sense!==1&&sense!==-1)throw new RangeError('Face sense must be +1 or -1');
  const base=circle3(o,d,surface.radiusSquared),raw=options.angular===undefined?fullCircleArc3(base):circularArc3(options.angular.circle,options.angular.start,options.angular.end,{direction:options.angular.direction,fullCircle:options.angular.fullCircle});
  if(!circlesCoincide3(raw.circle,base))throw new RangeError('Angular arc must use the circle at the input cylinder axis origin');
  const direction=dot3(raw.circle.normal,d).sign()>0?raw.direction:raw.direction==='ccw'?'cw':'ccw';
  const angular=circularArc3(base,direction==='ccw'?raw.start:raw.end,direction==='ccw'?raw.end:raw.start,{direction:'ccw',fullCircle:raw.fullCircle});
  if(!angular.fullCircle&&angular.start.x.compare(angular.end.x)===0&&angular.start.y.compare(angular.end.y)===0&&angular.start.z.compare(angular.end.z)===0)throw new RangeError('Cylinder angular patch requires positive extent');
  function parameter(p:AlgebraicCoordinates3):AlgebraicReal {
    const data=getPointParameterization3(p);
    if(data)return data.parameter.affine(dot3(data.direction,d).div(D),dot3(subtract3(data.origin,o),d).div(D));
    return linear(p,scale(d,new Rational(1n).div(D)),dot3(o,d).neg().div(D));
  }
  // Project along the axis onto the reference circle plane. Registered affine
  // coordinates remain affine in the same parameter, avoiding field-degree growth.
  function reference(p:AlgebraicCoordinates3):AlgebraicCoordinates3 {
    const data=getPointParameterization3(p);
    if(data){
      const t0=dot3(subtract3(data.origin,o),d).div(D),rate=dot3(data.direction,d).div(D);
      return algebraicPoint3(subtract3(data.origin,scale(d,t0)),subtract3(data.direction,scale(d,rate)),data.parameter);
    }
    const component=(k:typeof axes[number])=>{
      const row=vector3(...axes.map(j=>(j===k?new Rational(1n):new Rational(0n)).sub(d[k].mul(d[j]).div(D))) as [Rational,Rational,Rational]);
      return linear(p,row,d[k].mul(dot3(o,d)).div(D));
    };
    return algebraicCoordinates3(component('x'),component('y'),component('z'));
  }
  const locate:PreparedCylinderFace3['locate']=inputPoint=>{
    const p=snapshotExactPoint3(inputPoint);if(classifyPointToSurface3(p,{kind:'cylinder',cylinder:surface})!==0)return 'outside';
    const t=parameter(p),lo=t.compare(AlgebraicReal.fromRational(lower)),hi=t.compare(AlgebraicReal.fromRational(upper));if(lo<0||hi>0)return 'outside';
    const position=angular.fullCircle?'interior':locatePointOnArc3(reference(p),angular);
    return position==='outside'?'outside':lo===0||hi===0||position==='endpoint'?'boundary':'inside';
  };
  const at=(t:Rational)=>{
    const shift=scale(d,t),center=point3(o.x.add(shift.x),o.y.add(shift.y),o.z.add(shift.z));
    return circularArc3(circle3(center,d,surface.radiusSquared),translateAlgebraicPoint3(angular.start,shift),translateAlgebraicPoint3(angular.end,shift),{direction:'ccw',fullCircle:angular.fullCircle});
  };
  const bottom=at(lower),top=at(upper),B:Curve3=Object.freeze({kind:'circular-arc',arc:bottom}),T:Curve3=Object.freeze({kind:'circular-arc',arc:top});
  let loops:Curve3[][];
  if(angular.fullCircle)loops=[[B],[reverseCurve3(T)]];
  else loops=[[B,Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(bottom.end,top.end)}),reverseCurve3(T),Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(top.start,bottom.start)})]];
  if(sense===-1)loops=loops.map(loop=>loop.slice().reverse().map(reverseCurve3));
  const boundary=Object.freeze(loops.map(loop=>Object.freeze(loop))),edges:Curve3[]=[],uses:BRepEdgeUse3[][]=[];
  for(const loop of boundary){const ring:BRepEdgeUse3[]=[];for(const curve of loop){ring.push({edge:edges.length,direction:1});edges.push(curve);}uses.push(ring);}
  const topology=buildBRepTopology3(edges,[{surface:{kind:'cylinder',cylinder:surface},sense,loops:uses}]);
  if(!topology.manifoldVertices)throw new Error('Cylinder patch has invalid boundary incidence');
  const sample=translateAlgebraicPoint3(interiorPointOnArc3(angular),scale(d,lower.add(upper).div(new Rational(2n))));
  if(locate(sample)!=='inside')throw new Error('Cylinder face sample is not interior');
  const normalAt:PreparedCylinderFace3['normalAt']=inputPoint=>{
    if(locate(inputPoint)==='outside')throw new RangeError('Face normal requires a point in the closed cylinder face');
    const p=reference(snapshotExactPoint3(inputPoint)),factor=D.mul(new Rational(BigInt(sense)));
    return algebraicCoordinates3(p.x.affine(factor,o.x.mul(factor).neg()),p.y.affine(factor,o.y.mul(factor).neg()),p.z.affine(factor,o.z.mul(factor).neg()));
  };
  return Object.freeze({surface,lower,upper,angular,sense,boundary,topology,sample,locate,normalAt});
}
