import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,Polynomial,isolateRealRoots,point2,point3,vector3,segment3,plane3,line2,circle2,intersectLineCircle2,intersectCircles2,line3,cylinder3,circle3,circleThroughPoints3,circlePlane3,pointOnCircle3,circlesCoincide3,intersectLineCircle3,intersectSegmentCircle3,intersectCirclePlane3,intersectCircles3,comparePointsAroundCircle3,circularArc3,fullCircleArc3,reverseCircularArc3,locatePointOnArc3,pointOnArc3,comparePointsOnArc3,splitCircularArc3,intersectLineArc3,intersectSegmentArc3,intersectArcs3,algebraicPoint3,algebraicCoordinates3,compareAlgebraicPoints3,planeFrame3,mapPlanePoint3,pointOnCurve3,curveOnSurface3,curveLoop3,reverseCurve3,curveEndpoints3} from '../dist/index.js';
import type {Point3,Surface3,Curve3,Circle3,CircularArc3,AlgebraicCoordinates3} from '../dist/index.js';
const q=(n:bigint|string)=>AlgebraicReal.fromRational(n),sqrt=(n:bigint)=>isolateRealRoots(new Polynomial([-n,0n,1n]))[1]!;
const origin=point3(0n,0n,0n),normal=vector3(1n,1n,1n),oblique=circle3(origin,normal,1n);
const xy=circle3(origin,vector3(0n,0n,1n),1n);
function verifyHits(circle:Circle3,hits:ReturnType<typeof intersectLineCircle3>){
 assert.ok(Object.isFrozen(hits));hits.forEach((h,i)=>{assert.ok(Object.isFrozen(h)&&Object.isFrozen(h.point));assert.equal(pointOnCircle3(h.point,circle),true);if(i)assert.equal(hits[i-1]!.parameter.compare(h.parameter),-1);});
}
test('arbitrary-normal full circles retain exact irrational coordinates without rational chart restrictions',()=>{
 const full=fullCircleArc3(oblique);assert.equal(full.fullCircle,true);assert.equal(pointOnCircle3(full.start,oblique),true);assert.equal(full.start.x.sign(),0);assert.equal(full.start.y.compare(sqrt(2n).affine('1/2')),0);assert.equal(full.start.z.compare(sqrt(2n).affine('-1/2')),0);
 assert.equal(pointOnCircle3(algebraicCoordinates3(full.start.x,full.start.y,full.start.z.affine(1n,'1/1000000000000000000000000000000')),oblique),false);
 assert.equal(pointOnCircle3(point3(1n,0n,0n),oblique),false);assert.equal(pointOnCircle3(origin,oblique),false);
 assert.equal(circlesCoincide3(oblique,circle3(origin,vector3('-2/3','-2/3','-2/3'),1n)),true);
 assert.equal(circlesCoincide3(oblique,circle3(origin,vector3(0n,0n,1n),1n)),false);
 const line=line3(origin,vector3(1n,-1n,0n)),hits=intersectLineCircle3(line,oblique);verifyHits(oblique,hits);assert.equal(hits.length,2);assert.equal(hits[1]!.parameter.compare(sqrt(2n).affine('1/2')),0);assert.deepEqual(hits.map(h=>h.multiplicity),[1,1]);
 assert.ok(Object.isFrozen(full)&&Object.isFrozen(full.circle)&&Object.isFrozen(full.start));
});
test('seeded coplanar 3D line/circle intersections match independent 2D geometry under a rational isometry',()=>{
 const frame=planeFrame3(point3(2n,-1n,4n),vector3('2/3','1/3','-2/3'),vector3('-2/3','2/3','-1/3'));
 const embed=(p:ReturnType<typeof point2>)=>point3(new Rational(2n).add(p.x.mul(Rational.parse('2/3'))).sub(p.y.mul(Rational.parse('2/3'))),new Rational(-1n).add(p.x.div(new Rational(3n))).add(p.y.mul(Rational.parse('2/3'))),new Rational(4n).sub(p.x.mul(Rational.parse('2/3'))).sub(p.y.div(new Rational(3n))));
 const direction=(p:ReturnType<typeof point2>)=>{const z=embed(point2(0n,0n)),v=embed(p);return vector3(v.x.sub(z.x),v.y.sub(z.y),v.z.sub(z.z));};
 let seed=6213;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed%9)-4n;};
 for(let i=0;i<180;i++){
  const center=point2(next(),next()),o=point2(next(),next()),d=point2(next(),next());if(d.x.sign()===0&&d.y.sign()===0){i--;continue;}
  const r=BigInt(i%6),local=circle2(center,r),spatial=circle3(embed(center),vector3(1n,2n,2n),r),expected=intersectLineCircle2(line2(o,d),local),actual=intersectLineCircle3(line3(embed(o),direction(d)),spatial);verifyHits(spatial,actual);assert.equal(actual.length,expected.length);
  expected.forEach((h,j)=>{assert.equal(actual[j]!.parameter.compare(h.parameter),0);assert.equal(actual[j]!.multiplicity,h.multiplicity);assert.equal(compareAlgebraicPoints3(actual[j]!.point,mapPlanePoint3(frame,h.point)),0);});
 }
});
test('noncoplanar lines, segment endpoints, tangency and point-circle degeneracies are explicit',()=>{
 const transverse=intersectLineCircle3(line3(point3(1n,0n,-2n),vector3(0n,0n,1n)),xy);verifyHits(xy,transverse);assert.equal(transverse.length,1);assert.equal(transverse[0]!.parameter.compare(q(2n)),0);assert.equal(transverse[0]!.multiplicity,null);
 assert.equal(intersectLineCircle3(line3(point3(0n,0n,-2n),vector3(0n,0n,1n)),xy).length,0);assert.equal(intersectLineCircle3(line3(point3(0n,0n,1n),vector3(1n,0n,0n)),xy).length,0);
 const tangent=intersectLineCircle3(line3(point3(0n,1n,0n),vector3(1n,0n,0n)),xy);assert.equal(tangent.length,1);assert.equal(tangent[0]!.multiplicity,2);
 const endpoint=intersectSegmentCircle3(segment3(point3(1n,0n,0n),point3(2n,0n,0n)),xy);assert.equal(endpoint.length,1);assert.equal(endpoint[0]!.parameter.sign(),0);
 const collapsed=intersectSegmentCircle3(segment3(point3(1n,0n,0n),point3(1n,0n,0n)),xy);assert.equal(collapsed[0]!.multiplicity,null);
 const point=circle3(point3(1n,0n,0n),normal,0n);assert.equal(fullCircleArc3(point).fullCircle,false);assert.equal(circlesCoincide3(point,circle3(point.center,vector3(1n,0n,0n),0n)),true);
 assert.equal(intersectLineCircle3(line3(point3(0n,0n,0n),vector3(1n,0n,0n)),point).length,1);
 assert.equal(intersectSegmentCircle3(segment3(origin,origin),xy).length,0);
});
test('circle/plane and noncoplanar circle/circle intersections are complete and lexicographically sorted',()=>{
 const cases:[Surface3['kind']|string,ReturnType<typeof intersectCirclePlane3>][]=[
  ['coincident',intersectCirclePlane3(oblique,circlePlane3(oblique))],['none',intersectCirclePlane3(oblique,plane3(1n,1n,1n,-1n))],['points',intersectCirclePlane3(oblique,plane3(1n,0n,0n))],
 ];for(const [kind,result] of cases)assert.equal(result.kind,kind);
 const hit=intersectCirclePlane3(oblique,plane3(1n,0n,0n));if(hit.kind==='points'){assert.equal(hit.points.length,2);assert.equal(compareAlgebraicPoints3(hit.points[0]!,hit.points[1]!),-1);for(const p of hit.points){assert.equal(p.x.sign(),0);assert.equal(pointOnCircle3(p,oblique),true);}}
 const other=circle3(origin,vector3(0n,1n,0n),1n),cross=intersectCircles3(xy,other);assert.equal(cross.kind,'points');if(cross.kind==='points'){assert.equal(cross.points.length,2);assert.equal(cross.points[0]!.x.compare(q(-1n)),0);assert.equal(cross.points[1]!.x.compare(q(1n)),0);}
 const tangent=intersectCircles3(xy,circle3(point3(1n,1n,0n),vector3(0n,1n,0n),1n));assert.equal(tangent.kind,'points');if(tangent.kind==='points'){assert.equal(tangent.points.length,1);assert.equal(tangent.points[0]!.y.compare(q(1n)),0);}
 assert.equal(intersectCircles3(xy,circle3(origin,vector3(0n,1n,0n),2n)).kind,'none');
 assert.equal(intersectCircles3(xy,circle3(point3(0n,0n,1n),vector3(0n,0n,1n),1n)).kind,'none');
 assert.equal(intersectCircles3(xy,circle3(origin,vector3(0n,0n,-3n),1n)).kind,'coincident');
 const point=circle3(point3(1n,0n,0n),normal,0n);assert.equal(intersectCircles3(point,xy).kind,'points');assert.equal(intersectCircles3(xy,point).kind,'points');
 assert.equal(intersectCirclePlane3(point,plane3(0n,0n,1n)).kind,'points');assert.equal(intersectCirclePlane3(point,plane3(0n,0n,1n,-1n)).kind,'none');
});
test('coplanar circle/circle intersections match the independent 2D radical-axis implementation',()=>{
 for(let x=-3n;x<=3n;x++)for(let y=-2n;y<=2n;y++)for(const r of [0n,1n,2n,4n]){
  const expected=intersectCircles2(circle2(point2(0n,0n),1n),circle2(point2(x,y),r)),actual=intersectCircles3(xy,circle3(point3(x,y,0n),vector3(0n,0n,-7n),r));assert.equal(actual.kind,expected.kind);
  if(actual.kind==='points'&&expected.kind==='points'){assert.equal(actual.points.length,expected.points.length);actual.points.forEach((p,i)=>{assert.equal(p.x.compare(expected.points[i]!.x),0);assert.equal(p.y.compare(expected.points[i]!.y),0);assert.equal(p.z.sign(),0);});}
 }
});
const hexagon=[point3(0n,1n,-1n),point3(-1n,1n,0n),point3(-1n,0n,1n),point3(0n,-1n,1n),point3(1n,-1n,0n),point3(1n,0n,-1n)];
const hexCircle=circle3(origin,normal,2n),mod=(x:number,n=12)=>(x%n+n)%n;
const samples:AlgebraicCoordinates3[]=hexagon.flatMap((p,i)=>{const n=hexagon[(i+1)%6]!,direction=vector3(p.x.add(n.x),p.y.add(n.y),p.z.add(n.z)),t=AlgebraicReal.fromRational('1/3').sqrt();return [algebraicCoordinates3(p.x,p.y,p.z),algebraicPoint3(origin,direction,t)];});
function expected(start:number,end:number,sign:number,full:boolean,k:number):boolean {
 if(full)return true;if(start===end)return k===2*start;
 return mod(sign*(k-2*start))<=mod(sign*2*(end-start));
}
test('spatial arc membership, traversal and subdivision agree with independent cyclic indices',()=>{
 for(const normalSign of [1,-1])for(const direction of ['ccw','cw'] as const)for(let s=0;s<6;s++)for(let e=0;e<6;e++){
  const c=circle3(origin,vector3(BigInt(normalSign),BigInt(normalSign),BigInt(normalSign)),2n),arc=circularArc3(c,hexagon[s]!,hexagon[e]!,{direction}),sign=normalSign*(direction==='ccw'?1:-1);
  samples.forEach((p,k)=>assert.equal(pointOnArc3(p,arc),expected(s,e,sign,false,k),`${normalSign} ${direction} ${s}->${e} @ ${k}`));
  const included=samples.map((p,k)=>({p,k})).filter(({k})=>expected(s,e,sign,false,k)).sort((a,b)=>mod(sign*(a.k-2*s))-mod(sign*(b.k-2*s)));
  for(let i=1;i<included.length;i++)assert.equal(comparePointsOnArc3(arc,included[i-1]!.p,included[i]!.p),-1);
  const parts=splitCircularArc3(arc,included.filter((_,i)=>i%2===0).map(x=>x.p));
  samples.forEach((p,k)=>assert.equal(parts.some(piece=>pointOnArc3(p,piece)),expected(s,e,sign,false,k)));
  const reverse=reverseCircularArc3(arc);samples.forEach(p=>assert.equal(pointOnArc3(p,reverse),pointOnArc3(p,arc)));
 }
 for(let i=1;i<6;i++)assert.equal(comparePointsAroundCircle3(hexCircle,hexagon[i-1]!,hexagon[i]!),-1);
 const full=circularArc3(hexCircle,hexagon[3]!,hexagon[3]!,{fullCircle:true}),parts=splitCircularArc3(full,hexagon);
 assert.equal(parts.length,6);assert.ok(parts.every(p=>!p.fullCircle));assert.equal(compareAlgebraicPoints3(parts[0]!.start,algebraicCoordinates3(hexagon[3]!.x,hexagon[3]!.y,hexagon[3]!.z)),0);
});
test('coincident spatial arc intersections reconcile opposite normals and retain isolated contacts',()=>{
 let seed=9087;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let trial=0;trial<220;trial++){
  const s1=next()%6,e1=next()%6,s2=next()%6,e2=next()%6,sign1=next()%2?1:-1,sign2=next()%2?1:-1,n1=trial%2?1:-1,n2=trial%3?1:-1,full1=trial%19===0,full2=trial%23===0;
  const a=circularArc3(circle3(origin,vector3(BigInt(n1),BigInt(n1),BigInt(n1)),2n),hexagon[s1]!,hexagon[full1?s1:e1]!,{direction:sign1===n1?'ccw':'cw',fullCircle:full1});
  const b=circularArc3(circle3(origin,vector3(BigInt(n2),BigInt(n2),BigInt(n2)),2n),hexagon[s2]!,hexagon[full2?s2:e2]!,{direction:sign2===n2?'ccw':'cw',fullCircle:full2});
  const hit=intersectArcs3(a,b);assert.ok(Object.isFrozen(hit));
  samples.forEach((p,k)=>{
   const actual=hit.kind==='none'?false:hit.points.some(q=>compareAlgebraicPoints3(p,q)===0)||(hit.kind==='overlap'&&hit.arcs.some(arc=>pointOnArc3(p,arc)));
   assert.equal(actual,expected(s1,full1?s1:e1,sign1,full1,k)&&expected(s2,full2?s2:e2,sign2,full2,k),`trial ${trial} sample ${k}`);
  });
  if(hit.kind==='overlap'){assert.ok(Object.isFrozen(hit.arcs));hit.arcs.forEach(p=>{assert.equal(p.direction,a.direction);assert.equal(p.circle.normal.x.compare(a.circle.normal.x),0);});}
 }
 const upper=circularArc3(xy,point3(1n,0n,0n),point3(-1n,0n,0n)),lower=circularArc3(xy,point3(-1n,0n,0n),point3(1n,0n,0n));
 const points=intersectArcs3(upper,lower);assert.equal(points.kind,'points');if(points.kind==='points')assert.equal(points.points.length,2);
});
test('line/arc filtering and noncoplanar arc intersections preserve complete finite contacts',()=>{
 const upper=circularArc3(xy,point3(1n,0n,0n),point3(-1n,0n,0n));
 assert.equal(locatePointOnArc3(point3(1n,0n,0n),upper),'endpoint');assert.equal(locatePointOnArc3(point3(0n,1n,0n),upper),'interior');assert.equal(locatePointOnArc3(point3(0n,-1n,0n),upper),'outside');
 assert.equal(intersectLineArc3(line3(origin,vector3(0n,1n,0n)),upper).length,1);assert.equal(intersectSegmentArc3(segment3(point3(0n,-2n,0n),point3(0n,0n,0n)),upper).length,0);
 const perpendicular=fullCircleArc3(circle3(origin,vector3(0n,1n,0n),1n)),hit=intersectArcs3(upper,perpendicular);assert.equal(hit.kind,'points');if(hit.kind==='points')assert.equal(hit.points.length,2);
});
test('arbitrary-axis circular arcs integrate with whole-curve surface checks and closed BRep walks',()=>{
 const center=point3(2n,3n,4n),c=circle3(center,normal,1n),arc=fullCircleArc3(c),curve:Curve3={kind:'circular-arc',arc},cylinder:Surface3={kind:'cylinder',cylinder:cylinder3(line3(point3(1n,2n,3n),normal),1n)},plane:Surface3={kind:'plane',plane:circlePlane3(c)};
 assert.equal(pointOnCurve3(arc.start,curve),true);assert.equal(curveOnSurface3(curve,cylinder),true);assert.equal(curveOnSurface3(curve,plane),true);assert.equal(curveLoop3([curve],cylinder).curves.length,1);assert.equal(curveLoop3([reverseCurve3(curve)],plane).curves.length,1);
 assert.equal(compareAlgebraicPoints3(curveEndpoints3(curve)[0],arc.start),0);
 assert.equal(curveOnSurface3(curve,{kind:'cylinder',cylinder:cylinder3(line3(center,vector3(0n,0n,1n)),1n)}),false);
 const point=fullCircleArc3(circle3(point3(1n,0n,0n),normal,0n));assert.equal(curveOnSurface3({kind:'circular-arc',arc:point},{kind:'cylinder',cylinder:cylinder3(line3(origin,vector3(0n,0n,1n)),1n)}),true);
});
test('spatial circle constructors validate planes, seams and mutable caller data',()=>{
 assert.throws(()=>circle3(origin,vector3(0n,0n,0n),1n),RangeError);assert.throws(()=>circle3(origin,normal,-1n),RangeError);
 assert.throws(()=>circularArc3(xy,point3(0n,0n,1n),point3(1n,0n,0n)),RangeError);assert.throws(()=>circularArc3(xy,point3(1n,0n,0n),point3(-1n,0n,0n),{fullCircle:true}),RangeError);
 const center={...origin},n={...normal},c=circle3(center,n,1n);center.x=new Rational(8n);n.z=new Rational(0n);assert.equal(c.center.x.sign(),0);assert.equal(c.normal.z.sign(),1);
 const forged={...algebraicCoordinates3(origin.x,origin.y,origin.z),origin:point3(1n,0n,0n),direction:vector3(0n,0n,1n),parameter:q(0n)};assert.equal(pointOnCircle3(forged,xy),false);
 const point=circle3(point3(1n,0n,0n),normal,0n);assert.equal(intersectCircles3(point,circle3(origin,normal,0n)).kind,'none');
});
test('whole spatial-circle surface membership agrees with independent five-point projection tests',()=>{
 let seed=91827;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed%9)-4n;};
 for(let trial=0;trial<120;trial++){
  const C:[bigint,bigint,bigint]=[next(),next(),next()],d:[bigint,bigint,bigint]=trial%3===0?[1n,1n,1n]:[next(),next(),next()];if(d.every(x=>x===0n))d[0]=1n;
  const O:[bigint,bigint,bigint]=trial%3===0?[C[0]-d[0],C[1]-d[1],C[2]-d[2]]:[next(),next(),next()],r=trial%3===0?2n:BigInt(trial%4+1),D=d[0]**2n+d[1]**2n+d[2]**2n;
  const center=point3(...C),c=circle3(center,normal,2n),curve:Curve3={kind:'circular-arc',arc:fullCircleArc3(c)},surface:Surface3={kind:'cylinder',cylinder:cylinder3(line3(point3(...O),vector3(...d)),r)};
  const all=hexagon.slice(0,5).every(p=>{
   const q=[p.x.numerator+C[0]-O[0],p.y.numerator+C[1]-O[1],p.z.numerator+C[2]-O[2]],along=d[0]*q[0]!+d[1]*q[1]!+d[2]*q[2]!;
   return D*(q[0]!**2n+q[1]!**2n+q[2]!**2n)-along*along-r*D===0n;
  });
  assert.equal(curveOnSurface3(curve,surface),all,`trial ${trial}`);
 }
 const arc=circularArc3(xy,point3(1n,0n,0n),point3(0n,1n,0n)),shifted:Surface3={kind:'cylinder',cylinder:cylinder3(line3(point3(1n,1n,0n),vector3(0n,0n,1n)),1n)};
 assert.equal(pointOnCircle3(arc.start,circle3(point3(1n,1n,0n),vector3(0n,0n,1n),1n)),true);assert.equal(pointOnCircle3(arc.end,circle3(point3(1n,1n,0n),vector3(0n,0n,1n),1n)),true);
 assert.equal(curveOnSurface3({kind:'circular-arc',arc},shifted),false);
});
test('seeded circle/plane intersections match an independent integer extremal-distance oracle',()=>{
 type V=readonly [bigint,bigint,bigint];const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];let seed=3719;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed%9)-4n;};
 for(let trial=0;trial<220;trial++){
  const center:V=[next(),next(),next()],n:V=[next(),next(),next()],m:V=trial%7===0?n:[next(),next(),next()];
  if(dot(n,n)===0n||dot(m,m)===0n){trial--;continue;}
  const r=BigInt(trial%5),offset=trial%11===0?-dot(m,center):next(),D=dot(n,n),T=D*dot(m,m)-dot(n,m)**2n,delta=dot(m,center)+offset,H=r*T-delta*delta*D;
  const c=circle3(point3(...center),vector3(...n),r),plane=plane3(...m,offset),hit=intersectCirclePlane3(c,plane);
  if(r===0n)assert.equal(hit.kind,delta===0n?'points':'none');
  else if(T===0n)assert.equal(hit.kind,delta===0n?'coincident':'none');
  else assert.equal(hit.kind,H>=0n?'points':'none');
  if(hit.kind==='points'){
   assert.equal(hit.points.length,r===0n||H===0n?1:2);
   for(const p of hit.points){
    assert.equal(pointOnCircle3(p,c),true);
    const form=(v:Point3)=>v.x.mul(new Rational(m[0])).add(v.y.mul(new Rational(m[1]))).add(v.z.mul(new Rational(m[2])));
    assert.equal(form(p.origin).add(new Rational(offset)).sign(),0);assert.equal(form(p.direction).sign(),0);
   }
  }
 }
});
test('arbitrary-normal near-tangent circles distinguish tiny overlap, contact and gap',()=>{
 const epsilon=Rational.parse('1/1'+'0'.repeat(30)),two=new Rational(2n),a=circle3(origin,normal,2n);
 for(const [distance,count] of [[two.sub(epsilon),2],[two,1],[two.add(epsilon),0]] as const){
  const b=circle3(point3(0n,distance,distance.neg()),normal,2n),hit=intersectCircles3(a,b);
  assert.equal(hit.kind,count?'points':'none');if(hit.kind==='points'){assert.equal(hit.points.length,count);for(const p of hit.points){assert.equal(pointOnCircle3(p,a),true);assert.equal(pointOnCircle3(p,b),true);}}
 }
});

