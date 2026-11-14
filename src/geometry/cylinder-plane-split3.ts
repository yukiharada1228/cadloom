import {Rational} from '../numeric/rational.js';
import type {Sign} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {vector3,cross3,dot3} from './point3.js';
import type {Point3} from './point3.js';
import {plane3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {algebraicCoordinates3,algebraicPoint3,compareAlgebraicPoints3,snapshotExactPoint3,subtractAlgebraicPoints3,translateAlgebraicPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {algebraicSegment3} from './algebraic-segment3.js';
import {intersectAlgebraicSegmentPlane3,evaluatePlaneAtAlgebraicPoint3 as evaluate} from './algebraic-segment-plane3.js';
import {intersectPlaneCylinder3} from './plane-cylinder3.js';
import {intersectPlaneCylinderFace3} from './cylinder-face-section3.js';
import {prepareCylinderFace3} from './cylinder-face3.js';
import type {PreparedCylinderFace3} from './cylinder-face3.js';
import {intersectCirclePlane3,pointOnArc3,splitCircularArc3,interiorPointOnArc3} from './circle3.js';
import {pointOnEllipticArc3,splitEllipticArc3,interiorPointOnEllipticArc3} from './ellipse3.js';
import {pointInPlaneFrame3} from './plane-frame3.js';
import {snapshotCurve3,curveEndpoints3,pointOnCurve3,curveOnSurface3} from './curve3.js';
import type {Curve3} from './curve3.js';
import {buildBRepTopology3} from './brep-topology3.js';
import type {BRepEdgeUse3,BRepTopology3} from './brep-topology3.js';
import type {CurveRegionLocation2} from './curve-boolean2.js';

export interface SplitCylinderRegion3 {
  readonly side:-1|1;
  readonly empty:boolean;
  /** Oriented physical boundary, referencing the result's common edge table. */
  readonly uses:readonly BRepEdgeUse3[];
  /** Null if a vertex has multiple incoming/outgoing uses. No arbitrary pairing. */
  readonly loops:readonly (readonly BRepEdgeUse3[])[]|null;
  /** Regularized closure of the corresponding strict side, relative to the surface. */
  locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
export interface CylinderPlaneSplit3 {
  readonly face:PreparedCylinderFace3;
  readonly plane:Plane3;
  readonly edges:readonly Curve3[];
  readonly sharedEdges:readonly number[];
  readonly negative:SplitCylinderRegion3;
  readonly positive:SplitCylinderRegion3;
  /** Incidence only, when both regions have unambiguous boundary loops.
   * A side can contain multiple connected components; it is not one certified face.
   */
  readonly topology:BRepTopology3|null;
  readonly topologyFaces:Readonly<{negative:number|null;positive:number|null}>;
}
const axes=['x','y','z'] as const;
const same=(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3)=>compareAlgebraicPoints3(a,b)===0;
function midpoint(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3):AlgebraicCoordinates3 {
  const d=subtractAlgebraicPoints3(b,a);
  if(axes.every(k=>d[k].rational!==null))return translateAlgebraicPoint3(a,vector3(d.x.rational!.div(new Rational(2n)),d.y.rational!.div(new Rational(2n)),d.z.rational!.div(new Rational(2n))));
  return algebraicCoordinates3(a.x.add(b.x).affine('1/2'),a.y.add(b.y).affine('1/2'),a.z.add(b.z).affine('1/2'));
}
function witness(c:Curve3):AlgebraicCoordinates3 {
  if(c.kind==='circular-arc')return interiorPointOnArc3(c.arc);
  if(c.kind==='elliptic-arc')return interiorPointOnEllipticArc3(c.arc);
  if(c.kind==='algebraic-segment')return midpoint(c.segment.start,c.segment.end);
  throw new Error('Unexpected cylinder split curve');
}
/** Sign of T·(N×plane.normal), N the physical cylinder normal.
 * Ellipse sections bound a convex planar disk, so their oriented tangent
 * sign is fixed by the chart normal. Generators reduce to a rational linear
 * predicate on the point; neither case needs independent algebraic products.
 */
function orientation(c:Curve3,p:AlgebraicCoordinates3,face:PreparedCylinderFace3,plane:Plane3):Sign {
  if(c.kind==='elliptic-arc'){
    const f=c.arc.ellipse.frame,sign=dot3(cross3(f.u,f.v),plane.normal).sign();
    return (-face.sense*(c.arc.direction==='ccw'?1:-1)*sign) as Sign;
  }
  if(c.kind==='circular-arc'){
    const sign=dot3(c.arc.circle.normal,plane.normal).sign();
    return (-face.sense*(c.arc.direction==='ccw'?1:-1)*sign) as Sign;
  }
  if(c.kind==='algebraic-segment'){
    const delta=subtractAlgebraicPoints3(c.segment.end,c.segment.start);
    const d=face.surface.axis.direction,k=axes.find(k=>d[k].sign()!==0)!,direction=delta[k].sign()*d[k].sign(),n=cross3(plane.normal,d),o=face.surface.axis.origin;
    if(direction===0)throw new Error('Generator must have positive extent');
    return (face.sense*direction*evaluate(plane3(n.x,n.y,n.z,dot3(n,o).neg()),p).sign()) as Sign;
  }
  throw new Error('Unexpected cylinder orientation curve');
}
function unique(points:readonly AlgebraicCoordinates3[]):AlgebraicCoordinates3[]{return points.filter((p,i,all)=>all.findIndex(q=>same(p,q))===i);}
function splitBoundary(c:Curve3,plane:Plane3):readonly Curve3[] {
  if(c.kind==='circular-arc'){
    const arc=c.arc,C=arc.circle,n=C.normal,u=n.y.sign()!==0||n.z.sign()!==0?cross3(n,vector3(1n,0n,0n)):cross3(n,vector3(0n,1n,0n)),v=cross3(n,u);
    const rays=[u,v,vector3(u.x.neg(),u.y.neg(),u.z.neg()),vector3(v.x.neg(),v.y.neg(),v.z.neg())],cardinals=rays.map(d=>algebraicPoint3(C.center,d,AlgebraicReal.fromRational(C.radiusSquared.div(dot3(d,d))).sqrt())),hit=intersectCirclePlane3(C,plane),cuts=unique([...cardinals,...(hit.kind==='points'?hit.points:[])]).filter(p=>pointOnArc3(p,arc));
    return splitCircularArc3(arc,cuts).map(arc=>snapshotCurve3({kind:'circular-arc',arc}));
  }
  if(c.kind==='algebraic-segment'){
    const s=c.segment,hit=intersectAlgebraicSegmentPlane3(s,plane);
    if(hit.kind!=='point'||same(hit.point,s.start)||same(hit.point,s.end))return [c];
    const p=hit.point;
    return [snapshotCurve3({kind:'algebraic-segment',segment:algebraicSegment3(s.start,p)}),snapshotCurve3({kind:'algebraic-segment',segment:algebraicSegment3(p,s.end)})];
  }
  throw new Error('Unexpected cylinder domain boundary');
}
function sectionPieces(c:Curve3):readonly Curve3[] {
  if(c.kind!=='elliptic-arc')return [c];
  const a=c.arc,e=a.ellipse,f=e.frame,rx=AlgebraicReal.fromRational(e.radiusUSquared).sqrt(),ry=AlgebraicReal.fromRational(e.radiusVSquared).sqrt();
  const cuts=[algebraicPoint3(f.origin,f.u,rx),algebraicPoint3(f.origin,f.u,rx.neg()),algebraicPoint3(f.origin,f.v,ry),algebraicPoint3(f.origin,f.v,ry.neg())].filter(p=>pointOnEllipticArc3(p,a));
  return splitEllipticArc3(a,cuts).map(arc=>snapshotCurve3({kind:'elliptic-arc',arc}));
}
function traceLoops(edges:readonly Curve3[],uses:readonly BRepEdgeUse3[]):readonly (readonly BRepEdgeUse3[])[]|null {
  const vertices:AlgebraicCoordinates3[]=[],vertex=(p:AlgebraicCoordinates3)=>{let id=vertices.findIndex(q=>same(p,q));if(id<0){id=vertices.length;vertices.push(p);}return id;};
  const records=uses.map(use=>{const [a,b]=curveEndpoints3(edges[use.edge]!);return {use,origin:vertex(use.direction===1?a:b),target:vertex(use.direction===1?b:a)};}),out=vertices.map(()=>[] as number[]),incoming=vertices.map(()=>0);
  records.forEach((r,i)=>{out[r.origin]!.push(i);incoming[r.target]!++;});
  if(vertices.some((_,i)=>out[i]!.length!==1||incoming[i]!==1))return null;
  const seen=new Set<number>(),loops:(readonly BRepEdgeUse3[])[]=[];
  for(let first=0;first<records.length;first++){
    if(seen.has(first))continue;let next=first;const loop:BRepEdgeUse3[]=[];
    do{seen.add(next);loop.push(records[next]!.use);next=out[records[next]!.target]![0]!;}while(next!==first);
    loops.push(Object.freeze(loop));
  }
  return Object.freeze(loops);
}
/** Regularized plane split of a finite cylinder band/angular patch. Exact
 * geometric domains plus a common boundary-edge table; no shell/solid output.
 */
export function splitCylinderFaceByPlane3(input:PreparedCylinderFace3,inputPlane:Plane3):CylinderPlaneSplit3 {
  const face=prepareCylinderFace3(input.surface,input.lower,input.upper,{angular:input.angular,sense:input.sense}),plane=plane3(inputPlane.normal.x,inputPlane.normal.y,inputPlane.normal.z,inputPlane.offset),edges:Curve3[]=[],negative:BRepEdgeUse3[]=[],positive:BRepEdgeUse3[]=[],shared:number[]=[],support=intersectPlaneCylinder3(plane,face.surface);
  const add=(c:Curve3)=>{const id=edges.length;edges.push(snapshotCurve3(c));return id;};
  // A tangent generator is not a separating boundary on the cylinder surface.
  const trivial=support.kind==='none'||support.kind==='lines'&&support.lines.length===1;
  let wholeSide:Sign=0;
  if(trivial){
    wholeSide=dot3(plane.normal,face.surface.axis.origin).add(plane.offset).sign();
    if(wholeSide===0)throw new Error('Disjoint/tangent cylinder plane must have a nonzero axis offset');
    const uses=wholeSide<0?negative:positive;for(const loop of face.boundary)for(const c of loop)uses.push(Object.freeze({edge:add(c),direction:1}));
  }else {
    for(const loop of face.boundary)for(const boundary of loop)for(const c of splitBoundary(boundary,plane)){
      const p=witness(c);let side=evaluate(plane,p).sign();
      if(side===0){
        if(!curveOnSurface3(c,{kind:'plane',plane}))throw new Error('A noncontained boundary cell has a zero interior plane value');
        side=(-orientation(c,p,face,plane)) as Sign;
        if(side===0)throw new Error('Contained boundary has no transverse inward direction');
      }
      (side<0?negative:positive).push(Object.freeze({edge:add(c),direction:1}));
    }
    const section=intersectPlaneCylinderFace3(plane,face);
    for(const item of section.curves){
      if(item.multiplicity!==1)continue;
      for(const c of sectionPieces(item.curve)){
        const p=witness(c);if(face.locate(p)!=='inside')continue;
        const sign=orientation(c,p,face,plane);
        if(sign===0)throw new Error('A separating section has zero oriented tangent');
        const edge=add(c),direction=sign as 1|-1;shared.push(edge);negative.push(Object.freeze({edge,direction}));positive.push(Object.freeze({edge,direction:direction===1?-1:1}));
      }
    }
  }
  const table=Object.freeze(edges),make=(side:-1|1,uses:BRepEdgeUse3[]):SplitCylinderRegion3=>{
    const frozen=Object.freeze(uses),loops=traceLoops(table,frozen),empty=frozen.length===0;
    const locate:SplitCylinderRegion3['locate']=inputPoint=>{
      const p=snapshotExactPoint3(inputPoint),position=face.locate(p);if(empty||position==='outside')return 'outside';
      if(trivial)return wholeSide===side?position:'outside';
      const sign=evaluate(plane,p).sign();if(sign===side)return position;if(sign!==0)return 'outside';
      return frozen.some(use=>pointOnCurve3(p,table[use.edge]!))?'boundary':'outside';
    };
    return Object.freeze({side,empty,uses:frozen,loops,locate});
  };
  const neg=make(-1,negative),pos=make(1,positive),faces:{surface:{kind:'cylinder';cylinder:PreparedCylinderFace3['surface']};sense:1|-1;loops:readonly (readonly BRepEdgeUse3[])[]}[]=[],ids:{negative:number|null;positive:number|null}={negative:null,positive:null};let topology:BRepTopology3|null=null;
  if(neg.loops!==null&&pos.loops!==null){
    for(const [key,region] of [['negative',neg],['positive',pos]] as const)if(!region.empty){ids[key]=faces.length;faces.push({surface:{kind:'cylinder',cylinder:face.surface},sense:face.sense,loops:region.loops!});}
    topology=buildBRepTopology3(table,faces);
  }
  return Object.freeze({face,plane,edges:table,sharedEdges:Object.freeze(shared),negative:neg,positive:pos,topology,topologyFaces:Object.freeze(ids)});
}
