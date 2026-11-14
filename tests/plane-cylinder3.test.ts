import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,Polynomial,isolateRealRoots,point2,point3,vector3,line2,line3,plane3,cylinder3,circle3,planeFrame3,mapPlanePoint3,algebraicCoordinates3,algebraicPoint3,translateAlgebraicPoint3,ellipse3,ellipsePlane3,ellipsesCoincide3,pointOnEllipse3,locatePointInEllipse3,intersectLineEllipse3,intersectSegmentEllipse3,intersectEllipsePlane3,ellipticArc3,fullEllipseArc3,reverseEllipticArc3,comparePointsAroundEllipse3,comparePointsOnEllipticArc3,pointOnEllipticArc3,locatePointOnEllipticArc3,splitEllipticArc3,intersectLineEllipticArc3,intersectSegmentEllipticArc3,intersectPlaneCylinder3,intersectPlanes3,intersectLineCircle2,intersectLineCircle3,classifyPointToSurface3,surfacesCoincide3,algebraicLine3,algebraicLinePoint3,pointOnAlgebraicLine3,algebraicLineOnSurface3,curveOnSurface3,pointOnCurve3,reverseCurve3,translateCurve3,curveEndpoints3,curveLoop3,buildBRepTopology3} from '../dist/index.js';
import {circle2} from '../dist/index.js';
import type {Point2,Point3,Vector3,PlaneFrame3,Ellipse3,Curve3} from '../dist/index.js';
const origin=point3(0n,0n,0n),Z=vector3(0n,0n,1n),xy=planeFrame3(origin,vector3(1n,0n,0n),vector3(0n,1n,0n)),unit=cylinder3(line3(origin,Z),1n),q=(x:bigint|string)=>AlgebraicReal.fromRational(x),sqrt=(x:bigint)=>isolateRealRoots(new Polynomial([-x,0n,1n]))[1]!;
const mapQ=(f:PlaneFrame3,p:Point2)=>{const c=(k:'x'|'y'|'z')=>f.origin[k].add(f.u[k].mul(p.x)).add(f.v[k].mul(p.y));return point3(c('x'),c('y'),c('z'));};
const mapDirection=(f:PlaneFrame3,p:Point2)=>vector3(f.u.x.mul(p.x).add(f.v.x.mul(p.y)),f.u.y.mul(p.x).add(f.v.y.mul(p.y)),f.u.z.mul(p.x).add(f.v.z.mul(p.y)));
function radialPoint(e:Ellipse3,x:bigint,y:bigint){
 const a=e.radiusUSquared,b=e.radiusVSquared,den=b.mul(new Rational(x*x)).add(a.mul(new Rational(y*y))),t=AlgebraicReal.fromRational(a.mul(b).div(den)).sqrt();
 return algebraicPoint3(e.frame.origin,vector3(e.frame.u.x.mul(new Rational(x)).add(e.frame.v.x.mul(new Rational(y))),e.frame.u.y.mul(new Rational(x)).add(e.frame.v.y.mul(new Rational(y))),e.frame.u.z.mul(new Rational(x)).add(e.frame.v.z.mul(new Rational(y)))),t);
}
test('skew ellipse coordinates retain disk/curve membership, irrational radii and chart invariance',()=>{
 const e=ellipse3(xy,2n,3n),p=algebraicCoordinates3(AlgebraicReal.fromRational('2/3').sqrt(),sqrt(2n),0n);assert.equal(pointOnEllipse3(p,e),true);assert.equal(locatePointInEllipse3(point3(1n,1n,0n),e),'inside');assert.equal(locatePointInEllipse3(point3(2n,2n,0n),e),'outside');assert.equal(locatePointInEllipse3(point3(0n,0n,'1/1000000000000000000000000000000'),e),'outside');
 const f=planeFrame3(point3(1n,2n,3n),vector3(2n,1n,1n),vector3(1n,-2n,3n)),A=ellipse3(f,4n,1n),scaled=ellipse3(planeFrame3(f.origin,vector3(4n,2n,2n),vector3(-3n,6n,-9n)),1n,'1/9'),swapped=ellipse3(planeFrame3(f.origin,f.v,f.u),1n,4n);
 assert.equal(ellipsesCoincide3(A,scaled),true);assert.equal(ellipsesCoincide3(A,swapped),true);assert.equal(ellipsesCoincide3(A,ellipse3(f,4n,2n)),false);
 assert.equal(pointOnEllipse3(mapQ(f,point2(2n,0n)),A),true);assert.equal(locatePointInEllipse3(f.origin,A),'inside');assert.ok(Object.isFrozen(A)&&Object.isFrozen(A.frame));
 for(const r of [0n,-1n])assert.throws(()=>ellipse3(f,r,1n),RangeError);
});
test('coplanar ellipse line roots agree with an independent raw integer weighted-quadratic oracle',()=>{
 const e=ellipse3(xy,2n,3n);let seed=2173;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed%9)-4n;};
 for(let trial=0;trial<160;trial++){
  const ox=next(),oy=next(),dx=next(),dy=next();if(dx===0n&&dy===0n){trial--;continue;}
  const A=3n*dx*dx+2n*dy*dy,B=2n*(3n*ox*dx+2n*oy*dy),C=3n*ox*ox+2n*oy*oy-6n,disc=B*B-4n*A*C,hits=intersectLineEllipse3(line3(point3(ox,oy,0n),vector3(dx,dy,0n)),e);
  assert.equal(hits.length,disc<0n?0:disc===0n?1:2);hits.forEach((h,i)=>{assert.equal(h.parameter.signOf(new Polynomial([C,B,A])),0);assert.equal(h.multiplicity,disc===0n?2:1);assert.equal(pointOnEllipse3(h.point,e),true);if(i)assert.equal(hits[i-1]!.parameter.compare(h.parameter),-1);});
 }
});
test('skew-frame ellipse intersections agree with independent affine images of circle geometry',()=>{
 const f=planeFrame3(point3(2n,-1n,4n),vector3(2n,1n,0n),vector3(1n,-2n,3n)),e=ellipse3(f,4n,1n),image=planeFrame3(f.origin,vector3(4n,2n,0n),f.v);let seed=7193;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed%9)-4n;};
 for(let i=0;i<100;i++){
  const o=point2(next(),next()),d=point2(next(),next());if(d.x.sign()===0&&d.y.sign()===0){i--;continue;}
  const expected=intersectLineCircle2(line2(o,d),circle2(point2(0n,0n),1n)),hits=intersectLineEllipse3(line3(mapQ(image,o),mapDirection(image,d)),e);assert.equal(hits.length,expected.length);
  expected.forEach((h,j)=>{assert.equal(hits[j]!.parameter.compare(h.parameter),0);const p=mapPlanePoint3(image,h.point);for(const k of ['x','y','z'] as const)assert.equal(hits[j]!.point[k].compare(p[k]),0);});
 }
});
test('transverse lines, tangent roots, segment endpoints and ellipse/plane finite sets are exact',()=>{
 const e=ellipse3(xy,4n,1n),tangent=intersectLineEllipse3(line3(point3(2n,0n,0n),vector3(0n,1n,0n)),e);assert.equal(tangent.length,1);assert.equal(tangent[0]!.multiplicity,2);
 const transverse=intersectLineEllipse3(line3(point3(2n,0n,-2n),Z),e);assert.equal(transverse.length,1);assert.equal(transverse[0]!.parameter.compare(q(2n)),0);assert.equal(transverse[0]!.multiplicity,null);
 assert.equal(intersectLineEllipse3(line3(point3(0n,0n,-2n),Z),e).length,0);assert.equal(intersectLineEllipse3(line3(point3(0n,0n,1n),vector3(1n,0n,0n)),e).length,0);
 assert.equal(intersectSegmentEllipse3({start:point3(2n,0n,0n),end:point3(3n,0n,0n)},e).length,1);assert.equal(intersectSegmentEllipse3({start:point3(2n,0n,0n),end:point3(2n,0n,0n)},e)[0]!.multiplicity,null);
 const a=intersectEllipsePlane3(e,plane3(0n,0n,-7n)),b=intersectEllipsePlane3(e,plane3(0n,0n,1n,-1n)),c=intersectEllipsePlane3(e,plane3(1n,0n,0n));assert.equal(a.kind,'coincident');assert.equal(b.kind,'none');assert.equal(c.kind,'points');if(c.kind==='points'){assert.equal(c.points.length,2);assert.equal(c.points[0]!.y.compare(q(-1n)),0);assert.equal(c.points[1]!.y.compare(q(1n)),0);}
});
test('complete plane/cylinder classification covers ellipses, secant generators, tangency and misses',()=>{
 for(const [p,kind,count] of [[plane3(1n,0n,-1n),'ellipse',0],[plane3(1n,0n,0n),'lines',2],[plane3(1n,0n,0n,-1n),'lines',1],[plane3(1n,0n,0n,-2n),'none',0]] as const){
  const hit=intersectPlaneCylinder3(p,unit);assert.equal(hit.kind,kind);assert.ok(Object.isFrozen(hit));
  if(hit.kind==='lines'){assert.equal(hit.lines.length,count);hit.lines.forEach(l=>{assert.equal(l.multiplicity,count===1?2:1);assert.equal(algebraicLineOnSurface3(l.line,{kind:'plane',plane:p}),true);assert.equal(algebraicLineOnSurface3(l.line,{kind:'cylinder',cylinder:unit}),true);});}
 }
});
test('seeded arbitrary-axis sections match independent integer classification and five-point surface identities',()=>{
 type V=readonly [bigint,bigint,bigint];const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a:V,b:V):V=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 let seed=8127;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed%7)-3n;};
 for(let trial=0;trial<180;trial++){
  const o:V=[next(),next(),next()],d:V=[next(),next(),next()],raw:V=[next(),next(),next()],n:V=trial%3===0?cross(d,raw):raw;if(dot(d,d)===0n||dot(n,n)===0n){trial--;continue;}
  const N=dot(n,n),s=dot(n,d),r=trial%9===0&&s===0n?N:BigInt(trial%4+1),offset=trial%9===0&&s===0n?N-dot(n,o):next(),delta=dot(n,o)+offset,disc=r*N-delta*delta,c=cylinder3(line3(point3(...o),vector3(...d)),r),plane=plane3(...n,offset),hit=intersectPlaneCylinder3(plane,c);
  assert.equal(hit.kind,s!==0n?'ellipse':disc<0n?'none':'lines');
  if(hit.kind==='ellipse'){
   const e=hit.ellipse;assert.equal(surfacesCoincide3({kind:'plane',plane:ellipsePlane3(e)},{kind:'plane',plane}),true);
   const normal=ellipsePlane3(e).normal;assert.equal(normal.x.mul(plane.normal.x).add(normal.y.mul(plane.normal.y)).add(normal.z.mul(plane.normal.z)).sign(),1);
   // Five distinct points force quadratic containment, independently of the new whole-arc predicate.
   for(const [x,y] of [[1n,0n],[0n,1n],[-1n,0n],[0n,-1n],[1n,1n]]){const p=radialPoint(e,x!,y!);assert.equal(pointOnEllipse3(p,e),true);assert.equal(classifyPointToSurface3(p,{kind:'plane',plane}),0);assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:c}),0);}
  }else if(hit.kind==='lines'){
   assert.equal(hit.lines.length,disc===0n?1:2);
   for(const l of hit.lines)for(const t of [-3n,0n,2n]){const p=algebraicLinePoint3(l.line,t);assert.equal(pointOnAlgebraicLine3(p,l.line),true);assert.equal(classifyPointToSurface3(p,{kind:'plane',plane}),0);assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:c}),0);}
  }
 }
});
test('section point sets are invariant under exact plane/axis rescaling and axis-origin shifts',()=>{
 const d=vector3(1n,2n,2n),o=point3(2n,-1n,3n),c=cylinder3(line3(o,d),2n),moved=cylinder3(line3(point3(5n,5n,9n),vector3(-2n,-4n,-4n)),2n);
 for(const plane of [plane3(2n,1n,-1n,3n),plane3(0n,1n,-1n,1n),plane3(1n,0n,0n,2n)]){
  const a=intersectPlaneCylinder3(plane,c),b=intersectPlaneCylinder3(plane,moved),scaled=plane3(plane.normal.x.mul(Rational.parse('-3/7')),plane.normal.y.mul(Rational.parse('-3/7')),plane.normal.z.mul(Rational.parse('-3/7')),plane.offset.mul(Rational.parse('-3/7'))),s=intersectPlaneCylinder3(scaled,c);assert.equal(a.kind,b.kind);assert.equal(a.kind,s.kind);
  if(a.kind==='ellipse'&&b.kind==='ellipse'&&s.kind==='ellipse'){assert.equal(ellipsesCoincide3(a.ellipse,b.ellipse),true);assert.equal(ellipsesCoincide3(a.ellipse,s.ellipse),true);}
  if(a.kind==='lines'&&b.kind==='lines')for(const l of a.lines)assert.ok(b.lines.some(other=>pointOnAlgebraicLine3(l.line.origin,other.line)));
 }
});
const local=[point2(2n,0n),point2('6/5','4/5'),point2(0n,1n),point2('-6/5','4/5'),point2(-2n,0n),point2('-6/5','-4/5'),point2(0n,-1n),point2('6/5','-4/5')],mod=(n:number)=>(n%8+8)%8;
test('elliptic arc membership, traversal and subdivision agree with independent cyclic indices',()=>{
 const f=planeFrame3(point3(1n,2n,3n),vector3(2n,1n,1n),vector3(1n,-2n,3n)),e=ellipse3(f,4n,1n),points=local.map(p=>mapQ(f,p));
 for(const direction of ['ccw','cw'] as const)for(let start=0;start<8;start++)for(let end=0;end<8;end++){
  const arc=ellipticArc3(e,points[start]!,points[end]!,{direction}),sign=direction==='ccw'?1:-1,inside=(i:number)=>start===end?i===start:mod(sign*(i-start))<=mod(sign*(end-start));
  points.forEach((p,i)=>assert.equal(pointOnEllipticArc3(p,arc),inside(i)));const included=points.map((p,i)=>({p,i})).filter(x=>inside(x.i)).sort((a,b)=>mod(sign*(a.i-start))-mod(sign*(b.i-start)));
  for(let i=1;i<included.length;i++)assert.equal(comparePointsOnEllipticArc3(arc,included[i-1]!.p,included[i]!.p),-1);
  const parts=splitEllipticArc3(arc,included.map(x=>x.p));points.forEach((p,i)=>assert.equal(parts.some(a=>pointOnEllipticArc3(p,a)),inside(i)));points.forEach(p=>assert.equal(pointOnEllipticArc3(p,reverseEllipticArc3(arc)),pointOnEllipticArc3(p,arc)));
 }
 for(let i=1;i<points.length;i++)assert.equal(comparePointsAroundEllipse3(e,points[i-1]!,points[i]!),-1);
 assert.equal(splitEllipticArc3(fullEllipseArc3(e),points).length,8);
});
test('irrational ellipse arcs integrate with line filtering, periodic BRep ports and exact translations',()=>{
 const e=ellipse3(xy,2n,3n),a=algebraicPoint3(origin,vector3(1n,0n,0n),sqrt(2n)),b=algebraicPoint3(origin,vector3(0n,1n,0n),sqrt(3n)),arc=ellipticArc3(e,a,b),mid=radialPoint(e,1n,1n);assert.equal(locatePointOnEllipticArc3(mid,arc),'interior');assert.equal(splitEllipticArc3(arc,[mid]).length,2);
 assert.equal(intersectLineEllipticArc3(line3(origin,vector3(1n,1n,0n)),arc).length,1);assert.equal(intersectSegmentEllipticArc3({start:origin,end:point3(2n,2n,0n)},arc).length,1);
 const curve:Curve3={kind:'elliptic-arc',arc:fullEllipseArc3(e)},plane=ellipsePlane3(e),t=buildBRepTopology3([curve],[{surface:{kind:'plane',plane},sense:1,loops:[[{edge:0,direction:1}]]}]);assert.equal(t.vertices.length,1);assert.equal(t.manifoldVertices,true);assert.equal(t.edges[0]!.start,t.edges[0]!.end);
 const v=vector3(2n,-3n,5n),moved=translateCurve3(curve,v);assert.equal(pointOnCurve3(translateAlgebraicPoint3(a,v),moved),true);assert.equal(pointOnCurve3(a,reverseCurve3(curve)),true);assert.equal(curveLoop3([curve],{kind:'plane',plane}).curves.length,1);
 assert.throws(()=>buildBRepTopology3([{kind:'elliptic-arc',arc:ellipticArc3(e,a,a)}],[]),RangeError);
});
test('whole elliptic-arc support checks include noncoaxial common-cylinder ellipses and reject endpoint-only agreement',()=>{
 const hit=intersectPlaneCylinder3(plane3(1n,0n,-1n),unit);assert.equal(hit.kind,'ellipse');if(hit.kind!=='ellipse')return;
 const curve:Curve3={kind:'elliptic-arc',arc:fullEllipseArc3(hit.ellipse)},other=cylinder3(line3(origin,vector3(1n,0n,0n)),1n);assert.equal(curveOnSurface3(curve,{kind:'cylinder',cylinder:unit}),true);assert.equal(curveOnSurface3(curve,{kind:'cylinder',cylinder:other}),true);assert.equal(curveOnSurface3(curve,{kind:'plane',plane:plane3(1n,0n,-1n)}),true);
 const h=AlgebraicReal.fromRational('1/2').sqrt(),p=algebraicCoordinates3(h,h,h),q=algebraicCoordinates3(h.neg(),h,h.neg()),wrong=cylinder3(line3(origin,vector3(0n,1n,0n)),1n);assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:wrong}),0);assert.equal(classifyPointToSurface3(q,{kind:'cylinder',cylinder:wrong}),0);assert.equal(curveOnSurface3({kind:'elliptic-arc',arc:ellipticArc3(hit.ellipse,p,q)},{kind:'cylinder',cylinder:wrong}),false);
});
test('near-parallel and near-tangent sections remain distinct without numerical tolerances',()=>{
 const epsilon=Rational.parse('1/1'+'0'.repeat(30)),one=new Rational(1n),near=intersectPlaneCylinder3(plane3(1n,0n,epsilon),unit),parallel=intersectPlaneCylinder3(plane3(1n,0n,0n),unit);assert.equal(near.kind,'ellipse');assert.equal(parallel.kind,'lines');
 if(near.kind==='ellipse'){const hits=intersectLineEllipse3(line3(origin,vector3(1n,0n,new Rational(1n).div(epsilon).neg())),near.ellipse);assert.equal(hits.length,2);for(const h of hits)assert.equal(classifyPointToSurface3(h.point,{kind:'cylinder',cylinder:unit}),0);}
 for(const [offset,kind,count] of [[one.sub(epsilon),'lines',2],[one,'lines',1],[one.add(epsilon),'none',0]] as const){const h=intersectPlaneCylinder3(plane3(1n,0n,0n,offset.neg()),unit);assert.equal(h.kind,kind);if(h.kind==='lines')assert.equal(h.lines.length,count);}
});
test('algebraic generator lines and plane intersections preserve geometry and immutable snapshots',()=>{
 const cut=intersectPlaneCylinder3(plane3(1n,1n,0n),unit);assert.equal(cut.kind,'lines');if(cut.kind==='lines')for(const {line} of cut.lines){assert.equal(algebraicLineOnSurface3(line,{kind:'plane',plane:plane3(1n,1n,0n)}),true);assert.equal(algebraicLineOnSurface3(line,{kind:'cylinder',cylinder:unit}),true);assert.equal(pointOnAlgebraicLine3(algebraicLinePoint3(line,sqrt(2n)),line),true);assert.ok(Object.isFrozen(line)&&Object.isFrozen(line.origin));}
 const p=plane3(1n,2n,3n,4n),same=intersectPlanes3(p,plane3(-2n,-4n,-6n,-8n)),none=intersectPlanes3(p,plane3(1n,2n,3n,5n)),line=intersectPlanes3(p,plane3(2n,-1n,1n,-2n));assert.equal(same.kind,'coincident');assert.equal(none.kind,'none');assert.equal(line.kind,'line');if(line.kind==='line')for(const t of [-3n,0n,2n]){const x=algebraicPoint3(line.line.origin,line.line.direction,q(t));assert.equal(classifyPointToSurface3(x,{kind:'plane',plane:p}),0);assert.equal(classifyPointToSurface3(x,{kind:'plane',plane:plane3(2n,-1n,1n,-2n)}),0);}
 assert.throws(()=>algebraicLine3(origin,vector3(0n,0n,0n)),RangeError);
 const f=planeFrame3(origin,vector3(1n,0n,0n),vector3(0n,1n,0n)),mutable={...f.origin},e=ellipse3({...f,origin:mutable},2n,3n);mutable.x=new Rational(99n);assert.equal(locatePointInEllipse3(origin,e),'inside');assert.throws(()=>ellipticArc3(e,origin,origin),RangeError);
});
