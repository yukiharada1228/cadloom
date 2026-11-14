import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point2,point3,vector3,plane3,planeFrame3,circle3,ellipse3,prepareEllipseFace3,prepareRectangleFace3,prepareCircularFace3,preparePlanarFace3,prepareTrimmedPlanar3,splitTrimmedPlanarByPlane3,segment2,curveEndpoints3,compareAlgebraicPoints3,translatePlanarFace3} from '../dist/index.js';
import type {PreparedTrimmedPlanar3,PlanarHalfSpace3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=vector3(1n,0n,0n),Y=vector3(0n,1n,0n),Z=vector3(0n,0n,1n),xy=planeFrame3(O,X,Y),h=(a:bigint,b:bigint,c:bigint|string=0n):PlanarHalfSpace3=>({plane:plane3(a,b,0n,c),side:-1});
function loops(r:PreparedTrimmedPlanar3){for(const c of r.components){assert.equal(c.locate(c.sample),'inside');assert.notEqual(c.loops,null);for(const loop of c.loops!){for(let i=0;i<loop.length;i++){const a=loop[i]!,b=loop[(i+1)%loop.length]!,A=curveEndpoints3(r.edges[a.edge]!),B=curveEndpoints3(r.edges[b.edge]!);assert.equal(compareAlgebraicPoints3(A[a.direction===1?1:0],B[b.direction===1?0:1]),0);}}}}
function grid(r:PreparedTrimmedPlanar3,oracle:(x:Rational,y:Rational)=>boolean){for(let i=-5n;i<=5n;i++)for(let j=-5n;j<=5n;j++){const x=new Rational(i,2n),y=new Rational(j,2n),p=point3(x,y,0n),expected=oracle(x,y),position=r.locate(p);assert.equal(position!=='outside',expected);if(position==='inside')assert.equal(r.components.filter(c=>c.locate(p)==='inside').length,1);if(position==='boundary')assert.ok(r.components.some(c=>c.locate(p)==='boundary'));}}
test('ellipse disk faces translate and planar rectangle trims split with shared edges',()=>{
 const e=ellipse3(xy,4n,1n),face=prepareEllipseFace3(e);assert.equal(face.locate(point3(0n,0n,0n)),'inside');assert.equal(face.locate(point3(2n,0n,0n)),'boundary');assert.equal(face.locate(point3(0n,2n,0n)),'outside');assert.equal(translatePlanarFace3(face,vector3(1n,2n,3n)).locate(point3(1n,2n,3n)),'inside');
 const rect=prepareTrimmedPlanar3(prepareRectangleFace3(xy,-2n,2n,-1n,1n)),split=splitTrimmedPlanarByPlane3(rect,plane3(1n,0n,0n));assert.equal(split.kind,'split');if(split.kind!=='split')return;loops(split.negative);loops(split.positive);assert.equal(split.sharedEdges.length,1);assert.ok(split.topology);assert.equal(split.topology.manifoldVertices,true);for(const edge of split.sharedEdges)assert.equal(split.negativeUses.find(u=>u.edge===edge)!.direction,-split.positiveUses.find(u=>u.edge===edge)!.direction);
 grid(split.negative,(x,y)=>x.compare(new Rational(-2n))>=0&&x.sign()<=0&&y.compare(new Rational(-1n))>=0&&y.compare(new Rational(1n))<=0);
});
test('elliptic and circular disks support exact repeated halfspace trimming',()=>{
 const face=prepareEllipseFace3(ellipse3(xy,4n,1n)),r=prepareTrimmedPlanar3(face,[h(1n,0n,-1n),h(0n,-1n)]);assert.equal(r.components.length,1);loops(r);grid(r,(x,y)=>x.mul(x).add(y.mul(y).mul(new Rational(4n))).compare(new Rational(4n))<=0&&x.compare(new Rational(1n))<=0&&y.sign()>=0);
 const split=splitTrimmedPlanarByPlane3(r,plane3(1n,1n,0n));assert.equal(split.kind,'split');if(split.kind==='split'){loops(split.negative);loops(split.positive);assert.ok(split.sharedEdges.length);}
});
test('a circular annulus clipped to a narrow strip yields two connected components',()=>{
 const face=prepareCircularFace3(circle3(O,Z,4n),[circle3(O,Z,1n)]),r=prepareTrimmedPlanar3(face,[h(1n,0n,'-1/2'),h(-1n,0n,'-1/2')]);assert.equal(r.components.length,2);loops(r);grid(r,(x,y)=>{const s=x.mul(x).add(y.mul(y));return s.compare(new Rational(1n))>=0&&s.compare(new Rational(4n))<=0&&x.compare(new Rational(-1n,2n))>=0&&x.compare(new Rational(1n,2n))<=0;});
});
test('holes stay with the correct connected component across vertical critical columns',()=>{
 const face=prepareCircularFace3(circle3(O,Z,9n),[circle3(point3(-1n,0n,0n),Z,'1/4'),circle3(point3(1n,0n,0n),Z,'1/4')]),r=prepareTrimmedPlanar3(face);assert.equal(r.components.length,1);loops(r);assert.equal(r.components[0]!.loops!.length,3);assert.equal(r.locate(point3(-1n,0n,0n)),'outside');assert.equal(r.locate(point3(0n,0n,0n)),'inside');
});
test('concave chart faces separate into components after a plane cut',()=>{
 const points=[point2(-2n,-2n),point2(2n,-2n),point2(2n,2n),point2(1n,2n),point2(1n,-1n),point2(-1n,-1n),point2(-1n,2n),point2(-2n,2n)],ring=points.map((p,i)=>({kind:'segment' as const,segment:segment2(p,points[(i+1)%points.length]!)})),face=preparePlanarFace3(xy,[ring]),r=prepareTrimmedPlanar3(face,[h(0n,-1n)]);assert.equal(r.components.length,2);loops(r);assert.notEqual(r.locate(point3('-3/2',1n,0n)),'outside');assert.notEqual(r.locate(point3('3/2',1n,0n)),'outside');assert.equal(r.locate(point3(0n,1n,0n)),'outside');
});
test('tangent-only and line-only material regularize to empty while redundant constraints preserve disks',()=>{
 const disk=prepareCircularFace3(circle3(O,Z,1n));for(const constraints of [[h(-1n,0n,1n)],[h(1n,0n),h(-1n,0n)]]){const r=prepareTrimmedPlanar3(disk,constraints);assert.equal(r.empty,true);assert.equal(r.edges.length,0);}
 const r=prepareTrimmedPlanar3(disk,[h(1n,0n,-1n)]);assert.equal(r.components.length,1);loops(r);assert.equal(r.locate(point3(0n,0n,0n)),'inside');assert.equal(r.locate(point3(1n,0n,0n)),'boundary');
});
test('coplanar and parallel plane cuts have explicit material semantics',()=>{
 const r=prepareTrimmedPlanar3(prepareRectangleFace3(xy,-1n,1n,-1n,1n));assert.equal(splitTrimmedPlanarByPlane3(r,plane3(0n,0n,1n)).kind,'coplanar');const below=splitTrimmedPlanarByPlane3(r,plane3(0n,0n,1n,-1n));assert.equal(below.kind,'split');if(below.kind==='split'){assert.equal(below.positive.empty,true);assert.equal(below.negative.components.length,1);assert.equal(below.sharedEdges.length,0);}assert.throws(()=>splitTrimmedPlanarByPlane3({...r},plane3(1n,0n,0n)),RangeError);
});
test('algebraic rectangle bounds and thin rational caps retain exact material',()=>{
 const a=AlgebraicReal.fromRational(2n).sqrt(),b=AlgebraicReal.fromRational(3n).sqrt(),face=prepareRectangleFace3(xy,a.neg(),a,b.neg(),b),r=prepareTrimmedPlanar3(face,[h(1n,-1n)]);assert.equal(r.components.length,1);loops(r);grid(r,(x,y)=>x.mul(x).compare(new Rational(2n))<=0&&y.mul(y).compare(new Rational(3n))<=0&&x.compare(y)<=0);
 const epsilon=new Rational(1n,10n**30n),disk=prepareCircularFace3(circle3(O,Z,1n)),cap=prepareTrimmedPlanar3(disk,[h(-1n,0n,new Rational(1n).sub(epsilon).toString())]);assert.equal(cap.components.length,1);loops(cap);assert.equal(cap.locate(point3(new Rational(1n).sub(epsilon.div(new Rational(2n))),0n,0n)),'inside');
 const empty=prepareTrimmedPlanar3(disk,[h(1n,0n),h(-1n,0n,epsilon.toString())]);assert.equal(empty.empty,true);
});
test('oblique ellipse charts preserve independent quadratic inequalities and reversed physical sense',()=>{
 const o=point3(1n,2n,3n),u=vector3(1n,0n,1n),v=vector3(1n,2n,0n),f=planeFrame3(o,u,v),e=ellipse3(f,4n,1n),face=prepareEllipseFace3(e,-1);
 // cut evaluates to local x-1/2: dual(u)=(4,-2,5)/9.
 const n=vector3('4/9','-2/9','5/9'),p=plane3(n.x,n.y,n.z,n.x.mul(o.x).add(n.y.mul(o.y)).add(n.z.mul(o.z)).neg().sub(new Rational(1n,2n))),r=prepareTrimmedPlanar3(face,[{plane:p,side:-1}]);assert.equal(r.components.length,1);loops(r);
 for(let i=-4n;i<=4n;i++)for(let j=-2n;j<=2n;j++){const x=new Rational(i,2n),y=new Rational(j,2n),point=point3(o.x.add(u.x.mul(x)).add(v.x.mul(y)),o.y.add(u.y.mul(x)).add(v.y.mul(y)),o.z.add(u.z.mul(x)).add(v.z.mul(y))),expected=x.mul(x).add(y.mul(y).mul(new Rational(4n))).compare(new Rational(4n))<=0&&x.compare(new Rational(1n,2n))<=0;assert.equal(r.locate(point)!=='outside',expected);}
 const split=splitTrimmedPlanarByPlane3(r,plane3(0n,1n,0n,-2n));assert.equal(split.kind,'split');if(split.kind==='split'){assert.ok(split.sharedEdges.length);assert.ok(split.topology);assert.equal(split.topology.manifoldVertices,true);}
});
test('cut order, normal rescaling, metadata round trips and immutable ownership are stable',()=>{
 const face=prepareCircularFace3(circle3(O,Z,4n)),constraints=[h(1n,0n),h(0n,-1n)],a=prepareTrimmedPlanar3(face,constraints),b=prepareTrimmedPlanar3(face,[{plane:plane3(0n,3n,0n),side:1},{plane:plane3(-7n,0n,0n),side:1}]);loops(a);loops(b);grid(a,(x,y)=>x.sign()<=0&&y.sign()>=0&&x.mul(x).add(y.mul(y)).compare(new Rational(4n))<=0);for(const p of [point3(-1n,1n,0n),point3(0n,0n,0n),point3(1n,0n,0n)])assert.equal(a.locate(p),b.locate(p));
 const rejected=prepareTrimmedPlanar3(face,[{plane:plane3(0n,0n,1n,1n),side:-1}]);assert.equal(rejected.empty,true);assert.equal(prepareTrimmedPlanar3(rejected.base,rejected.halfspaces).empty,true);const split=splitTrimmedPlanarByPlane3(rejected,plane3(1n,0n,0n));assert.equal(split.kind,'split');if(split.kind==='split'){assert.equal(split.negative.empty,true);assert.equal(split.positive.empty,true);}
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.edges)&&Object.isFrozen(a.components)&&Object.isFrozen(a.halfspaces));assert.throws(()=>prepareTrimmedPlanar3({...face}),RangeError);
});
test('arbitrary-normal circular annuli retain exact planar membership and connected holes',()=>{
 const n=vector3(1n,1n,1n),face=prepareCircularFace3(circle3(O,n,6n),[circle3(O,n,'1/2')]),r=prepareTrimmedPlanar3(face,[{plane:plane3(1n,0n,0n),side:-1}]);assert.equal(r.components.length,1);loops(r);
 for(let i=-3n;i<=3n;i++)for(let j=-2n;j<=2n;j++){const x=new Rational(i,2n),y=new Rational(j,2n),point=point3(y.mul(new Rational(-2n)),x.add(y),y.sub(x)),s=x.mul(x).mul(new Rational(2n)).add(y.mul(y).mul(new Rational(6n))),expected=s.compare(new Rational(1n,2n))>=0&&s.compare(new Rational(6n))<=0&&y.sign()>=0;assert.equal(r.locate(point)!=='outside',expected);}
});
test('component closures that touch at hole tangencies remain separate and generate no false shared edge',()=>{
 const face=prepareCircularFace3(circle3(O,Z,4n),[circle3(O,Z,1n)]),region=prepareTrimmedPlanar3(face,[h(1n,0n,-1n),h(-1n,0n,-1n)]);assert.equal(region.components.length,2);loops(region);for(const x of [-1n,1n])assert.equal(region.components.filter(c=>c.locate(point3(x,0n,0n))==='boundary').length,2);
 const split=splitTrimmedPlanarByPlane3(region,plane3(0n,1n,0n));assert.equal(split.kind,'split');if(split.kind==='split'){assert.equal(split.sharedEdges.length,0);assert.equal(split.negative.components.length,1);assert.equal(split.positive.components.length,1);assert.ok(split.topology);assert.equal(split.topology.manifoldVertices,false);assert.ok(split.topology.issues.some(i=>i.kind==='nonmanifold-vertex'));}
});