test('three rational spatial points determine an exact circumcircle and oriented normal',()=>{
 const a=point3(1n,0n,0n),b=point3(0n,1n,0n),c=point3(0n,0n,1n),circle=circleThroughPoints3(a,b,c);
 for(const k of ['x','y','z'] as const)assert.equal(circle.center[k].compare(Rational.parse('1/3')),0);
 assert.equal(circle.radiusSquared.compare(Rational.parse('2/3')),0);
 for(const points of [[a,b,c],[a,c,b],[b,a,c],[b,c,a],[c,a,b],[c,b,a]] as const){const other=circleThroughPoints3(...points);assert.equal(circlesCoincide3(circle,other),true);for(const p of points)assert.equal(pointOnCircle3(p,other),true);}
 assert.throws(()=>circleThroughPoints3(origin,point3(1n,1n,1n),point3(2n,2n,2n)),RangeError);
 assert.throws(()=>circleThroughPoints3(a,a,b),RangeError);
 let seed=9211;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed%13)-6n;};
 for(let i=0;i<80;i++){
  const points=[point3(next(),next(),next()),point3(next(),next(),next()),point3(next(),next(),next())] as const;
  const u=points[1].x.sub(points[0].x),v=points[1].y.sub(points[0].y),w=points[1].z.sub(points[0].z),x=points[2].x.sub(points[0].x),y=points[2].y.sub(points[0].y),z=points[2].z.sub(points[0].z);
  if(v.mul(z).sub(w.mul(y)).sign()===0&&w.mul(x).sub(u.mul(z)).sign()===0&&u.mul(y).sub(v.mul(x)).sign()===0){assert.throws(()=>circleThroughPoints3(...points),RangeError);continue;}
  const result=circleThroughPoints3(...points);for(const p of points)assert.equal(pointOnCircle3(p,result),true);assert.equal(circlesCoincide3(result,circleThroughPoints3(points[2],points[0],points[1])),true);
 }
});
