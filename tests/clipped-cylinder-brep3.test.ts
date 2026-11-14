import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point3,vector3,line3,cylinder3,plane3,clipCylinderBRep3,classifyPointToSurface3,dot3} from '../dist/index.js';
import type {ClippedCylinderBRep3,CylinderHalfSpace3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=vector3(0n,0n,1n),cylinder=cylinder3(line3(O,Z),1n),h=(x:bigint,y:bigint,z:bigint,k:bigint|string=0n):CylinderHalfSpace3=>({plane:plane3(x,y,z,k),side:-1});
function closed(r:ClippedCylinderBRep3){assert.equal(r.empty,false);assert.ok(r.interiorSample);assert.equal(r.locate(r.interiorSample),'inside');assert.equal(r.topology.closedOrientedIncidence,true);assert.equal(r.topology.issues.length,0);assert.equal(r.topology.shells.length,1);assert.equal(r.topology.vertices.length-r.topology.edges.length+r.topology.faces.length,2);assert.equal(r.faces.length,r.topology.faces.length);for(const edge of r.topology.edges)assert.equal(edge.coedges.length,2);for(const f of r.faces){assert.equal(r.locate(f.domain.components[f.component]!.sample),'boundary');if(f.kind==='planar')assert.ok(dot3(f.domain.base.normal,f.plane.normal).sign()>0);}assert.ok(classifyPointToSurface3(r.interiorSample,{kind:'cylinder',cylinder:r.cylinder})<0);for(const p of r.planes)assert.ok(dot3(p.normal,r.interiorSample).add(p.offset).sign()<0);}
function grid(r:ClippedCylinderBRep3,lo:bigint,hi:bigint,constraints:readonly CylinderHalfSpace3[]=[]){for(let x=-3n;x<=3n;x++)for(let y=-3n;y<=3n;y++)for(let z=lo-1n;z<=hi+1n;z++){const p=point3(new Rational(x,2n),new Rational(y,2n),z),radial=x*x+y*y<=4n,height=z>=lo&&z<=hi,inside=radial&&height&&constraints.every(c=>dot3(c.plane.normal,p).add(c.plane.offset).sign()*c.side>=0);assert.equal(r.locate(p)!=='outside',inside);}}
test('filled finite cylinder constructs one spherical analytic BRep with exact solid queries',()=>{
 const r=clipCylinderBRep3(cylinder,-1n,2n);closed(r);assert.equal(r.faces.length,6);assert.equal(r.faces.filter(f=>f.kind==='cylindrical').length,4);grid(r,-1n,2n);assert.equal(r.locate(point3(1n,0n,0n)),'boundary');assert.equal(r.locate(point3(0n,0n,0n)),'inside');assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.faces)&&Object.isFrozen(r.planes));
});
test('oblique and intersecting caps retain ellipses, shared edges and independent inequality membership',()=>{
 for(const constraints of [[h(1n,0n,1n)],[h(-1n,0n,1n),h(-1n,0n,-1n)]]){const r=clipCylinderBRep3(cylinder,-2n,2n,constraints);closed(r);grid(r,-2n,2n,constraints);assert.ok(r.topology.edges.some(e=>e.curve.kind==='elliptic-arc'));}
});
test('parallel cuts retain algebraic strip caps and sew both disconnected wall portions',()=>{
 const constraints=[h(1n,0n,0n,'-1/2'),h(-1n,0n,0n,'-1/2')],r=clipCylinderBRep3(cylinder,-1n,1n,constraints);closed(r);grid(r,-1n,1n,constraints);assert.equal(r.faces.filter(f=>f.kind==='planar').length,4);assert.ok(r.topology.vertices.some(p=>p.y.rational===null));
 const equivalent=clipCylinderBRep3(cylinder,-1n,1n,[{plane:plane3(-3n,0n,0n,'3/2'),side:1},{plane:plane3(7n,0n,0n,'-7/2'),side:-1},constraints[1]!]);closed(equivalent);assert.equal(equivalent.faces.length,r.faces.length);assert.equal(equivalent.planes.length,r.planes.length);
 const diagonal=clipCylinderBRep3(cylinder,-1n,1n,[h(1n,1n,0n,'-11/10'),h(-1n,-1n,0n,'101/100')]);closed(diagonal);const walls=diagonal.faces.filter(f=>f.kind==='cylindrical');assert.equal(walls.length,2);assert.equal(walls[0]!.domain,walls[1]!.domain);assert.notEqual(walls[0]!.component,walls[1]!.component);assert.equal(diagonal.locate(point3('21/40','21/40',0n)),'inside');assert.equal(diagonal.locate(point3('1/2','1/2',0n)),'outside');
});
test('tangent cap contacts are resolved by nonperiodic wall charts instead of rejecting a convex solid',()=>{
 const constraints=[h(1n,0n,1n,-1n),h(1n,0n,-1n,-1n)],r=clipCylinderBRep3(cylinder,-2n,2n,constraints);closed(r);grid(r,-2n,2n,constraints);assert.equal(r.locate(point3(1n,0n,0n)),'boundary');assert.equal(r.locate(point3(1n,0n,'1/2')),'outside');
});
test('a polyhedron strictly inside the cylinder is built even when no cylinder wall survives',()=>{
 const constraints=[h(1n,0n,0n,'-1/4'),h(-1n,0n,0n,'-1/4'),h(0n,1n,0n,'-1/4'),h(0n,-1n,0n,'-1/4'),h(0n,0n,1n,'-1/4'),h(0n,0n,-1n,'-1/4')],r=clipCylinderBRep3(cylinder,-1n,1n,constraints);closed(r);assert.equal(r.faces.length,6);assert.ok(r.faces.every(f=>f.kind==='planar'));assert.equal(r.locate(O),'inside');assert.equal(r.locate(point3('1/4','1/4','1/4')),'boundary');assert.equal(r.locate(point3('1/3',0n,0n)),'outside');
});
test('empty, tangent-only and lower-dimensional material has no false solid boundary',()=>{
 for(const constraints of [[h(-1n,0n,0n,2n)],[h(-1n,0n,0n,1n)],[h(0n,0n,1n),h(0n,0n,-1n)],[h(1n,0n,0n),h(0n,0n,-1n),h(-1n,0n,1n)]]){const r=clipCylinderBRep3(cylinder,-1n,1n,constraints);assert.equal(r.empty,true);assert.equal(r.faces.length,0);assert.equal(r.topology.shells.length,0);assert.equal(r.interiorSample,null);assert.equal(r.locate(O),'outside');}
 const tangent=clipCylinderBRep3(cylinder,-1n,1n,[h(1n,0n,0n,-1n)]);closed(tangent);assert.equal(tangent.faces.length,6);assert.equal(tangent.planes.length,3);assert.throws(()=>clipCylinderBRep3(cylinder,0n,0n),RangeError);
});
test('arbitrary rational axes, signed axis rescaling and translated origins preserve the closed solid',()=>{
 const o=point3(3n,-2n,7n),d=vector3(1n,2n,2n),c=cylinder3(line3(o,d),5n),a=clipCylinderBRep3(c,'-1/2','1/2'),b=clipCylinderBRep3(cylinder3(line3(o,vector3(-2n,-4n,-4n)),5n),'-1/4','1/4');closed(a);closed(b);assert.equal(a.faces.length,b.faces.length);
 const shifted=cylinder3(line3(point3(6n,4n,13n),d),5n),cShift=clipCylinderBRep3(shifted,'-7/2','-5/2');closed(cShift);assert.equal(a.locate(o),cShift.locate(o));
 const u=vector3(2n,-1n,0n),v=vector3('2/3','4/3','-5/3');for(let k=-4n;k<=4n;k++)for(const t of ['-1','-1/2','0','1/2','1']){const den=1n+k*k,x=new Rational(1n-k*k,den),y=new Rational(2n*k,den),T=Rational.parse(t),p=point3(o.x.add(u.x.mul(x)).add(v.x.mul(y)).add(d.x.mul(T)),o.y.add(u.y.mul(x)).add(v.y.mul(y)).add(d.y.mul(T)),o.z.add(u.z.mul(x)).add(v.z.mul(y)).add(d.z.mul(T)));assert.equal(a.locate(p),b.locate(p));assert.equal(a.locate(p),cShift.locate(p));assert.equal(a.locate(p)!=='outside',T.compare(new Rational(-1n,2n))>=0&&T.compare(new Rational(1n,2n))<=0);}
});
test('irrational-radius sections remain analytic and algebraic under parallel clipping',()=>{
 const c=cylinder3(line3(O,Z),2n),r=clipCylinderBRep3(c,-1n,1n,[h(1n,0n,0n)]);closed(r);assert.equal(r.faces.length,5);for(let x=-3n;x<=3n;x++)for(let y=-3n;y<=3n;y++){const p=point3(new Rational(x,2n),new Rational(y,2n),0n);assert.equal(r.locate(p)!=='outside',x<=0n&&x*x+y*y<=8n);}assert.ok(r.topology.vertices.some(p=>p.x.rational===null||p.y.rational===null));
});
test('non-axis-aligned halfspaces build a pure planar octahedron inside the cylinder',()=>{
 const constraints:CylinderHalfSpace3[]=[];for(const x of [-1n,1n])for(const y of [-1n,1n])for(const z of [-1n,1n])constraints.push(h(x,y,z,'-1/4'));
 const r=clipCylinderBRep3(cylinder,-1n,1n,constraints);closed(r);assert.equal(r.faces.length,8);assert.ok(r.faces.every(f=>f.kind==='planar'));assert.equal(r.topology.vertices.length,6);assert.equal(r.topology.edges.length,12);
 for(let x=-3n;x<=3n;x++)for(let y=-3n;y<=3n;y++)for(let z=-3n;z<=3n;z++){const abs=(a:bigint)=>a<0n?-a:a,p=point3(new Rational(x,8n),new Rational(y,8n),new Rational(z,8n));assert.equal(r.locate(p)!=='outside',abs(x)+abs(y)+abs(z)<=2n);}
});
test('a rational cap thinner than floating precision retains a closed nonempty solid and strict witness',()=>{
 const epsilon=new Rational(1n,10n**30n),cut=plane3(-1n,0n,0n,new Rational(1n).sub(epsilon)),r=clipCylinderBRep3(cylinder,-1n,1n,[{plane:cut,side:-1}]);closed(r);assert.equal(r.locate(point3(new Rational(1n).sub(epsilon.div(new Rational(2n))),0n,0n)),'inside');assert.equal(r.locate(point3(new Rational(1n).sub(epsilon),0n,0n)),'boundary');assert.equal(r.locate(point3(new Rational(1n).sub(epsilon.mul(new Rational(2n))),0n,0n)),'outside');
});
