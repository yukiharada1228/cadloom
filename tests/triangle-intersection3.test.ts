import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,triangle3,intersectTriangles3,inspectTriangleEmbedding,pointOnTriangle3,
 point2,extrudePolygon,buildTriangleTopology,Rational} from '../dist/index.js';
import type {Point3,Triangle3,TriangleMesh3,TriangleTriangleIntersection} from '../dist/index.js';
const p=(x:bigint,y:bigint,z=0n)=>point3(x,y,z);
const grid=Array.from({length:9},(_,i)=>[BigInt(i%3),BigInt(Math.floor(i/3))] as const);
type RawPoint=readonly [bigint,bigint];
type Line=readonly [bigint,bigint,bigint];
type Homogeneous=readonly [bigint,bigint,bigint];
const rawTriangles:RawPoint[][]=[];
for(let i=0;i<9;i++)for(let j=i+1;j<9;j++)for(let k=j+1;k<9;k++){
 const a=grid[i]!,b=grid[j]!,c=grid[k]!;
 if((b[0]-a[0])*(c[1]-a[1])!==(b[1]-a[1])*(c[0]-a[0]))rawTriangles.push([a,b,c]);
}
function constraints(t:RawPoint[]):Line[]{
 const [a,b,c]=t as [RawPoint,RawPoint,RawPoint];
 const winding=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])>0n?1n:-1n;
 return t.map((a,i)=>{
  const b=t[(i+1)%3]!,dx=b[0]-a[0],dy=b[1]-a[1];
  return [-dy*winding,dx*winding,(dy*a[0]-dx*a[1])*winding] as const;
 });
}
const compare=(a:Homogeneous,b:Homogeneous)=>{
 const x=a[0]*b[2]-b[0]*a[2],y=a[1]*b[2]-b[1]*a[2];
 return x<0n?-1:x>0n?1:y<0n?-1:y>0n?1:0;
};
// Independent H-representation oracle: enumerate feasible intersections of six
// integer constraint lines with Cramer's rule, using homogeneous BigInts only.
function oracle(a:RawPoint[],b:RawPoint[]):Homogeneous[]{
 const lines=[...constraints(a),...constraints(b)],points:Homogeneous[]=[];
 for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){
  const [a,b,c]=lines[i]!,[d,e,f]=lines[j]!;
  let w=a*e-d*b,x=b*f-e*c,y=c*d-f*a;if(w===0n)continue;
  if(w<0n){w=-w;x=-x;y=-y;}
  const q=[x,y,w] as const;
  if(lines.every(([a,b,c])=>a*x+b*y+c*w>=0n)&&!points.some(p=>compare(p,q)===0))points.push(q);
 }
 return points.sort(compare);
}
function equal(q:Point3,p:Homogeneous){
 return q.z.sign()===0&&q.x.numerator*p[2]===p[0]*q.x.denominator&&q.y.numerator*p[2]===p[1]*q.y.denominator;
}
function crossHomogeneous(a:Homogeneous,b:Homogeneous,c:Homogeneous){
 return a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);
}
function checkOracle(result:TriangleTriangleIntersection,points:Homogeneous[]){
 const expected=points.length===0?'none':points.length===1?'point':points.every(p=>crossHomogeneous(points[0]!,points[1]!,p)===0n)?'segment':'polygon';
 assert.equal(result.kind,expected);
 if(result.kind==='point')assert.ok(equal(result.point,points[0]!));
 if(result.kind==='segment'){assert.ok(equal(result.segment.start,points[0]!));assert.ok(equal(result.segment.end,points[points.length-1]!));}
 if(result.kind==='polygon'){
  assert.equal(result.polygon.length,points.length);
  assert.ok(result.polygon.every(q=>points.some(p=>equal(q,p))));
  assert.ok(Object.isFrozen(result.polygon)&&result.polygon.every(Object.isFrozen));
 }
}
test('5,776 coplanar pairs match independent homogeneous halfplane oracle, including contacts',()=>{
 assert.equal(rawTriangles.length,76);
 for(const a of rawTriangles)for(const b of rawTriangles){
  const first=triangle3(...a.map(q=>p(...q)) as [Point3,Point3,Point3]);
  const second=triangle3(...b.map(q=>p(...q)) as [Point3,Point3,Point3]);
  checkOracle(intersectTriangles3(first,second),oracle(a,b));
 }
});
type Fraction=readonly [bigint,bigint];
const fractionCompare=(a:Fraction,b:Fraction)=>a[0]*b[1]-b[0]*a[1];
// Restrict integer halfplanes to y=1; derive independent one-dimensional bounds.
function interval(t:RawPoint[]):readonly [Fraction,Fraction]|null{
 let low:Fraction|null=null,high:Fraction|null=null;
 for(const [a,b,c] of constraints(t)){
  const k=b+c;
  if(a===0n){if(k<0n)return null;continue;}
  const q:Fraction=a>0n?[-k,a]:[k,-a];
  if(a>0n){if(!low||fractionCompare(q,low)>0n)low=q;}
  else if(!high||fractionCompare(q,high)<0n)high=q;
 }
 if(!low||!high)throw Error('Unbounded triangle oracle');
 return fractionCompare(low,high)>0n?null:[low,high];
}
test('5,776 transverse pairs match independent interval constraints on their plane intersection',()=>{
 for(const a of rawTriangles)for(const b of rawTriangles){
  const first=triangle3(...a.map(([x,y])=>point3(x,y,0n)) as [Point3,Point3,Point3]);
  const second=triangle3(...b.map(([x,z])=>point3(x,1n,z-1n)) as [Point3,Point3,Point3]);
  const result=intersectTriangles3(first,second),ia=interval(a),ib=interval(b);
  let lo:Fraction|undefined,hi:Fraction|undefined;
  if(ia&&ib){lo=fractionCompare(ia[0],ib[0])>=0n?ia[0]:ib[0];hi=fractionCompare(ia[1],ib[1])<=0n?ia[1]:ib[1];}
  const expected=!lo||!hi||fractionCompare(lo,hi)>0n?'none':fractionCompare(lo,hi)===0n?'point':'segment';
  assert.equal(result.kind,expected);
  const matches=(p:Point3,f:Fraction)=>p.y.equals(new Rational(1n))&&p.z.sign()===0&&p.x.numerator*f[1]===f[0]*p.x.denominator;
  if(result.kind==='point')assert.ok(matches(result.point,lo!));
  if(result.kind==='segment'){assert.ok(matches(result.segment.start,lo!));assert.ok(matches(result.segment.end,hi!));}
 }
});
const permutations=(t:Triangle3):Triangle3[]=>[
 triangle3(t[0],t[1],t[2]),triangle3(t[1],t[2],t[0]),triangle3(t[2],t[0],t[1]),
 triangle3(t[0],t[2],t[1]),triangle3(t[2],t[1],t[0]),triangle3(t[1],t[0],t[2]),
];
test('canonical hexagon overlap is invariant under argument/winding changes and all projection axes',()=>{
 const aa=[[-2n,-1n],[2n,-1n],[0n,2n]] as const,bb=[[-2n,1n],[2n,1n],[0n,-2n]] as const;
 const huge=Rational.parse('90071992547409931234567890123456789');
 const tiny=Rational.parse('1/1000000000000000000000000000000');
 for(let rotation=0;rotation<3;rotation++){
  const embed=(u:Rational,v:Rational)=>{
   const x=huge.add(u.mul(tiny)),y=v,z=u.div(new Rational(3n)).add(v.div(new Rational(7n)));
   return rotation===0?point3(x,y,z):rotation===1?point3(z,x,y):point3(y,z,x);
  };
  const map=([u,v]:RawPoint)=>embed(new Rational(u),new Rational(v));
  const expectedPoints=oracle([...aa],[...bb]).map(([x,y,w])=>embed(new Rational(x,w),new Rational(y,w)));
  const a=triangle3(...aa.map(map) as [Point3,Point3,Point3]),b=triangle3(...bb.map(map) as [Point3,Point3,Point3]);
  const baseline=intersectTriangles3(a,b);assert.equal(baseline.kind,'polygon');
  if(baseline.kind==='polygon'){
   assert.equal(baseline.polygon.length,6);
   assert.ok(expectedPoints.every(p=>baseline.polygon.some(q=>p.x.equals(q.x)&&p.y.equals(q.y)&&p.z.equals(q.z))));
   assert.ok(baseline.polygon.every(q=>pointOnTriangle3(q,a)&&pointOnTriangle3(q,b)));
  }
  for(const u of permutations(a))for(const v of permutations(b)){
   assert.deepEqual(intersectTriangles3(u,v),baseline);assert.deepEqual(intersectTriangles3(v,u),baseline);
  }
 }
 const a=triangle3(p(0n,0n),p(1n,0n),p(0n,1n));
 const separate=triangle3(p(0n,0n,1n),p(1n,0n,1n),p(0n,1n,1n));
 assert.equal(intersectTriangles3(a,separate).kind,'none');
 const underflow=Rational.parse('1/1'+'0'.repeat(400));
 const nearA=triangle3(p(-2n,-1n),p(2n,-1n),p(0n,2n));
 const nearB=triangle3(point3(-2n,-1n,underflow.mul(new Rational(-2n))),point3(2n,-1n,underflow.mul(new Rational(2n))),p(0n,2n));
 const nearHit=intersectTriangles3(nearA,nearB);
 assert.equal(nearHit.kind,'segment');
 if(nearHit.kind==='segment'){assert.deepEqual(nearHit.segment.start,p(0n,-1n));assert.deepEqual(nearHit.segment.end,p(0n,2n));}
 assert.equal(intersectTriangles3(a,triangle3(point3(0n,0n,underflow),point3(1n,0n,underflow),point3(0n,1n,underflow))).kind,'none');
 assert.throws(()=>intersectTriangles3([p(0n,0n),p(0n,0n),p(1n,0n)],a),RangeError);
});
const facesOf=(m:TriangleMesh3)=>m.triangles.map(t=>triangle3(m.vertices[t[0]]!,m.vertices[t[1]]!,m.vertices[t[2]]!));
const box=(s:bigint)=>[point2(0n,0n),point2(s,0n),point2(s,s),point2(0n,s)];
test('embedding inspection distinguishes manifold incidence from crossing or nested shells',()=>{
 const a=facesOf(extrudePolygon([box(1n)],1n));
 assert.ok(inspectTriangleEmbedding(a).embedded);
 assert.ok(inspectTriangleEmbedding(a.map(t=>triangle3(t[0],t[2],t[1]))).embedded);
 const shift=new Rational(1n,2n);
 const b=a.map(t=>triangle3(...t.map(p=>point3(p.x.add(shift),p.y.add(shift),p.z.add(shift))) as [Point3,Point3,Point3]));
 assert.ok(buildTriangleTopology([...a,...b]).closedManifold);
 const crossing=inspectTriangleEmbedding([...a,...b]);assert.equal(crossing.embedded,false);
 assert.ok(crossing.issues.length>0&&crossing.issues.every(i=>i.first<a.length&&i.second>=a.length));
 const outer=facesOf(extrudePolygon([box(4n)],4n));
 const inner=facesOf(extrudePolygon([[point2(1n,1n),point2(2n,1n),point2(2n,2n),point2(1n,2n)]],1n,{baseZ:1n}));
 assert.ok(inspectTriangleEmbedding([...outer,...inner]).embedded); // Nesting/material classification is separate.
 assert.ok(Object.isFrozen(crossing)&&Object.isFrozen(crossing.issues));
});
test('embedding rejects nonconforming contact and duplicates, permits shared simplices',()=>{
 const a=p(0n,0n),b=p(2n,0n),c=p(0n,2n),d=p(1n,-1n),m=p(1n,0n);
 const first=triangle3(a,b,c);
 assert.ok(inspectTriangleEmbedding([first,triangle3(b,a,p(0n,0n,1n)),triangle3(b,a,d)]).embedded);
 assert.equal(inspectTriangleEmbedding([first,triangle3(a,d,m),triangle3(m,d,b)]).embedded,false);
 assert.equal(inspectTriangleEmbedding([first,triangle3(a,c,b)]).issues[0]!.kind,'duplicate-face');
 const folded=inspectTriangleEmbedding([first,triangle3(b,a,p(1n,1n))]);
 assert.equal(folded.embedded,false);assert.equal(folded.issues[0]!.intersection.kind,'polygon');
 const touch=triangle3(point3('1/2','1/2',0n),point3('1/2','1/2',1n),point3('3/2','1/2',1n));
 const report=inspectTriangleEmbedding([first,touch]);assert.equal(report.embedded,false);
 assert.equal(report.issues[0]!.intersection.kind,'point');
 assert.ok(inspectTriangleEmbedding([]).embedded);
});
