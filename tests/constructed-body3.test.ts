import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point2,point3,vector3,line3,cylinder3,circle2,fullCircleArc2,createBoxBody3,createCylinderBody3,extrudeBody3,locateBody3,locateBodyFace3,bodyDocument3,serializeBody3,restoreBody3,readBodyRecord3,readBodyDocument3,restoreNativeBRepBoundary3,decodeExactPoint3,encodeExactPoint3,algebraicCoordinates3,booleanCurveRegions2,extrudeCurveRegionBRep3} from '../dist/index.js';
import {adoptExtrudedBody3} from '../dist/model/body3.js';
import type {Body3,CurveRegion2,BodyDocument3} from '../dist/index.js';
const clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
const polygon=(xy:readonly (readonly [string,string])[]):CurveRegion2=>{const p=xy.map(([x,y])=>point2(x,y));return [p.map((start,i)=>({kind:'segment',segment:{start,end:p[(i+1)%p.length]!}}))];};
const square=(a:string,b:string,c:string,d:string)=>polygon([[a,b],[c,b],[c,d],[a,d]]);
const box=()=>createBoxBody3(point3(0n,0n,0n),2n,3n,4n);
function common(b:Body3){assert.equal(b.topology.closedOrientedIncidence,true);assert.equal(b.topology.issues.length,0);assert.equal(b.record.faces.length,b.topology.faces.length);assert.equal(b.interiorSamples.length,b.record.regions.length-1);for(const p of b.interiorSamples)assert.equal(locateBody3(b,p),'inside');assert.ok(Object.isFrozen(b)&&Object.isFrozen(b.record)&&Object.isFrozen(b.construction));return b;}
test('Box, Cylinder and Extrude share material records, owned queries and reconstructed native incidence',()=>{
  const bodies=[box(),createCylinderBody3(cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),1n),0n,2n),extrudeBody3(square('0','0','2','3'),4n)];for(const b of bodies)common(b);assert.equal(bodies[0]!.record.vertices.length,8);assert.equal(bodies[0]!.record.edges.length,12);assert.equal(bodies[0]!.record.faces.length,6);assert.equal(locateBody3(bodies[0]!,point3(1n,1n,1n)),'inside');
  for(let x=-1;x<=3;x++)for(let y=-1;y<=4;y++)for(let z=-1;z<=5;z++){const p=point3(BigInt(x),BigInt(y),BigInt(z));assert.equal(locateBody3(bodies[0]!,p),locateBody3(bodies[2]!,p));}
});
test('translated box membership agrees with an independent exact interval oracle beyond Number precision',()=>{
  const base=new Rational(10n**30n),epsilon=new Rational(1n,10n**30n),b=common(createBoxBody3(point3(base,base,base),epsilon,epsilon,epsilon));for(const i of [-1n,0n,1n,2n,3n])for(const j of [-1n,0n,1n,2n,3n])for(const k of [-1n,0n,1n,2n,3n]){const q=(n:bigint)=>base.add(epsilon.mul(new Rational(n,2n))),expected=[i,j,k].some(n=>n<0n||n>2n)?'outside':[i,j,k].some(n=>n===0n||n===2n)?'boundary':'inside';assert.equal(locateBody3(b,point3(q(i),q(j),q(k))),expected);}common(restoreBody3(serializeBody3(b)));
});
test('non-unit cylinder axis parameters retain exact physical bounds and algebraic boundary locations',()=>{
  const b=common(createCylinderBody3(cylinder3(line3(point3(3n,4n,5n),vector3(0n,0n,2n)),2n),'-1/2','3/2'));
  for(let x=0n;x<=6n;x++)for(let y=1n;y<=7n;y++)for(let z=3n;z<=9n;z++){const d=(x-3n)**2n+(y-4n)**2n,expected=d>2n||z<4n||z>8n?'outside':d===2n||z===4n||z===8n?'boundary':'inside';assert.equal(locateBody3(b,point3(x,y,z)),expected);}
  const a=AlgebraicReal.fromRational(2n).sqrt();assert.equal(locateBody3(b,algebraicCoordinates3(a.affine(1n,3n),4n,6n)),'boundary');assert.ok(b.interiorSamples[0]!.x instanceof AlgebraicReal);common(restoreBody3(serializeBody3(b)));
});
test('a plate with a circular through-hole retains two cap loops and material classification after replay',()=>{
  const hole={kind:'arc' as const,arc:fullCircleArc2(circle2(point2(0n,0n),1n),'cw')},b=common(extrudeBody3([...square('-3','-3','3','3'),[hole]],2n,{fillRule:'nonzero'})),restored=common(restoreBody3(serializeBody3(b)));assert.equal(b.record.regions.length,2);assert.ok(b.record.faces.some(f=>f.loops.length===2));assert.ok(b.record.surfaces.some(s=>s.kind==='cylinder'));
  for(let i=-4n;i<=4n;i++)for(let j=-4n;j<=4n;j++)for(const z of [-1n,0n,1n,2n,3n]){const rr=i*i+j*j,expected=i< -3n||i>3n||j< -3n||j>3n||rr<1n||z<0n||z>2n?'outside':i===-3n||i===3n||j===-3n||j===3n||rr===1n||z===0n||z===2n?'boundary':'inside',p=point3(i,j,z);assert.equal(locateBody3(b,p),expected);assert.equal(locateBody3(restored,p),expected);}
});
test('disconnected material and empty extrusion preserve correct region roles through replay',()=>{
  const b=common(extrudeBody3([...square('-3','-1','-1','1'),...square('1','-1','3','1')],2n));assert.equal(b.record.regions.length,3);assert.equal(b.topology.shells.length,2);common(restoreBody3(serializeBody3(b)));const e=common(extrudeBody3([],2n));assert.equal(e.record.faces.length,0);assert.equal(e.record.regions.length,1);assert.equal(locateBody3(e,point3(0n,0n,0n)),'outside');common(restoreBody3(serializeBody3(e)));
});
test('negative extrusion normalizes its material interval and isolates caller mutations',()=>{
  const points=[point2(0n,0n),point2(2n,0n),point2(2n,2n),point2(0n,2n)],ring=points.map((start,i)=>({kind:'segment' as const,segment:{start,end:points[(i+1)%4]!}})),b=common(extrudeBody3([ring],-2n,{baseZ:1n}));ring.pop();assert.equal(locateBody3(b,point3(1n,1n,0n)),'inside');assert.equal(locateBody3(b,point3(1n,1n,2n)),'outside');assert.equal(b.construction.kind,'extrude');if(b.construction.kind==='extrude'){assert.equal(b.construction.lower,'-1');assert.equal(b.construction.upper,'1');}common(restoreBody3(serializeBody3(b)));
});
test('face queries use the same global face indices but classify relative to bounded faces',()=>{
  const b=box();const cap=b.topology.faces.findIndex(f=>f.surface.kind==='plane'&&f.surface.plane.normal.z.sign()!==0&&locateBodyFace3(b,b.topology.faces.indexOf(f),point3(1n,1n,0n))!=='outside');assert.ok(cap>=0);assert.equal(locateBodyFace3(b,cap,point3(1n,1n,0n)),'inside');assert.equal(locateBody3(b,point3(1n,1n,0n)),'boundary');assert.equal(locateBodyFace3(b,cap,point3(20n,20n,0n)),'outside');assert.throws(()=>locateBodyFace3(b,99,point3(0n,0n,0n)),/index/);
});
test('copies, raw records and construction labels cannot forge an owned Body',()=>{
  const b=box();assert.throws(()=>locateBody3({...b},point3(1n,1n,1n)),/factory/);assert.throws(()=>serializeBody3({...b}),/factory/);assert.throws(()=>restoreBody3(b.record),/unknown|missing/);const d=clone(bodyDocument3(b)) as any;d.certified=true;assert.throws(()=>restoreBody3(d),/unknown/);
});
test('replay rejects altered geometry, region semantics, orientation and mismatching construction dimensions',()=>{
  const b=box(),original=bodyDocument3(b);
  for(const change of [(d:any)=>{d.body.vertices[0]={kind:'coordinates',x:{kind:'rational',value:'99'},y:{kind:'rational',value:'0'},z:{kind:'rational',value:'0'}};},(d:any)=>d.body.regions[1].void=true,(d:any)=>d.body.shells[0].faces[0].direction=-1,(d:any)=>d.construction.size[0]='3']){const d=clone(original);change(d);assert.ok(readBodyDocument3(d));assert.throws(()=>restoreBody3(d),/does not match/);}
});
test('semantically equal exact scalar/point encodings are accepted instead of comparing JSON bytes',()=>{
  const d=clone(bodyDocument3(box())) as any;d.body.curves[0].origin[0]='0/7';d.body.vertices=d.body.vertices.map((p:any)=>{const q=decodeExactPoint3(p);return encodeExactPoint3(algebraicCoordinates3(q.x,q.y,q.z));});assert.notEqual(JSON.stringify(d),serializeBody3(box()));common(restoreBody3(d));
});
test('native boundary reconstruction checks endpoints, whole support and actual connected shells',()=>{
  const b=box(),r=clone(b.record) as any;r.vertices[0]={kind:'coordinates',x:{kind:'rational',value:'99'},y:{kind:'rational',value:'0'},z:{kind:'rational',value:'0'}};assert.ok(readBodyRecord3(r));assert.throws(()=>restoreNativeBRepBoundary3(r),/vertices/);
  const support=clone(b.record) as any;support.surfaces[0].offset='99';assert.throws(()=>restoreNativeBRepBoundary3(support),/supporting surface/);
  const disconnected=clone(extrudeBody3([...square('-3','-1','-1','1'),...square('1','-1','3','1')],2n).record) as any;disconnected.shells=[{kind:'faces',faces:disconnected.faces.map((_:unknown,face:number)=>({face,direction:1})),wires:[]}];disconnected.regions=[{shells:[0],void:false},{shells:[0],void:false}];assert.ok(readBodyRecord3(disconnected));assert.throws(()=>restoreNativeBRepBoundary3(disconnected),/shell/);
});
test('invalid dimensions, radius/axis, construction bounds, versions and budgets fail explicitly',()=>{
  assert.throws(()=>createBoxBody3(point3(0n,0n,0n),0n,1n,1n),/positive/);assert.throws(()=>createBoxBody3(point3(0n,0n,0n),-1n,1n,1n),/positive/);assert.throws(()=>extrudeBody3([],0n),/nonzero/);const c=cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),1n);assert.throws(()=>createCylinderBody3({...c,radiusSquared:new Rational(-1n)},0n,1n),/radius/);assert.throws(()=>createCylinderBody3({...c,axis:{origin:c.axis.origin,direction:vector3(0n,0n,0n)}},0n,1n),/nonzero/);assert.throws(()=>createCylinderBody3(c,1n,0n),/increasing|bounds/);const d=clone(bodyDocument3(box())) as any;d.version=2;assert.throws(()=>restoreBody3(d),RangeError);assert.throws(()=>restoreBody3(serializeBody3(box()),{maxItems:10}),/budget/);const e=clone(bodyDocument3(extrudeBody3([],2n))) as any;e.construction.upper=e.construction.lower;assert.throws(()=>restoreBody3(e),/increasing/);
});

