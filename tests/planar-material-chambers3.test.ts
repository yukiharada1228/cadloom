import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point2,point3,triangle3,extrudePolygon,preparePlanarSolid3,compilePlanarChambers3,compilePlanarMaterial3,boundaryPlanarMaterial3,evaluatePlane3,classifyPointToSurface3,boundaryCylinderMaterialExpression3,bodyFromCylinderMaterial3,serializeBody3,restoreBody3,locateBody3,locateBodyFace3,surfacesCoincide3} from '../dist/index.js';
import type {CylinderMaterialExpression3,PlanarChamberProgram3,Point3} from '../dist/index.js';
function box(a:bigint,b:bigint){const p=(x:bigint,y:bigint,z:bigint)=>point3(x?a:b,y?a:b,z?a:b);return [[p(1n,1n,1n),p(1n,0n,1n),p(0n,0n,1n),p(0n,1n,1n)],[p(1n,1n,0n),p(0n,1n,0n),p(0n,0n,0n),p(1n,0n,0n)],[p(1n,1n,1n),p(0n,1n,1n),p(0n,1n,0n),p(1n,1n,0n)],[p(1n,0n,1n),p(1n,0n,0n),p(0n,0n,0n),p(0n,0n,1n)],[p(1n,1n,1n),p(1n,1n,0n),p(1n,0n,0n),p(1n,0n,1n)],[p(0n,1n,1n),p(0n,0n,1n),p(0n,0n,0n),p(0n,1n,0n)]];}

