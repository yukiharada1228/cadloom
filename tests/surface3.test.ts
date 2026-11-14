import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,Polynomial,isolateRealRoots,point3,vector3,segment3,line3,cylinder3,plane3,evaluateCylinder3,classifyPointToSurface3,normalToSurface3,intersectLineSurface3,intersectSegmentSurface3,intersectSegmentPlane,surfacesCoincide3,algebraicCoordinates3,algebraicPoint3,compareAlgebraicPoints3} from '../dist/index.js';
import type {Surface3,LineSurfaceIntersection3,Line3,Point3,AlgebraicCoordinates3} from '../dist/index.js';
const q=(v:bigint|string)=>AlgebraicReal.fromRational(v),sqrt=(n:bigint)=>isolateRealRoots(new Polynomial([-n,0n,1n]))[1]!;
const cylinder=(origin=point3(0n,0n,0n),direction=vector3(0n,0n,1n),r:bigint|string=1n):Surface3=>({kind:'cylinder',cylinder:cylinder3(line3(origin,direction),r)});
function check(line:Line3,surface:Surface3,result:LineSurfaceIntersection3){
 assert.ok(Object.isFrozen(result));
 if(result.kind==='contained'){
  for(const t of [-3n,0n,2n])assert.equal(classifyPointToSurface3(algebraicPoint3(line.origin,line.direction,q(t)),surface),0);
 }else if(result.kind==='points'){
  assert.ok(Object.isFrozen(result.hits));
  result.hits.forEach((hit,i)=>{
   assert.equal(classifyPointToSurface3(hit.point,surface),0);assert.ok(Object.isFrozen(hit)&&Object.isFrozen(hit.point));
   for(const k of ['x','y','z'] as const)assert.equal(hit.point[k].compare(hit.parameter.affine(line.direction[k],line.origin[k])),0);
   if(i)assert.equal(result.hits[i-1]!.parameter.compare(hit.parameter),-1);
  });
 }
 return result;
}
test('cylinder line hits cover crossings, tangencies, generators, parallel gaps and input parameter order',()=>{
 const c=cylinder(),line=line3(point3(-2n,0n,7n),vector3(1n,0n,2n)),hit=check(line,c,intersectLineSurface3(line,c));
 assert.equal(hit.kind,'points');if(hit.kind==='points'){
  assert.deepEqual(hit.hits.map(h=>h.parameter.compare(q(1n))),[0,1]);assert.equal(hit.hits[1]!.parameter.compare(q(3n)),0);
  assert.deepEqual(hit.hits.map(h=>h.multiplicity),[1,1]);assert.equal(hit.hits[0]!.point.z.compare(q(9n)),0);
 }
 const tangentLine=line3(point3(0n,1n,3n),vector3(1n,0n,1n)),tangent=check(tangentLine,c,intersectLineSurface3(tangentLine,c));
 assert.equal(tangent.kind,'points');if(tangent.kind==='points'){assert.equal(tangent.hits.length,1);assert.equal(tangent.hits[0]!.multiplicity,2);assert.equal(tangent.hits[0]!.parameter.sign(),0);}
 for(const [x,expected] of [[0n,'none'],[1n,'contained'],[2n,'none']] as const){const l=line3(point3(x,0n,0n),vector3(0n,0n,-5n));assert.equal(check(l,c,intersectLineSurface3(l,c)).kind,expected);}
 const reverse=line3(line.origin,vector3(-1n,0n,-2n)),reversed=check(reverse,c,intersectLineSurface3(reverse,c));
 assert.equal(reversed.kind,'points');if(reversed.kind==='points')assert.deepEqual(reversed.hits.map(h=>h.parameter.compare(q(-3n))),[0,1]);
});
test('seeded oblique cylinders agree with an independent raw integer projection oracle',()=>{
 type V=readonly [bigint,bigint,bigint];const dot=(a:V,b:V)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
 const p=(v:V)=>point3(...v);let seed=66127;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed%9)-4n;};
 for(let trial=0;trial<250;trial++){
  const o:V=[next(),next(),next()],origin:V=[next(),next(),next()],d:V=[next(),next(),next()],v:V=[next(),next(),next()];
  if(dot(d,d)===0n||dot(v,v)===0n){trial--;continue;}
  const r=BigInt(trial%5+1),u:V=[origin[0]-o[0],origin[1]-o[1],origin[2]-o[2]],D=dot(d,d);
  const A=D*dot(v,v)-dot(d,v)**2n,B=2n*(D*dot(u,v)-dot(d,u)*dot(d,v)),C=D*dot(u,u)-dot(d,u)**2n-r*D,discriminant=B*B-4n*A*C;
  const surface=cylinder(p(o),p(d),r),line=line3(p(origin),p(v)),result=check(line,surface,intersectLineSurface3(line,surface));
  if(A===0n){assert.equal(B,0n);assert.equal(result.kind,C===0n?'contained':'none');}
  else if(discriminant<0n)assert.equal(result.kind,'none');
  else {
   assert.equal(result.kind,'points');if(result.kind==='points'){
    assert.equal(result.hits.length,discriminant===0n?1:2);
    for(const hit of result.hits){assert.equal(hit.parameter.signOf(new Polynomial([C,B,A])),0);assert.equal(hit.multiplicity,discriminant===0n?2:1);}
   }
  }
  for(const t of [-2n,0n,3n]){
   const value=A*t*t+B*t+C,point=algebraicPoint3(line.origin,line.direction,q(t));
   assert.equal(classifyPointToSurface3(point,surface),value<0n?-1:value>0n?1:0);
  }
  assert.equal(evaluateCylinder3((surface as Extract<Surface3,{kind:'cylinder'}>).cylinder,p(origin)).compare(new Rational(C)),0);
 }
});
test('plane segment intersections agree with the existing rational implementation including degeneracies',()=>{
 const plane=plane3(2n,-3n,5n,-7n),surface:Surface3={kind:'plane',plane};let seed=2321;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return BigInt(seed%17)-8n;};
 for(let i=0;i<150;i++){
  const a=point3(next(),next(),next()),b=i%7===0?a:point3(next(),next(),next()),s=segment3(a,b),old=intersectSegmentPlane(s,plane),result=intersectSegmentSurface3(s,surface);
  if(old.kind==='none')assert.equal(result.kind,'none');
  else if(old.kind==='coplanar')assert.equal(result.kind,'contained');
  else {assert.equal(result.kind,'points');if(result.kind==='points'){assert.equal(result.hits.length,1);const h=result.hits[0]!;assert.equal(h.parameter.compare(AlgebraicReal.fromRational(old.parameter)),0);for(const k of ['x','y','z'] as const)assert.equal(h.point[k].compare(AlgebraicReal.fromRational(old.point[k])),0);}}
 }
 const contained=line3(point3(1n,0n,1n),vector3(3n,2n,0n));assert.equal(check(contained,surface,intersectLineSurface3(contained,surface)).kind,'contained');
 const parallel=line3(point3(0n,0n,0n),vector3(3n,2n,0n));assert.equal(intersectLineSurface3(parallel,surface).kind,'none');
});
test('closed cylinder segments preserve irrational hits, endpoint contacts and contained trims',()=>{
 const c=cylinder(point3(0n,0n,0n),vector3(0n,0n,1n),2n),result=intersectSegmentSurface3(segment3(point3(-2n,0n,0n),point3(2n,0n,0n)),c);
 assert.equal(result.kind,'points');if(result.kind==='points'){
  assert.equal(result.hits.length,2);assert.equal(result.hits[0]!.point.x.compare(sqrt(2n).neg()),0);assert.equal(result.hits[1]!.point.x.compare(sqrt(2n)),0);
 }
 const unit=cylinder();
 const endpoint=intersectSegmentSurface3(segment3(point3(1n,0n,0n),point3(2n,0n,0n)),unit);assert.equal(endpoint.kind,'points');if(endpoint.kind==='points'){assert.equal(endpoint.hits.length,1);assert.equal(endpoint.hits[0]!.parameter.sign(),0);}
 assert.equal(intersectSegmentSurface3(segment3(point3(1n,0n,-1n),point3(1n,0n,2n)),unit).kind,'contained');
 const point=intersectSegmentSurface3(segment3(point3(1n,0n,0n),point3(1n,0n,0n)),unit);assert.equal(point.kind,'points');if(point.kind==='points')assert.equal(point.hits[0]!.multiplicity,null);
 assert.equal(intersectSegmentSurface3(segment3(point3(0n,0n,0n),point3(0n,0n,0n)),unit).kind,'none');
});
test('independent algebraic coordinates, untrusted correlation fields and exact normals',()=>{
 const a=sqrt(2n),b=sqrt(3n),c=sqrt(5n),point=algebraicCoordinates3(a,b,c),surface=cylinder(point3(0n,0n,0n),vector3(0n,0n,1n),5n);
 assert.equal(classifyPointToSurface3(point,surface),0);
 const normal=normalToSurface3(point,surface);assert.equal(normal.x.compare(a),0);assert.equal(normal.y.compare(b),0);assert.equal(normal.z.sign(),0);
 const plane:Surface3={kind:'plane',plane:plane3(1n,1n,-1n)},onPlane=algebraicCoordinates3(a,b,a.add(b));assert.equal(classifyPointToSurface3(onPlane,plane),0);
 const n=normalToSurface3(onPlane,plane);assert.equal(n.x.compare(q(1n)),0);assert.equal(n.z.compare(q(-1n)),0);
 const forged={...algebraicCoordinates3(0n,0n,0n),origin:point3(1n,0n,0n),direction:vector3(0n,0n,1n),parameter:q(0n)};
 assert.equal(classifyPointToSurface3(forged,cylinder()),-1);
 assert.throws(()=>normalToSurface3(point3(0n,0n,0n),cylinder()),RangeError);
 assert.equal(compareAlgebraicPoints3(point,algebraicCoordinates3(a.refine(),b.refine(),c.refine())),0);
 assert.ok(Object.isFrozen(point)&&Object.isFrozen(normal));
 // An oblique cylinder's outward normal is perpendicular to the axis and radial.
 const oblique=cylinder(point3(1n,2n,3n),vector3(1n,2n,2n),5n),p=point3(3n,1n,3n),N=normalToSurface3(p,oblique);
 assert.equal(N.x.compare(q(18n)),0);assert.equal(N.y.compare(q(-9n)),0);assert.equal(N.z.sign(),0);
});
test('surface equality ignores axis shift/scale and plane orientation, retaining exact distinct surfaces',()=>{
 const a=cylinder(point3(1n,2n,3n),vector3(1n,2n,2n),5n),b=cylinder(point3(4n,8n,9n),vector3('-3/7','-6/7','-6/7'),5n);
 assert.equal(surfacesCoincide3(a,b),true);
 assert.equal(surfacesCoincide3(a,cylinder(point3(1n,2n,3n),vector3(1n,2n,2n),6n)),false);
 assert.equal(surfacesCoincide3(a,cylinder(point3(1n,2n,4n),vector3(1n,2n,2n),5n)),false);
 const P:Surface3={kind:'plane',plane:plane3(1n,2n,3n,4n)},Q:Surface3={kind:'plane',plane:plane3('-2/3','-4/3',-2n,'-8/3')};
 assert.equal(surfacesCoincide3(P,Q),true);assert.equal(surfacesCoincide3(P,a),false);assert.equal(surfacesCoincide3(P,{kind:'plane',plane:plane3(0n,1n,0n)}),false);
 assert.equal(surfacesCoincide3(P,{kind:'plane',plane:plane3(1n,2n,3n,'4000000000000000000000000000001/1000000000000000000000000000000')}),false);
 const c=(a as Extract<Surface3,{kind:'cylinder'}>).cylinder,scaled=(b as Extract<Surface3,{kind:'cylinder'}>).cylinder,p=point3(0n,0n,0n);
 assert.equal(evaluateCylinder3(scaled,p).compare(evaluateCylinder3(c,p).mul(Rational.parse('9/49'))),0);
});
test('near tangencies and non-unit irrational axis lengths need no tolerance or numerical normalization',()=>{
 const epsilon=Rational.parse('1/1'+'0'.repeat(30)),one=new Rational(1n),surface=cylinder();
 for(const [y,count] of [[one.sub(epsilon),2],[one,1],[one.add(epsilon),0]] as const){
  const line=line3(point3(0n,y,0n),vector3(1n,0n,0n)),result=check(line,surface,intersectLineSurface3(line,surface));assert.equal(result.kind==='points'?result.hits.length:0,count);
 }
 const oblique=cylinder(point3(0n,0n,0n),vector3(1n,1n,1n),1n),line=line3(point3(0n,0n,0n),vector3(1n,-1n,0n));
 const hits=check(line,oblique,intersectLineSurface3(line,oblique));assert.equal(hits.kind,'points');if(hits.kind==='points')assert.equal(hits.hits[1]!.parameter.compare(sqrt(2n).affine('1/2')),0);
});
test('surface and point construction snapshot caller data and reject degenerate supports',()=>{
 assert.throws(()=>line3(point3(0n,0n,0n),vector3(0n,0n,0n)),RangeError);
 for(const r of [0n,-1n])assert.throws(()=>cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),r),RangeError);
 const origin={...point3(1n,0n,0n)},direction={...vector3(0n,0n,1n)},axis={origin,direction},c=cylinder3(axis,1n),p=algebraicPoint3(origin,direction,sqrt(2n));
 origin.x=new Rational(99n);direction.z=new Rational(7n);
 assert.equal(c.axis.origin.x.compare(new Rational(1n)),0);assert.equal(p.x.compare(q(1n)),0);assert.equal(p.z.compare(sqrt(2n)),0);
 assert.ok(Object.isFrozen(c)&&Object.isFrozen(c.axis)&&Object.isFrozen(c.axis.origin)&&Object.isFrozen(c.axis.direction)&&Object.isFrozen(p));
});
