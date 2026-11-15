import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point3,line3,cylinder3,plane3,circle3,circularArc3,algebraicCoordinates3,algebraicPoint3,intersectCylinders3,prepareCylinderFace3,clipCylinderIntersectionToFaces3,clipCylinderIntersectionByHalfspaces3,pointOnCylinderIntersectionArc3,compareAlgebraicPoints3,classifyPointToSurface3} from '../dist/index.js';
import type {AlgebraicCoordinates3,BoundedCylinderIntersection3,PreparedCylinderFace3} from '../dist/index.js';
const O=point3(0n,0n),Z=point3(0n,0n,1n),X=point3(1n,0n,0n),A=cylinder3(line3(O,Z),1n),B=cylinder3(line3(O,X),1n);
function graph(){const g=intersectCylinders3(A,B);if(g.kind!=='bounded')throw new Error('Expected bounded SSI');return g;}
const same=(a:AlgebraicCoordinates3,b:AlgebraicCoordinates3)=>compareAlgebraicPoints3(a,b)===0;
const on=(p:AlgebraicCoordinates3,g:BoundedCylinderIntersection3)=>g.isolatedPoints.some(q=>same(p,q))||g.arcs.some(a=>pointOnCylinderIntersectionArc3(p,a));
function check(g:BoundedCylinderIntersection3,faces:readonly PreparedCylinderFace3[]){
 for(const p of [...g.vertices,...g.arcs.map(a=>a.sample)])for(const f of faces){assert.notEqual(f.locate(p),'outside');assert.equal(classifyPointToSurface3(p,{kind:'cylinder',cylinder:f.surface}),0);}
 assert.equal(g.edges.length,g.arcs.length);g.edges.forEach((e,i)=>{assert.ok(same(g.vertices[e.start]!,g.arcs[i]!.start));assert.ok(same(g.vertices[e.end]!,g.arcs[i]!.end));});assert.ok(Object.isFrozen(g)&&Object.isFrozen(g.arcs));
}
function rationalSamples(){const points:AlgebraicCoordinates3[]=[];for(let n=-12;n<=12;n++){const t=new Rational(BigInt(n),5n),den=new Rational(1n).add(t.mul(t)),x=new Rational(1n).sub(t.mul(t)).div(den),y=t.mul(new Rational(2n)).div(den);for(const sign of [-1n,1n])points.push(algebraicCoordinates3(x,y,x.mul(new Rational(sign))));}return points;}
test('finite cylinder face heights restrict SSI with exact independent rational samples',()=>{
 const a=prepareCylinderFace3(A,'-1/2','1/2'),b=prepareCylinderFace3(B,'-3/4','3/4'),r=clipCylinderIntersectionToFaces3(graph(),a,b);check(r,[a,b]);assert.ok(r.arcs.length>0);
 for(const p of rationalSamples())assert.equal(on(p,r),p.z.compare(AlgebraicReal.fromRational('-1/2'))>=0&&p.z.compare(AlgebraicReal.fromRational('1/2'))<=0&&p.x.compare(AlgebraicReal.fromRational('-3/4'))>=0&&p.x.compare(AlgebraicReal.fromRational('3/4'))<=0);
});
test('arbitrary algebraic angular endpoints cut both SSI sheets at boundary generators',()=>{
 const start=algebraicCoordinates3(AlgebraicReal.fromRational('1/3').sqrt(),AlgebraicReal.fromRational('2/3').sqrt()),angular=circularArc3(circle3(O,Z,1n),start,algebraicCoordinates3(-1n,0n)),a=prepareCylinderFace3(A,-2n,2n,{angular}),b=prepareCylinderFace3(B,-2n,2n),r=clipCylinderIntersectionToFaces3(graph(),a,b);check(r,[a,b]);assert.ok(r.arcs.length>0);assert.ok(r.vertices.some(p=>p.x.compare(start.x)===0&&p.y.compare(start.y)===0));
 for(const p of rationalSamples()){const cross=start.x.mul(p.y).sub(start.y.mul(p.x));assert.equal(on(p,r),p.y.sign()>=0&&cross.sign()>=0);}
 const backwards=circularArc3(circle3(O,point3(0n,0n,-3n),1n),angular.end,angular.start,{direction:'ccw'}),reversed=prepareCylinderFace3(A,-2n,2n,{angular:backwards,sense:-1}),again=clipCylinderIntersectionToFaces3(graph(),reversed,b);for(const p of rationalSamples())assert.equal(on(p,again),on(p,r));
});
test('two angular domains with only generator contacts retain isolated points',()=>{
 const a=prepareCylinderFace3(A,-2n,2n,{angular:circularArc3(circle3(O,Z,1n),algebraicCoordinates3(1n,0n),algebraicCoordinates3(-1n,0n))}),b=prepareCylinderFace3(B,-2n,2n,{angular:circularArc3(circle3(O,X,1n),algebraicCoordinates3(0n,0n,1n),algebraicCoordinates3(0n,-1n,0n))}),r=clipCylinderIntersectionToFaces3(graph(),a,b);check(r,[a,b]);assert.equal(r.arcs.length,0);assert.equal(r.isolatedPoints.length,2);for(const x of [-1n,1n])assert.ok(on(algebraicCoordinates3(x,0n,1n),r));
});
test('major angular arcs, seam crossings and patches on the second cylinder use their complete sets',()=>{
 const a=prepareCylinderFace3(A,-2n,2n,{angular:circularArc3(circle3(O,Z,1n),algebraicCoordinates3(0n,-1n),algebraicCoordinates3(-1n,0n))}),b=prepareCylinderFace3(B,-2n,2n,{angular:circularArc3(circle3(O,X,1n),algebraicCoordinates3(0n,1n,0n),algebraicCoordinates3(0n,0n,-1n))}),r=clipCylinderIntersectionToFaces3(graph(),a,b);check(r,[a,b]);
 for(const p of rationalSamples())assert.equal(on(p,r),(p.x.sign()>=0||p.y.sign()>=0)&&(p.y.sign()<=0||p.z.sign()>=0),JSON.stringify({p:[p.x.rational?.toString(),p.y.rational?.toString(),p.z.rational?.toString()],a:a.locate(p),b:b.locate(p)}));
 const swapped=clipCylinderIntersectionToFaces3(graph(),b,a);for(const p of rationalSamples())assert.equal(on(p,swapped),on(p,r));
});
test('shifted reversed axes and reconstructed domains ignore forged callbacks',()=>{
 const a=prepareCylinderFace3(A,-2n,2n),b=prepareCylinderFace3(cylinder3(line3(point3(3n,0n),point3(-2n,0n)),1n),1n,2n),r=clipCylinderIntersectionToFaces3(graph(),{...a,locate:()=>{throw new Error('Untrusted callback');}},b);check(r,[a,b]);for(const p of rationalSamples())assert.equal(on(p,r),true);
 assert.throws(()=>clipCylinderIntersectionToFaces3(graph(),a,a),RangeError);assert.throws(()=>clipCylinderIntersectionToFaces3({...graph()},a,b),RangeError);assert.throws(()=>clipCylinderIntersectionToFaces3(graph(),{...a,lower:a.upper},b),RangeError);
});
test('clipping an existing subset never introduces omitted arcs or angular contact points',()=>{
 const g=clipCylinderIntersectionByHalfspaces3(graph(),[{plane:plane3(1n,0n,0n,'-1/2'),side:1}]),a=prepareCylinderFace3(A,-2n,2n,{angular:circularArc3(circle3(O,Z,1n),algebraicCoordinates3(0n,1n),algebraicCoordinates3(-1n,0n))}),b=prepareCylinderFace3(B,-2n,2n),r=clipCylinderIntersectionToFaces3(g,a,b);assert.equal(r.vertices.length,0);
 const empty=clipCylinderIntersectionByHalfspaces3(g,[{plane:plane3(1n,0n,0n,-2n),side:1}]),again=clipCylinderIntersectionToFaces3(empty,a,b);assert.equal(again.vertices.length,0);
});
test('rational rigid frame changes preserve angular trimming with translated tilted axes',()=>{
 const rows=[[1n,2n,2n],[2n,1n,-2n],[-2n,2n,-1n]],axes=['x','y','z'] as const,shift=point3(3n,-2n,5n),rotate=(p:ReturnType<typeof point3>)=>point3(...rows.map(row=>row.reduce((s,c,i)=>s.add(p[axes[i]!].mul(new Rational(c,3n))),new Rational(0n))) as Parameters<typeof point3>),move=(p:ReturnType<typeof point3>)=>{const r=rotate(p);return point3(r.x.add(shift.x),r.y.add(shift.y),r.z.add(shift.z));},a=cylinder3(line3(shift,rotate(Z)),1n),b=cylinder3(line3(shift,rotate(X)),1n),support=intersectCylinders3(a,b);assert.equal(support.kind,'bounded');if(support.kind!=='bounded')return;
 const angular=circularArc3(circle3(shift,rotate(Z),1n),algebraicCoordinates3(...Object.values(move(point3(0n,-1n))) as [Rational,Rational,Rational]),algebraicCoordinates3(...Object.values(move(point3(-1n,0n))) as [Rational,Rational,Rational])),fa=prepareCylinderFace3(a,-2n,2n,{angular}),fb=prepareCylinderFace3(b,-2n,2n),r=clipCylinderIntersectionToFaces3(support,fa,fb);check(r,[fa,fb]);
 for(const p of rationalSamples()){const q=move(point3(p.x.rational!,p.y.rational!,p.z.rational!));assert.equal(on(algebraicCoordinates3(q.x,q.y,q.z),r),p.x.sign()>=0||p.y.sign()>=0);}
});
test('angular generators with zero or no real intersection retain only true isolated contacts',()=>{
 const a=cylinder3(line3(O,Z),4n),g=intersectCylinders3(a,B);if(g.kind!=='bounded')throw new Error('Expected bounded SSI');const sqrt3=AlgebraicReal.fromRational(3n).sqrt(),C=circle3(O,Z,4n),b=prepareCylinderFace3(B,-3n,3n),tangent=prepareCylinderFace3(a,-3n,3n,{angular:circularArc3(C,algebraicCoordinates3(sqrt3,1n),algebraicCoordinates3(sqrt3.neg(),1n))}),r=clipCylinderIntersectionToFaces3(g,tangent,b);check(r,[tangent,b]);assert.equal(r.arcs.length,0);assert.equal(r.isolatedPoints.length,2);assert.equal(r.supportSingularVertices.length,0);
 const disjoint=prepareCylinderFace3(a,-3n,3n,{angular:circularArc3(C,algebraicCoordinates3(1n,sqrt3),algebraicCoordinates3(-1n,sqrt3))}),empty=clipCylinderIntersectionToFaces3(g,disjoint,b);assert.equal(empty.vertices.length,0);
});
test('nonorthogonal axes agree with the independent z=x±sqrt(2)*x locus',()=>{
 const b=cylinder3(line3(O,point3(1n,0n,1n)),1n),g=intersectCylinders3(A,b);if(g.kind!=='bounded')throw new Error('Expected bounded SSI');const aFace=prepareCylinderFace3(A,-1n,1n,{angular:circularArc3(circle3(O,Z,1n),algebraicCoordinates3(1n,0n),algebraicCoordinates3(-1n,0n))}),bFace=prepareCylinderFace3(b,'-1/2','1/2'),r=clipCylinderIntersectionToFaces3(g,aFace,bFace),sqrt2=AlgebraicReal.fromRational(2n).sqrt();check(r,[aFace,bFace]);
 for(const sample of rationalSamples().filter((_,i)=>i%2===0)){const x=sample.x.rational!,y=sample.y.rational!;for(const sign of [-1n,1n]){const p=algebraicPoint3(point3(x,y,x),Z,sqrt2.affine(x.mul(new Rational(sign)))),height=p.x.add(p.z).affine('1/2'),expected=y.sign()>=0&&p.z.compare(AlgebraicReal.fromRational(-1n))>=0&&p.z.compare(AlgebraicReal.fromRational(1n))<=0&&height.compare(AlgebraicReal.fromRational('-1/2'))>=0&&height.compare(AlgebraicReal.fromRational('1/2'))<=0;assert.equal(on(p,r),expected);}}
});
