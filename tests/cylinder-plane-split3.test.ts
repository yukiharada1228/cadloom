import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point3,vector3,line3,cylinder3,circle3,circularArc3,prepareCylinderFace3,plane3,splitCylinderFaceByPlane3,pointOnCurve3,curveEndpoints3,curveOnSurface3,compareAlgebraicPoints3,algebraicCoordinates3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=vector3(0n,0n,1n),cylinder=cylinder3(line3(O,Z),1n),circle=circle3(O,Z,1n);
function assertLoops(result:ReturnType<typeof splitCylinderFaceByPlane3>){
 for(const region of [result.negative,result.positive]){assert.notEqual(region.loops,null);for(const loop of region.loops!){assert.ok(loop.length);for(let i=0;i<loop.length;i++){const current=loop[i]!,next=loop[(i+1)%loop.length]!,A=curveEndpoints3(result.edges[current.edge]!),B=curveEndpoints3(result.edges[next.edge]!);assert.equal(compareAlgebraicPoints3(A[current.direction===1?1:0],B[next.direction===1?0:1]),0);}}}
 assert.ok(result.topology);assert.equal(result.topology.manifoldVertices,true);assert.equal(result.topology.consistentlyOriented,true);
 for(const edge of result.sharedEdges){const uses=result.topology.edges[edge]!.coedges;assert.equal(uses.length,2);assert.equal(result.topology.coedges[uses[0]!]!.twin,uses[1]);assert.equal(result.negative.uses.find(u=>u.edge===edge)!.direction,-result.positive.uses.find(u=>u.edge===edge)!.direction);assert.ok(curveOnSurface3(result.edges[edge]!,{kind:'plane',plane:result.plane}));}
}
function sampleGrid(result:ReturnType<typeof splitCylinderFaceByPlane3>,a:bigint,b:bigint,c:bigint,offset:bigint){
 for(let k=-8n;k<=8n;k++)for(const z of [-2n,-1n,0n,1n,2n]){const den=1n+k*k,x=new Rational(1n-k*k,den),y=new Rational(2n*k,den),p=point3(x,y,z),h=x.mul(new Rational(a)).add(y.mul(new Rational(b))).add(new Rational(c*z+offset)),original=result.face.locate(p),negative=result.negative.locate(p),positive=result.positive.locate(p);
 assert.equal(negative!=='outside'||positive!=='outside',original!=='outside');if(original==='outside')continue;if(h.sign()<0){assert.notEqual(negative,'outside');assert.equal(positive,'outside');}if(h.sign()>0){assert.notEqual(positive,'outside');assert.equal(negative,'outside');}
 }
}
test('oblique cylinder split constructs shared elliptic edges and exact complementary domains',()=>{
 const result=splitCylinderFaceByPlane3(prepareCylinderFace3(cylinder,-2n,2n),plane3(1n,0n,-1n));assert.ok(result.sharedEdges.length>=4);assertLoops(result);sampleGrid(result,1n,0n,-1n,0n);
 assert.equal(result.negative.loops!.length,2);assert.equal(result.positive.loops!.length,2);assert.equal(result.negative.locate(point3(1n,0n,1n)),'boundary');assert.equal(result.positive.locate(point3(1n,0n,1n)),'boundary');
 for(const edge of result.edges)assert.ok(curveOnSurface3(edge,{kind:'cylinder',cylinder}));
 const reversed=splitCylinderFaceByPlane3(prepareCylinderFace3(cylinder,-2n,2n,{sense:-1}),plane3(1n,0n,-1n));assertLoops(reversed);sampleGrid(reversed,1n,0n,-1n,0n);
});
test('parallel secants share generator edges with independently known physical directions',()=>{
 for(const sense of [1,-1] as const){const r=splitCylinderFaceByPlane3(prepareCylinderFace3(cylinder,-2n,2n,{sense}),plane3(1n,0n,0n));assert.equal(r.sharedEdges.length,2);assertLoops(r);sampleGrid(r,1n,0n,0n,0n);
 for(const edge of r.sharedEdges){const use=r.negative.uses.find(u=>u.edge===edge)!,endpoints=curveEndpoints3(r.edges[edge]!),start=endpoints[use.direction===1?0:1],end=endpoints[use.direction===1?1:0],y=start.y.sign();assert.equal(end.z.compare(start.z),-y*sense);}
 }
});
test('tangent generator preserves the whole surface on one side and does not create a false split',()=>{
 const face=prepareCylinderFace3(cylinder,-2n,2n),r=splitCylinderFaceByPlane3(face,plane3(1n,0n,0n,-1n));assert.equal(r.sharedEdges.length,0);assert.equal(r.positive.empty,true);assert.equal(r.negative.empty,false);assertLoops(r);assert.equal(r.negative.locate(point3(1n,0n,0n)),'inside');assert.equal(r.negative.locate(point3(1n,0n,2n)),'boundary');sampleGrid(r,1n,0n,0n,-1n);
 const miss=splitCylinderFaceByPlane3(face,plane3(1n,0n,0n,-2n));assert.equal(miss.positive.empty,true);assert.equal(miss.sharedEdges.length,0);assertLoops(miss);
});
test('cap-coincident and outside-height planes retain only the nonempty regularized side',()=>{
 const face=prepareCylinderFace3(cylinder,-2n,2n);
 for(const height of [-3n,-2n,2n,3n]){const r=splitCylinderFaceByPlane3(face,plane3(0n,0n,1n,-height));assert.equal(r.sharedEdges.length,0);assert.equal(r.negative.empty,height<=-2n);assert.equal(r.positive.empty,height>=2n);assertLoops(r);sampleGrid(r,0n,0n,1n,-height);}
 const middle=splitCylinderFaceByPlane3(face,plane3(0n,0n,1n));assertLoops(middle);assert.ok(middle.sharedEdges.length);sampleGrid(middle,0n,0n,1n,0n);
});
test('angular boundary coincidence is assigned using the actual inward surface direction',()=>{
 const angular=circularArc3(circle,point3(1n,0n,0n),point3(0n,1n,0n)),face=prepareCylinderFace3(cylinder,-2n,2n,{angular});
 for(const sense of [1,-1] as const){const r=splitCylinderFaceByPlane3(prepareCylinderFace3(cylinder,-2n,2n,{angular,sense}),plane3(1n,0n,0n));assert.equal(r.negative.empty,true);assert.equal(r.sharedEdges.length,0);assertLoops(r);assert.equal(r.positive.locate(point3(0n,1n,0n)),'boundary');}
 const reverse=splitCylinderFaceByPlane3(face,plane3(-3n,0n,0n));assert.equal(reverse.positive.empty,true);assertLoops(reverse);
});
test('major angular patches are split and the union still equals the original product domain',()=>{
 const angular=circularArc3(circle,point3(1n,0n,0n),point3(0n,-1n,0n)),r=splitCylinderFaceByPlane3(prepareCylinderFace3(cylinder,-2n,2n,{angular}),plane3(0n,1n,0n));assert.equal(r.sharedEdges.length,1);assertLoops(r);sampleGrid(r,0n,1n,0n,0n);
});
test('cap tangencies report ambiguous boundary vertices instead of inventing loop pairing',()=>{
 const r=splitCylinderFaceByPlane3(prepareCylinderFace3(cylinder,-1n,1n),plane3(1n,0n,-1n));assert.equal(r.topology,null);assert.ok(r.negative.loops===null||r.positive.loops===null);sampleGrid(r,1n,0n,-1n,0n);
 assert.equal(r.negative.locate(point3(1n,0n,1n)),'boundary');assert.equal(r.positive.locate(point3(1n,0n,1n)),'boundary');
});
test('arbitrary rational axis/frame and plane rescaling preserve independently parameterized domains',()=>{
 const o=point3(3n,-2n,7n),d=vector3(1n,2n,2n),u=vector3(2n,-1n,0n),v=vector3('2/3','4/3','-5/3'),C=cylinder3(line3(o,d),5n),n=vector3(new Rational(2n,5n).sub(new Rational(1n,9n)),new Rational(-1n,5n).sub(new Rational(2n,9n)),new Rational(-2n,9n)),offset=n.x.mul(o.x).add(n.y.mul(o.y)).add(n.z.mul(o.z)).neg(),p=plane3(n.x,n.y,n.z,offset),face=prepareCylinderFace3(C,-2n,2n),r=splitCylinderFaceByPlane3(face,p),s=splitCylinderFaceByPlane3(face,plane3(n.x.mul(new Rational(-3n)),n.y.mul(new Rational(-3n)),n.z.mul(new Rational(-3n)),offset.mul(new Rational(-3n))));assertLoops(r);assertLoops(s);
 for(let k=-5n;k<=5n;k++)for(const t of [-1n,0n,1n]){const den=1n+k*k,x=new Rational(1n-k*k,den),y=new Rational(2n*k,den),point=point3(o.x.add(u.x.mul(x)).add(v.x.mul(y)).add(d.x.mul(new Rational(t))),o.y.add(u.y.mul(x)).add(v.y.mul(y)).add(d.y.mul(new Rational(t))),o.z.add(u.z.mul(x)).add(v.z.mul(y)).add(d.z.mul(new Rational(t)))),h=x.compare(new Rational(t));if(h<0){assert.notEqual(r.negative.locate(point),'outside');assert.equal(r.positive.locate(point),'outside');}if(h>0){assert.notEqual(r.positive.locate(point),'outside');assert.equal(r.negative.locate(point),'outside');}assert.equal(r.negative.locate(point),s.positive.locate(point));assert.equal(r.positive.locate(point),s.negative.locate(point));}
});
test('irrational angular generators and immutable reconstruction are retained',()=>{
 const h=AlgebraicReal.fromRational('1/2').sqrt(),angular=circularArc3(circle,algebraicCoordinates3(h,h,0n),algebraicCoordinates3(h.neg(),h,0n)),face=prepareCylinderFace3(cylinder,-2n,2n,{angular}),r=splitCylinderFaceByPlane3({...face,locate:()=>{throw new Error('Untrusted callback');}},plane3(1n,0n,-1n));assertLoops(r);assert.ok(r.sharedEdges.length);assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.edges)&&Object.isFrozen(r.negative)&&Object.isFrozen(r.negative.uses));
});