test('algebraically trimmed circular profiles retain exact geometry and location after replay',()=>{
  const disk:CurveRegion2=[[{kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),1n))}]],profile=booleanCurveRegions2(disk,square('1/2','-2','2','2'),'intersection').rings,b=common(extrudeBody3(profile,2n)),restored=common(restoreBody3(serializeBody3(b)));assert.ok(b.geometry.vertices.some(p=>p.y.rational===null));
  for(let i=-2n;i<=6n;i++)for(let j=-5n;j<=5n;j++){const rr=i*i+j*j,expected=i<2n||rr>16n?'outside':i===2n||rr===16n?'boundary':'inside',p=point3(new Rational(i,4n),new Rational(j,4n),1n);assert.equal(locateBody3(b,p),expected);assert.equal(locateBody3(restored,p),expected);}
});
test('skew rational cylinder axes preserve common record geometry and owned material reconstruction',()=>{
  const o=point3(3n,-2n,7n),b=common(createCylinderBody3(cylinder3(line3(o,vector3(1n,2n,2n)),5n),'-1/2','1/2'));assert.equal(locateBody3(b,o),'inside');assert.equal(locateBody3(b,point3('7/2',-1n,8n)),'boundary');const restored=common(restoreBody3(serializeBody3(b)));for(const p of [o,point3('7/2',-1n,8n),point3(30n,20n,10n)])assert.equal(locateBody3(b,p),locateBody3(restored,p));
});
test('counterfeit construction objects cannot supply altered locators to the Body adoption layer',()=>{
  const source=extrudeCurveRegionBRep3(square('0','0','2','2'),2n),construction=bodyDocument3(extrudeBody3(square('0','0','2','2'),2n)).construction;assert.throws(()=>adoptExtrudedBody3({...source,locate:()=> 'inside'},construction),/factory/);
});
test('nested circular islands and disconnected material replay with stable shared Body regions',()=>{
  const ring=(x:bigint,r:bigint,direction:'cw'|'ccw'='ccw')=>[{kind:'arc' as const,arc:fullCircleArc2(circle2(point2(x,0n),r),direction)}],body=common(extrudeBody3([ring(6n,1n),ring(0n,1n),ring(0n,4n,'cw'),ring(0n,9n)],2n,{fillRule:'nonzero'})),copy=common(restoreBody3(serializeBody3(body)));assert.equal(body.record.regions.length,4);for(const [x,w] of [[0n,'inside'],['3/2','outside'],['5/2','inside'],[4n,'outside'],[6n,'inside']] as const){assert.equal(locateBody3(body,point3(x,0n,1n)),w);assert.equal(locateBody3(copy,point3(x,0n,1n)),w);}
});
