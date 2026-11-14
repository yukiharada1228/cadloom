import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point3,vector3,line3,cylinder3,plane3,circle3,circularArc3,prepareCylinderFace3,prepareTrimmedCylinder3,splitTrimmedCylinderByPlane3,extractTrimmedCylinderComponent3,compareAlgebraicPoints3,curveEndpoints3,pointOnCurve3} from '../dist/index.js';
import type {CylinderHalfSpace3,PreparedTrimmedCylinder3} from '../dist/index.js';
const O=point3(0n,0n,0n),Z=vector3(0n,0n,1n),cylinder=cylinder3(line3(O,Z),1n),base=prepareCylinderFace3(cylinder,-2n,2n),negative=(x:bigint|string,y:bigint|string,z:bigint|string,k:bigint|string=0n):CylinderHalfSpace3=>({plane:plane3(x,y,z,k),side:-1});
function grid(region:PreparedTrimmedCylinder3,constraints:readonly CylinderHalfSpace3[]){
 for(let k=-10n;k<=10n;k++)for(const z of [-2n,-1n,0n,1n,2n]){const den=1n+k*k,x=new Rational(1n-k*k,den),y=new Rational(2n*k,den),point=point3(x,y,z),signs=constraints.map(h=>x.mul(h.plane.normal.x).add(y.mul(h.plane.normal.y)).add(new Rational(z).mul(h.plane.normal.z)).add(h.plane.offset).sign()*h.side),original=region.base.locate(point),location=region.locate(point);
 if(original==='outside'||signs.some(s=>s<0))assert.equal(location,'outside');else if(signs.every(s=>s>0)){assert.notEqual(location,'outside');assert.equal(region.components.filter(c=>c.locate(point)!=='outside').length,1);}
 if(location!=='outside')assert.ok(region.components.some(c=>c.locate(point)!=='outside'));
 }
}
function loops(region:PreparedTrimmedCylinder3){
 for(const c of region.components){assert.equal(c.locate(c.sample),'inside');assert.notEqual(c.loops,null);for(const loop of c.loops!){for(let i=0;i<loop.length;i++){const a=loop[i]!,b=loop[(i+1)%loop.length]!,A=curveEndpoints3(region.edges[a.edge]!),B=curveEndpoints3(region.edges[b.edge]!);assert.equal(compareAlgebraicPoints3(A[a.direction===1?1:0],B[b.direction===1?0:1]),0);}}}
}
test('untrimmed cylinder and repeated horizontal cuts retain reusable connected domains',()=>{
 const initial=prepareTrimmedCylinder3(base);assert.equal(initial.components.length,1);loops(initial);
 const first=splitTrimmedCylinderByPlane3(initial,plane3(0n,0n,1n)),second=splitTrimmedCylinderByPlane3(first.negative,plane3(0n,0n,1n,'1/2'));
 assert.equal(second.positive.components.length,1);loops(second.negative);loops(second.positive);grid(second.positive,[negative(0n,0n,1n),{plane:plane3(0n,0n,1n,'1/2'),side:1}]);
 assert.ok(first.sharedEdges.length);assert.ok(second.sharedEdges.length);assert.ok(second.topology);assert.equal(second.topology.manifoldVertices,true);
 for(const edge of second.sharedEdges){const a=second.negativeUses.find(u=>u.edge===edge)!,b=second.positiveUses.find(u=>u.edge===edge)!;assert.equal(a.direction,-b.direction);assert.equal(second.topology.edges[edge]!.coedges.length,2);}
});
test('a vertical strip extracts two connected interiors with independent samples and loops',()=>{
 const constraints=[negative(1n,0n,0n,'-1/2'),negative(-1n,0n,0n,'-1/2')],r=prepareTrimmedCylinder3(base,constraints);assert.equal(r.components.length,2);loops(r);grid(r,constraints);assert.equal(r.components[0]!.sample.y.sign(),-r.components[1]!.sample.y.sign());
 for(const c of r.components)assert.equal(c.loops!.length,1);
});
test('four circle/polygon angular intervals form four components and a point-only box is empty',()=>{
 const constraints=[negative(1n,0n,0n,'-4/5'),negative(-1n,0n,0n,'-4/5'),negative(0n,1n,0n,'-4/5'),negative(0n,-1n,0n,'-4/5')],r=prepareTrimmedCylinder3(base,constraints);assert.equal(r.components.length,4);loops(r);grid(r,constraints);
 const collapsed=prepareTrimmedCylinder3(base,[negative(1n,0n,0n,'-3/5'),negative(-1n,0n,0n,'-3/5'),negative(0n,1n,0n,'-4/5'),negative(0n,-1n,0n,'-4/5')]);assert.equal(collapsed.empty,true);assert.equal(collapsed.components.length,0);assert.equal(collapsed.edges.length,0);assert.equal(collapsed.locate(point3('3/5','4/5',0n)),'outside');
});
test('oblique upper/lower envelope cuts split again with order-independent exact membership',()=>{
 const constraints=[negative(-1n,0n,1n),negative(-1n,0n,-1n),negative(1n,0n,0n,'-4/5')],direct=prepareTrimmedCylinder3(base,constraints),reversed=prepareTrimmedCylinder3(base,[...constraints].reverse());assert.equal(direct.components.length,2);loops(direct);grid(direct,constraints);
 const step1=splitTrimmedCylinderByPlane3(prepareTrimmedCylinder3(base,[constraints[0]!]),constraints[1]!.plane).negative,step2=splitTrimmedCylinderByPlane3(step1,constraints[2]!.plane).negative;assert.equal(step2.components.length,2);
 for(let k=-8n;k<=8n;k++){const den=1n+k*k,x=new Rational(1n-k*k,den),y=new Rational(2n*k,den);for(const z of ['-1/2','0','1/2']){const p=point3(x,y,z);assert.equal(direct.locate(p),reversed.locate(p));assert.equal(direct.locate(p),step2.locate(p));}}
});
test('connected interiors touching at a pinched fiber are kept as separate components',()=>{
 const angular=circularArc3(circle3(O,Z,1n),point3(0n,-1n,0n),point3(0n,1n,0n)),patch=prepareCylinderFace3(cylinder,-2n,2n,{angular}),constraints=[negative(1n,0n,1n,-1n),negative(1n,0n,-1n,-1n)],r=prepareTrimmedCylinder3(patch,constraints);assert.equal(r.components.length,2);loops(r);grid(r,constraints);assert.equal(r.components.filter(c=>c.locate(point3(1n,0n,0n))==='boundary').length,2);assert.equal(r.locate(point3(1n,0n,0n)),'boundary');
});
test('redundant coincident generators merge and nonseparating recuts have no shared edges',()=>{
 const r=prepareTrimmedCylinder3(base,[negative(1n,0n,0n),negative(1n,1n,0n,-1n)]);assert.equal(r.components.length,1);loops(r);grid(r,r.halfspaces);assert.equal(r.edges.filter(c=>c.kind==='algebraic-segment').length,2);
 const cut=splitTrimmedCylinderByPlane3(prepareTrimmedCylinder3(base,[negative(1n,0n,0n)]),plane3(1n,1n,0n,-1n));assert.equal(cut.positive.empty,true);assert.equal(cut.sharedEdges.length,0);loops(cut.negative);
});
test('contradictions, lower-dimensional constraints and tangent halfspaces regularize correctly',()=>{
 for(const constraints of [[negative(0n,0n,1n),negative(0n,0n,-1n)],[negative(1n,0n,0n),negative(0n,0n,-1n),negative(-1n,0n,1n)],[negative(-1n,0n,0n,1n)]]){const r=prepareTrimmedCylinder3(base,constraints);assert.equal(r.empty,true);assert.equal(r.components.length,0);}
 const tangent=prepareTrimmedCylinder3(base,[negative(1n,0n,0n,-1n)]);assert.equal(tangent.components.length,1);assert.equal(tangent.locate(point3(1n,0n,0n)),'inside');loops(tangent);
 const splitEmpty=splitTrimmedCylinderByPlane3(prepareTrimmedCylinder3(base,[negative(0n,0n,1n),negative(0n,0n,-1n)]),plane3(1n,0n,0n));assert.equal(splitEmpty.negative.empty,true);assert.equal(splitEmpty.positive.empty,true);assert.equal(splitEmpty.edges.length,0);
});
test('rescaling, sense reversal, ownership and immutable geometry remain valid',()=>{
 const constraints=[negative(1n,0n,-1n),negative(-1n,0n,0n,'-1/2')],a=prepareTrimmedCylinder3(base,constraints),b=prepareTrimmedCylinder3(prepareCylinderFace3(cylinder,-2n,2n,{sense:-1}),[{plane:plane3(-3n,0n,3n),side:1},constraints[1]!,constraints[1]!]);assert.equal(a.components.length,b.components.length);loops(a);loops(b);
 for(const p of [point3(1n,0n,1n),point3(0n,1n,1n),point3(-1n,0n,0n)])assert.equal(a.locate(p),b.locate(p));assert.throws(()=>splitTrimmedCylinderByPlane3({...a},plane3(1n,0n,0n)),RangeError);assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.edges)&&Object.isFrozen(a.components)&&Object.isFrozen(a.halfspaces));assert.throws(()=>prepareTrimmedCylinder3(base,[{plane:plane3(1n,0n,0n),side:0 as never}]),RangeError);
});
test('arbitrary rational axes preserve fiber inequalities and shared topology per connected component',()=>{
 const o=point3(3n,-2n,7n),d=vector3(1n,2n,2n),u=vector3(2n,-1n,0n),v=vector3('2/3','4/3','-5/3'),C=cylinder3(line3(o,d),5n),B=prepareCylinderFace3(C,-2n,2n);
 const plane=(a:bigint,b:bigint,c:bigint,k:bigint|string)=>{const n=vector3(...(['x','y','z'] as const).map(j=>u[j].mul(new Rational(a,5n)).add(v[j].mul(new Rational(b,5n))).add(d[j].mul(new Rational(c,9n)))) as [Rational,Rational,Rational]);return plane3(n.x,n.y,n.z,Rational.parse(String(k)).sub(n.x.mul(o.x).add(n.y.mul(o.y)).add(n.z.mul(o.z))));};
 const strip:readonly CylinderHalfSpace3[]=[{plane:plane(1n,0n,0n,'-1/2'),side:-1},{plane:plane(-1n,0n,0n,'-1/2'),side:-1}],r=prepareTrimmedCylinder3(B,[...strip,{plane:plane(-1n,0n,1n,0n),side:-1}]);assert.equal(r.components.length,2);loops(r);
 for(let k=-7n;k<=7n;k++)for(const t of [-1n,0n,1n]){const den=1n+k*k,x=new Rational(1n-k*k,den),y=new Rational(2n*k,den),p=point3(o.x.add(u.x.mul(x)).add(v.x.mul(y)).add(d.x.mul(new Rational(t))),o.y.add(u.y.mul(x)).add(v.y.mul(y)).add(d.y.mul(new Rational(t))),o.z.add(u.z.mul(x)).add(v.z.mul(y)).add(d.z.mul(new Rational(t)))),expected=x.compare(new Rational(-1n,2n))>=0&&x.compare(new Rational(1n,2n))<=0&&new Rational(t).compare(x)<=0;assert.equal(r.locate(p)!=='outside',expected);}
 const split=splitTrimmedCylinderByPlane3(prepareTrimmedCylinder3(B,strip),plane(0n,0n,1n,0n));assert.equal(split.negative.components.length,2);assert.equal(split.positive.components.length,2);assert.equal(split.topologyFaces.negative.length,2);assert.equal(split.topologyFaces.positive.length,2);assert.ok(split.sharedEdges.length);assert.ok(split.topology);assert.equal(split.topology.manifoldVertices,true);for(const edge of split.sharedEdges)assert.equal(split.topology.edges[edge]!.coedges.length,2);
});
test('a connected pinched domain remains reusable and a recut separates its touching component closures',()=>{
 const domain=prepareTrimmedCylinder3(base,[negative(1n,0n,1n,-1n),negative(1n,0n,-1n,-1n)]);assert.equal(domain.components.length,1);assert.equal(domain.components[0]!.loops,null);
 const split=splitTrimmedCylinderByPlane3(domain,plane3(1n,0n,0n));assert.equal(split.negative.components.length,1);assert.equal(split.positive.components.length,2);loops(split.negative);loops(split.positive);assert.equal(split.positive.components.filter(c=>c.locate(point3(1n,0n,0n))==='boundary').length,2);assert.ok(split.topology);assert.equal(split.topology.manifoldVertices,false);assert.ok(split.topology.issues.some(i=>i.kind==='nonmanifold-vertex'));
});
test('each connected component can be extracted and re-split independently across the circular seam',()=>{
 const constraints=[negative(1n,0n,0n,'-1/2'),negative(-1n,0n,0n,'-1/2')],region=prepareTrimmedCylinder3(base,constraints);assert.equal(region.components.length,2);
 const extracted=region.components.map((_,i)=>extractTrimmedCylinderComponent3(region,i));
 for(let i=0;i<extracted.length;i++){const part=extracted[i]!;assert.equal(part.components.length,1);loops(part);assert.equal(part.locate(region.components[i]!.sample),'inside');assert.equal(part.locate(region.components[1-i]!.sample),'outside');const split=splitTrimmedCylinderByPlane3(part,plane3(0n,0n,1n));assert.equal(split.negative.components.length,1);assert.equal(split.positive.components.length,1);assert.ok(split.sharedEdges.length);assert.ok(split.topology);assert.equal(split.topology.manifoldVertices,true);}
 for(let k=-9n;k<=9n;k++){const den=1n+k*k,p=point3(new Rational(1n-k*k,den),new Rational(2n*k,den),0n);assert.equal(extracted.some(c=>c.locate(p)!=='outside'),region.locate(p)!=='outside');for(let i=0;i<extracted.length;i++)assert.equal(extracted[i]!.locate(p),region.components[i]!.locate(p));}
 for(const index of [-1,2,0.5])assert.throws(()=>extractTrimmedCylinderComponent3(region,index),RangeError);assert.throws(()=>extractTrimmedCylinderComponent3({...region},0),RangeError);
});
test('extracted touching closures retain only their own interior while sharing the contact point',()=>{
 const angular=circularArc3(circle3(O,Z,1n),point3(0n,-1n,0n),point3(0n,1n,0n)),patch=prepareCylinderFace3(cylinder,-2n,2n,{angular}),region=prepareTrimmedCylinder3(patch,[negative(1n,0n,1n,-1n),negative(1n,0n,-1n,-1n)]),a=extractTrimmedCylinderComponent3(region,0),b=extractTrimmedCylinderComponent3(region,1);assert.equal(a.locate(point3(1n,0n,0n)),'boundary');assert.equal(b.locate(point3(1n,0n,0n)),'boundary');assert.equal(a.locate(b.components[0]!.sample),'outside');assert.equal(b.locate(a.components[0]!.sample),'outside');loops(a);loops(b);
});