function strict(program:Pick<PlanarChamberProgram3,'planes'|'cylinders'|'expression'>,p:Point3){
 const signs=program.planes.map(h=>evaluatePlane3(h,p).sign()),c=program.cylinders[0]!,radial=classifyPointToSurface3(p,{kind:'cylinder',cylinder:c.cylinder});
 if(signs.includes(0)||radial===0||p.z.compare(c.lower)===0||p.z.compare(c.upper)===0)return null;
 const C=radial<0&&p.z.compare(c.lower)>0&&p.z.compare(c.upper)<0;
 const walk=(t:CylinderMaterialExpression3):boolean=>t.kind==='cylinder'?C:t.kind==='halfspace'?signs[t.halfspace]!<0:t.kind==='intersection'?walk(t.first)&&walk(t.second):t.kind==='union'?walk(t.first)||walk(t.second):t.kind==='difference'?walk(t.first)&&!walk(t.second):walk(t.first)!==walk(t.second);
 return walk(program.expression);
}
const between=(q:Rational,a:bigint,b:bigint)=>q.compare(new Rational(a))>0&&q.compare(new Rational(b))<0;
function check(source:ReturnType<typeof preparePlanarSolid3>,oracle:(p:Point3)=>boolean,max:number,transform:(p:Point3)=>Point3=p=>p){
 const program=compilePlanarChambers3(source),old=compilePlanarMaterial3(source);let count=0;
 for(let x=-1;x<=max;x++)for(let y=-1;y<=max;y++)for(let z=-1;z<=max;z++){
  const p=transform(point3(new Rational(BigInt(17*x+1),17n),new Rational(BigInt(19*y+2),19n),new Rational(BigInt(23*z+3),23n))),a=strict(program,p),b=strict(old,p);
  if(a===null||b===null)continue;assert.equal(a,oracle(p));assert.equal(a,b);assert.equal(source.locate(p),a?'inside':'outside');count++;
 }
 assert.ok(count>100);assert.ok(Object.isFrozen(program)&&Object.isFrozen(program.planes)&&Object.isFrozen(program.cylinders));
 const seen=new Set<CylinderMaterialExpression3>();function frozen(t:CylinderMaterialExpression3){if(seen.has(t))return;seen.add(t);assert.ok(Object.isFrozen(t));if(t.kind!=='cylinder'&&t.kind!=='halfspace'){frozen(t.first);frozen(t.second);}}frozen(program.expression);return program;
}
function lSource(){const mesh=extrudePolygon([[point2(0n,0n),point2(2n,0n),point2(2n,1n),point2(1n,1n),point2(1n,2n),point2(0n,2n)]],2n);return preparePlanarSolid3(mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!)));}
test('physical-plane chambers retain concave L material with no internal cone carriers',()=>{
 const source=lSource(),p=check(source,p=>[p.x,p.y,p.z].every(q=>between(q,0n,2n))&&(p.x.compare(new Rational(1n))<0||p.y.compare(new Rational(1n))<0),4);
 assert.equal(p.planes.length,8);assert.equal(p.chambers,4);assert.equal(p.materialChambers,3);assert.equal(p.candidateVertices,18);assert.throws(()=>compilePlanarChambers3({...source}),/factory/);
});
test('chambers preserve cavities, islands and disconnected material across repeated parallel carriers',()=>{
 const source=preparePlanarSolid3([...box(0n,6n),...box(1n,5n).map(f=>[...f].reverse()),...box(2n,4n),...box(8n,9n)]);
 check(source,p=>{const all=(a:bigint,b:bigint)=>[p.x,p.y,p.z].every(q=>between(q,a,b));return all(0n,6n)&&(!all(1n,5n)||all(2n,4n))||all(8n,9n);},9);
});
test('skew very thin rational cells retain exact chamber membership without tolerances',()=>{
 const scale=new Rational(1n,10n**40n),transform=(p:Point3)=>point3(p.x.add(p.y),p.y.add(p.z),p.z.mul(scale)),inverse=(p:Point3)=>{const z=p.z.div(scale),y=p.y.sub(z);return point3(p.x.sub(y),y,z);};
 const source=preparePlanarSolid3(box(0n,2n).map(f=>f.map(transform)));
 check(source,p=>{const q=inverse(p);return [q.x,q.y,q.z].every(v=>between(v,0n,2n));},4,transform);
});
test('empty planar material has no chambers and retains an immutable false program',()=>{
 const p=compilePlanarChambers3(preparePlanarSolid3([]));assert.equal(p.chambers,0);assert.equal(p.materialChambers,0);assert.equal(p.candidateVertices,0);assert.equal(p.planes.length,0);assert.ok(Object.isFrozen(p)&&Object.isFrozen(p.expression));for(const q of [point3('1/3','1/5','1/7'),point3(3n,4n,5n)])assert.equal(strict(p,q),false);
});
test('L chamber program constructs physical manifold faces and replays with the original Body retained',()=>{
 const source=lSource(),raw=boundaryPlanarMaterial3(source);assert.ok(raw.manifold);assert.equal(raw.faces.length,14);
 for(const f of raw.faces){assert.equal(f.origin.kind,'halfspace');assert.ok(source.topology.faces.some(g=>surfacesCoincide3(g.surface,f.surface)));const q=f.domain.sample;assert.ok(q.x.rational&&q.y.rational&&q.z.rational);assert.equal(source.locate(point3(q.x.rational,q.y.rational,q.z.rational)),'boundary');}
 const original=bodyFromCylinderMaterial3(raw),data=serializeBody3(original),body=restoreBody3(data);assert.ok(body.topology.closedOrientedIncidence);assert.equal(body.topology.issues.length,0);assert.equal(body.topology.shells.length,1);assert.equal(body.interiorSamples.length,1);body.faces.forEach((f,i)=>assert.equal(locateBodyFace3(body,i,f.sample),'inside'));
 for(const x of ['-1/2','1/2','3/2','5/2'])for(const y of ['-1/2','1/2','3/2','5/2'])for(const z of ['-1/2','1/2','3/2','5/2']){const q=point3(x,y,z),inside=[q.x,q.y,q.z].every(v=>between(v,0n,2n))&&(q.x.compare(new Rational(1n))<0||q.y.compare(new Rational(1n))<0);assert.equal(locateBody3(body,q),inside?'inside':'outside');}
 for(const [q,l] of [[point3(1n,'1/2',1n),'inside'],[point3('1/2',1n,1n),'inside'],[point3(1n,1n,1n),'boundary'],[point3(1n,'3/2',1n),'boundary'],[point3(2n,'1/2',1n),'boundary'],[point3('1/2','1/2',0n),'boundary'],[point3('1/2','3/2',2n),'boundary'],[point3('3/2','3/2',0n),'outside'],[point3(2n,2n,1n),'outside']] as const)assert.equal(locateBody3(body,q),l);
 for(const q of body.interiorSamples)assert.equal(locateBody3(body,q),'inside');assert.equal(locateBody3(original,point3('1/2','1/2',1n)),'inside');assert.equal(serializeBody3(original),data);assert.equal(raw.faces.length,original.faces.length);
});
test('cavity boundary chambers preserve void shell coorientation through common Body replay',()=>{
 const source=preparePlanarSolid3([...box(0n,3n),...box(1n,2n).map(f=>[...f].reverse())]),p=compilePlanarChambers3(source),raw=boundaryCylinderMaterialExpression3(p.cylinders,p.planes,p.expression);
 assert.ok(raw.manifold);assert.ok(raw.faces.every(f=>f.origin.kind==='halfspace'&&source.topology.faces.some(g=>surfacesCoincide3(g.surface,f.surface))));
 const original=bodyFromCylinderMaterial3(raw),body=restoreBody3(serializeBody3(original));assert.equal(body.topology.shells.length,2);assert.ok(body.topology.closedOrientedIncidence);assert.equal(body.topology.issues.length,0);
 for(const [q,l] of [[point3('1/2','3/2','3/2'),'inside'],[point3('3/2','3/2','3/2'),'outside'],[point3(1n,'3/2','3/2'),'boundary'],[point3(0n,'3/2','3/2'),'boundary'],[point3('7/2','3/2','3/2'),'outside']] as const)assert.equal(locateBody3(body,q),l);
 body.faces.forEach((f,i)=>assert.equal(locateBodyFace3(body,i,f.sample),'inside'));for(const q of body.interiorSamples)assert.equal(locateBody3(body,q),'inside');assert.equal(locateBody3(original,point3('3/2','3/2','3/2')),'outside');
});
test('nested cavity, material island and disconnected chamber boundaries replay four shells and three regions',()=>{
 const source=preparePlanarSolid3([...box(0n,6n),...box(1n,5n).map(f=>[...f].reverse()),...box(2n,4n),...box(8n,9n)]),p=compilePlanarChambers3(source),raw=boundaryCylinderMaterialExpression3(p.cylinders,p.planes,p.expression);
 assert.ok(raw.manifold);assert.ok(raw.faces.every(f=>f.origin.kind==='halfspace'&&source.topology.faces.some(g=>surfacesCoincide3(g.surface,f.surface))));
 const original=bodyFromCylinderMaterial3(raw),data=serializeBody3(original),body=restoreBody3(data);assert.equal(body.topology.shells.length,4);assert.equal(body.interiorSamples.length,3);assert.ok(body.topology.closedOrientedIncidence);assert.equal(body.topology.issues.length,0);body.faces.forEach((f,i)=>assert.equal(locateBodyFace3(body,i,f.sample),'inside'));
 for(const x of ['-1/2','1/2','3/2','5/2','9/2','11/2','13/2','17/2','19/2'])for(const y of ['1/2','3/2','5/2','9/2','11/2','17/2'])for(const z of ['1/2','3/2','5/2','9/2','11/2','17/2']){
  const q=point3(x,y,z),all=(a:bigint,b:bigint)=>[q.x,q.y,q.z].every(v=>between(v,a,b)),inside=all(0n,6n)&&(!all(1n,5n)||all(2n,4n))||all(8n,9n);assert.equal(locateBody3(body,q),inside?'inside':'outside');
 }
 for(const q of [point3(0n,'1/2','1/2'),point3(1n,'3/2','3/2'),point3(2n,'5/2','5/2'),point3(8n,'17/2','17/2'),point3(9n,'17/2','17/2')])assert.equal(locateBody3(body,q),'boundary');
 for(const q of body.interiorSamples)assert.equal(locateBody3(body,q),'inside');assert.equal(locateBody3(original,point3('5/2','5/2','5/2')),'inside');assert.equal(serializeBody3(original),data);
});
test('through-hole chamber boundary retains one positive-genus shell without filling its tunnel on replay',()=>{
 const mesh=extrudePolygon([[point2(0n,0n),point2(3n,0n),point2(3n,3n),point2(0n,3n)],[point2(1n,1n),point2(1n,2n),point2(2n,2n),point2(2n,1n)]],2n),source=preparePlanarSolid3(mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!))),p=compilePlanarChambers3(source),raw=boundaryCylinderMaterialExpression3(p.cylinders,p.planes,p.expression);
 assert.ok(raw.manifold);assert.ok(raw.faces.every(f=>f.origin.kind==='halfspace'&&source.topology.faces.some(g=>surfacesCoincide3(g.surface,f.surface))));
 const original=bodyFromCylinderMaterial3(raw),body=restoreBody3(serializeBody3(original));assert.equal(body.topology.shells.length,1);assert.equal(body.interiorSamples.length,1);assert.ok(body.topology.closedOrientedIncidence);assert.equal(body.topology.issues.length,0);body.faces.forEach((f,i)=>assert.equal(locateBodyFace3(body,i,f.sample),'inside'));
 for(const x of ['-1/2','1/2','3/2','5/2','7/2'])for(const y of ['-1/2','1/2','3/2','5/2','7/2'])for(const z of ['-1/2','1/2','3/2','5/2']){const q=point3(x,y,z),inside=between(q.x,0n,3n)&&between(q.y,0n,3n)&&between(q.z,0n,2n)&&!(between(q.x,1n,2n)&&between(q.y,1n,2n));assert.equal(locateBody3(body,q),inside?'inside':'outside');}
 for(const [q,l] of [[point3(1n,'3/2',1n),'boundary'],[point3('3/2','3/2',0n),'outside'],[point3('3/2','3/2',2n),'outside'],[point3('1/2','3/2',0n),'boundary']] as const)assert.equal(locateBody3(body,q),l);for(const q of body.interiorSamples)assert.equal(locateBody3(body,q),'inside');assert.equal(locateBody3(original,point3('3/2','3/2',1n)),'outside');
});
