import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,Polynomial,isolateRealRoots,point2,point3,vector3,line3,cylinder3,plane3,circle2,circularArc2,fullCircleArc2,planeFrame3,mapPlanePoint3,pointInPlaneFrame3,algebraicCoordinates2,algebraicCoordinates3,algebraicPoint2,lineInterval3,planarArc3,pointOnCurve3,curveOnSurface3,curveLoop3,reverseCurve3,curveEndpoints3,compareAlgebraicPoints3,classifyPointToSurface3} from '../dist/index.js';
import type {Curve3,PlaneFrame3,Surface3,Point3} from '../dist/index.js';
const real=(x:bigint|string)=>AlgebraicReal.fromRational(x),sqrt=(n:bigint)=>isolateRealRoots(new Polynomial([-n,0n,1n]))[1]!;
const xy=planeFrame3(point3(0n,0n,0n),vector3(1n,0n,0n),vector3(0n,1n,0n));
const plane:Surface3={kind:'plane',plane:plane3(0n,0n,1n)},cylinder:Surface3={kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),1n)};
const arc=(frame:PlaneFrame3=xy,r:bigint|string=1n):Curve3=>({kind:'planar-arc',arc:planarArc3(frame,fullCircleArc2(circle2(point2(0n,0n),r)))});
const line=(a:Point3,b:Point3):Curve3=>({kind:'line',interval:lineInterval3(line3(a,vector3(b.x.sub(a.x),b.y.sub(a.y),b.z.sub(a.z))),0n,1n)});
test('rational plane frames round-trip skew charts against independent coordinate elimination',()=>{
 let seed=87261;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed%9)-4n;};
 for(let trial=0;trial<100;trial++){
  const o=point3(next(),next(),next()),u=vector3(next(),next(),next()),v=vector3(next(),next(),next());
  const minors=[u.x.mul(v.y).sub(u.y.mul(v.x)),u.x.mul(v.z).sub(u.z.mul(v.x)),u.y.mul(v.z).sub(u.z.mul(v.y))];
  if(minors.every(x=>x.sign()===0)){assert.throws(()=>planeFrame3(o,u,v),RangeError);continue;}
  const frame=planeFrame3(o,u,v),a=new Rational(next(),3n),b=new Rational(next(),7n),mapped=mapPlanePoint3(frame,point2(a,b)),local=pointInPlaneFrame3(frame,mapped);
  assert.ok(local);assert.equal(local.x.compare(AlgebraicReal.fromRational(a)),0);assert.equal(local.y.compare(AlgebraicReal.fromRational(b)),0);
  for(const k of ['x','y','z'] as const)assert.equal(mapped[k].compare(AlgebraicReal.fromRational(o[k].add(a.mul(u[k])).add(b.mul(v[k])))),0);
  // Independent Cramer's-rule inverse using one nonzero 2x2 coordinate minor.
  const pairs=[['x','y'],['x','z'],['y','z']] as const,index=minors.findIndex(m=>m.sign()!==0),[i,j]=pairs[index]!,det=minors[index]!;
  const p=point3(o.x.add(a.mul(u.x)).add(b.mul(v.x)),o.y.add(a.mul(u.y)).add(b.mul(v.y)),o.z.add(a.mul(u.z)).add(b.mul(v.z)));
  const A=p[i].sub(o[i]).mul(v[j]).sub(p[j].sub(o[j]).mul(v[i])).div(det),B=u[i].mul(p[j].sub(o[j])).sub(u[j].mul(p[i].sub(o[i]))).div(det);
  assert.equal(local.x.compare(AlgebraicReal.fromRational(A)),0);assert.equal(local.y.compare(AlgebraicReal.fromRational(B)),0);
 }
});
test('independent algebraic fields and trusted affine correlations survive chart maps',()=>{
 const frame=planeFrame3(point3(1n,2n,3n),vector3(1n,1n,0n),vector3(0n,1n,1n)),a=sqrt(2n),b=sqrt(3n),mapped=mapPlanePoint3(frame,algebraicCoordinates2(a,b)),local=pointInPlaneFrame3(frame,mapped);
 assert.ok(local);assert.equal(local.x.compare(a),0);assert.equal(local.y.compare(b),0);
 assert.equal(mapped.x.compare(a.affine(1n,1n)),0);assert.equal(mapped.z.compare(b.affine(1n,3n)),0);
 const correlated=algebraicPoint2(point2(1n,2n),point2(3n,-1n),a),p=mapPlanePoint3(frame,correlated),back=pointInPlaneFrame3(frame,p);assert.ok(back);
 assert.equal(back.x.compare(correlated.x),0);assert.equal(back.y.compare(correlated.y),0);
 const epsilon=Rational.parse('1/1'+'0'.repeat(30));assert.equal(pointInPlaneFrame3(xy,point3(0n,0n,epsilon)),null);
});
test('bounded lines use exact algebraic trims, geometric membership and reversal',()=>{
 const interval=lineInterval3(line3(point3(1n,2n,3n),vector3(1n,2n,-1n)),sqrt(2n),sqrt(3n)),curve:Curve3={kind:'line',interval};
 const middle=real('3/2'),p=algebraicCoordinates3(middle.affine(1n,1n),middle.affine(2n,2n),middle.affine(-1n,3n));
 assert.equal(pointOnCurve3(p,curve),true);assert.equal(pointOnCurve3(interval.start,curve),true);assert.equal(pointOnCurve3(interval.end,curve),true);
 assert.equal(pointOnCurve3(point3(2n,4n,2n),curve),false);assert.equal(pointOnCurve3(algebraicCoordinates3(p.x,p.y,p.z.affine(1n,1n)),curve),false);
 const reversed=reverseCurve3(curve),[a,b]=curveEndpoints3(curve),[ra,rb]=curveEndpoints3(reversed);assert.equal(compareAlgebraicPoints3(a,rb),0);assert.equal(compareAlgebraicPoints3(b,ra),0);assert.equal(pointOnCurve3(p,reversed),true);
 assert.ok(Object.isFrozen(interval)&&Object.isFrozen(interval.line)&&Object.isFrozen(reversed));
});
test('affine circle arcs describe cylinder oblique-section ellipses exactly',()=>{
 // p=(x,y,y) on local x²+y²=1 lies on cylinder x²+y²=1 and plane z-y=0.
 const frame=planeFrame3(point3(0n,0n,0n),vector3(1n,0n,0n),vector3(0n,1n,1n)),ellipse=arc(frame),section:Surface3={kind:'plane',plane:plane3(0n,-1n,1n)};
 assert.equal(curveOnSurface3(ellipse,cylinder),true);assert.equal(curveOnSurface3(ellipse,section),true);assert.equal(curveOnSurface3(ellipse,plane),false);
 for(const p of [point2(1n,0n),point2(-1n,0n),point2(0n,1n),point2(0n,-1n),algebraicCoordinates2(sqrt(2n).affine('1/2'),sqrt(2n).affine('1/2'))]){
  const mapped=mapPlanePoint3(frame,p);assert.equal(pointOnCurve3(mapped,ellipse),true);assert.equal(classifyPointToSurface3(mapped,cylinder),0);assert.equal(classifyPointToSurface3(mapped,section),0);
 }
 assert.equal(pointOnCurve3(point3(0n,0n,0n),ellipse),false);assert.equal(pointOnCurve3(point3(1n,0n,1n),ellipse),false);
 const upper:Curve3={kind:'planar-arc',arc:planarArc3(frame,circularArc2(circle2(point2(0n,0n),1n),point2(1n,0n),point2(-1n,0n)))};
 assert.equal(pointOnCurve3(point3(0n,1n,1n),upper),true);assert.equal(pointOnCurve3(point3(0n,-1n,-1n),upper),false);
 assert.equal(pointOnCurve3(point3(0n,1n,1n),reverseCurve3(upper)),true);
});
test('whole-curve membership rejects endpoint-only agreement on plane and cylinder',()=>{
 const diameter=line(point3(-1n,0n,0n),point3(1n,0n,0n));assert.equal(curveOnSurface3(diameter,plane),true);assert.equal(curveOnSurface3(diameter,cylinder),false);
 const vertical=planeFrame3(point3(0n,0n,0n),vector3(1n,0n,0n),vector3(0n,0n,1n)),half:Curve3={kind:'planar-arc',arc:planarArc3(vertical,circularArc2(circle2(point2(0n,0n),1n),point2(1n,0n),point2(-1n,0n)))};
 for(const p of curveEndpoints3(half)){assert.equal(classifyPointToSurface3(p,plane),0);assert.equal(classifyPointToSurface3(p,cylinder),0);}
 assert.equal(curveOnSurface3(half,plane),false);assert.equal(curveOnSurface3(half,cylinder),false);
 assert.equal(curveOnSurface3(line(point3(1n,0n,-5n),point3(1n,0n,7n)),cylinder),true);
 const pointCurve:Curve3={kind:'line',interval:lineInterval3(line3(point3(1n,0n,0n),vector3(3n,2n,1n)),0n,0n)};
 assert.equal(curveOnSurface3(pointCurve,cylinder),true);assert.equal(curveOnSurface3(pointCurve,plane),true);
 const pointArc:Curve3={kind:'planar-arc',arc:planarArc3(vertical,circularArc2(circle2(point2(0n,0n),1n),point2(1n,0n),point2(1n,0n)))};
 assert.equal(curveOnSurface3(pointArc,cylinder),true);assert.equal(curveOnSurface3(pointArc,plane),true);
});
test('quadratic pullback accepts exactly circular sections under axis/frame changes',()=>{
 const cases:[PlaneFrame3,bigint|string,boolean][]=[
  [planeFrame3(point3(0n,0n,4n),vector3(2n,0n,1n),vector3(0n,2n,3n)),'1/4',true],
  [planeFrame3(point3(0n,0n,4n),vector3(2n,0n,1n),vector3(0n,3n,3n)),'1/4',false],
  [planeFrame3(point3(0n,0n,4n),vector3(1n,0n,0n),vector3(1n,1n,1n)),1n,false],
  [planeFrame3(point3('1/1000000000000000000000000000000',0n,0n),vector3(1n,0n,0n),vector3(0n,1n,0n)),1n,false],
 ];
 for(const [frame,r,expected] of cases){const curve=arc(frame,r);assert.equal(curveOnSurface3(curve,cylinder),expected);assert.equal(curveOnSurface3(reverseCurve3(curve),cylinder),expected);}
 const shiftedFrame=planeFrame3(point3(-2n,3n,4n),vector3(1n,0n,0n),vector3(0n,1n,1n)),shifted:Curve3={kind:'planar-arc',arc:planarArc3(shiftedFrame,fullCircleArc2(circle2(point2(2n,-3n),1n)))};
 assert.equal(curveOnSurface3(shifted,cylinder),true);
 const equivalent:Surface3={kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n,7n),vector3(0n,0n,'-3/7')),1n)};
 assert.equal(curveOnSurface3(shifted,equivalent),true);
});
test('surface loops validate closure and whole supports, allowing explicit full-circle seams',()=>{
 const circle=arc(),loop=curveLoop3([circle],plane);assert.equal(loop.curves.length,1);assert.ok(Object.isFrozen(loop)&&Object.isFrozen(loop.curves)&&Object.isFrozen(loop.surface));
 const frame=planeFrame3(point3(0n,0n,0n),vector3(1n,0n,0n),vector3(0n,1n,1n));assert.equal(curveLoop3([arc(frame)],cylinder).curves.length,1);
 const triangle=[line(point3(0n,0n,0n),point3(1n,0n,0n)),line(point3(1n,0n,0n),point3(0n,1n,0n)),line(point3(0n,1n,0n),point3(0n,0n,0n))];assert.equal(curveLoop3(triangle,plane).curves.length,3);
 assert.throws(()=>curveLoop3([],plane),RangeError);assert.throws(()=>curveLoop3(triangle.slice(0,2),plane),RangeError);assert.throws(()=>curveLoop3([arc()],{kind:'plane',plane:plane3(1n,0n,0n)}),RangeError);
 const diameter=line(point3(-1n,0n,0n),point3(1n,0n,0n));assert.throws(()=>curveLoop3([diameter,reverseCurve3(diameter)],cylinder),RangeError);
 const west=point2(-1n,0n),full:Curve3={kind:'planar-arc',arc:planarArc3(xy,circularArc2(circle2(point2(0n,0n),1n),west,west,{fullCircle:true}))};
 assert.equal(curveLoop3([full,diameter,reverseCurve3(diameter)],plane).curves.length,3);
});
test('constructors snapshot charts and arc endpoints and distrust forged cached geometry',()=>{
 const origin={...point3(0n,0n,0n)},u={...vector3(1n,0n,0n)},v={...vector3(0n,1n,0n)},frame=planeFrame3(origin,u,v),input=fullCircleArc2(circle2(point2(0n,0n),1n)),curve=planarArc3(frame,input);
 origin.z=new Rational(7n);u.x=new Rational(9n);v.y=new Rational(12n);assert.equal(pointOnCurve3(point3(1n,0n,0n),{kind:'planar-arc',arc:curve}),true);
 const forged:Curve3={kind:'planar-arc',arc:{...curve,start:algebraicCoordinates3(999n,0n,0n),end:algebraicCoordinates3(999n,0n,0n)}};
 assert.equal(curveOnSurface3(forged,cylinder),true);assert.equal(curveEndpoints3(forged)[0].x.compare(real(1n)),0);
 assert.throws(()=>planeFrame3(point3(0n,0n,0n),vector3(1n,2n,3n),vector3(2n,4n,6n)),RangeError);
});
test('whole-circle cylinder containment agrees with five independent rational samples',()=>{
 // A quadratic restricted to a circle has at most four distinct zeros unless
 // it vanishes identically. Five distinct rational unit-circle points suffice.
 const samples=[point2(1n,0n),point2(-1n,0n),point2(0n,1n),point2(0n,-1n),point2('3/5','4/5')];
 let seed=18273;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed%9)-4n;};
 for(let trial=0;trial<100;trial++){
  let a=next(),b=next();if(a===0n&&b===0n)a=1n;
  const cx=new Rational(next()),cy=new Rational(next()),u=vector3(a,b,next()),v=vector3(-b,a,next()),radius=new Rational(a*a+b*b);
  const origin=point3(u.x.mul(cx).add(v.x.mul(cy)).neg(),u.y.mul(cx).add(v.y.mul(cy)).neg(),next());
  const shift=trial%3===0?new Rational(1n,1000000000000000000000000000000n):new Rational(0n);
  const frame=planeFrame3(point3(origin.x.add(shift),origin.y,origin.z),u,v),curve:Curve3={kind:'planar-arc',arc:planarArc3(frame,fullCircleArc2(circle2(point2(cx,cy),1n)))};
  const all=samples.every(p=>{
   const x=p.x.add(cx),y=p.y.add(cy),X=frame.origin.x.add(u.x.mul(x)).add(v.x.mul(y)),Y=frame.origin.y.add(u.y.mul(x)).add(v.y.mul(y));
   return X.mul(X).add(Y.mul(Y)).equals(radius);
  });
  const surface:Surface3={kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),radius)};
  assert.equal(curveOnSurface3(curve,surface),all);assert.equal(all,trial%3!==0);
 }
});
test('closed 3D loops weld independently represented algebraic arc and line endpoints',()=>{
 const h=isolateRealRoots(new Polynomial(['-3/4',0n,1n]))[1]!,top=algebraicCoordinates2('1/2',h),bottom=algebraicCoordinates2('1/2',h.neg());
 const curved:Curve3={kind:'planar-arc',arc:planarArc3(xy,circularArc2(circle2(point2(0n,0n),1n),top,bottom))};
 const chord:Curve3={kind:'line',interval:lineInterval3(line3(point3('1/2',0n,0n),vector3(0n,1n,0n)),h.neg().refine(),h.refine())};
 assert.equal(curveLoop3([curved,chord],plane).curves.length,2);
 assert.equal(curveLoop3([reverseCurve3(chord),reverseCurve3(curved)],plane).curves.length,2);
 assert.throws(()=>curveLoop3([curved,chord],cylinder),RangeError);
});
