import test from 'node:test';
import assert from 'node:assert/strict';
import {boundaryBoxMaterial3,point3,bodyFromCylinderMaterial3,serializeBody3,restoreBody3,locateBody3,booleanCylinderMaterials3,prepareFiniteCylinder3,cylinder3,line3,boundaryCylinderMaterialExpression3} from '../dist/index.js';
test('box material has six genuine plane faces and exact independent membership after replay',()=>{
 const raw=boundaryBoxMaterial3(point3('-1/3','2/5',7n),'3/2','4/3','2/7');
 assert.equal(raw.faces.length,6);assert.ok(raw.faces.every(f=>f.origin.kind==='halfspace'));assert.ok(raw.manifold);
 const body=restoreBody3(serializeBody3(bodyFromCylinderMaterial3(raw)));
 for(const x of ['-1/2','-1/3',0n,'7/6','4/3'])for(const y of [0n,'2/5',1n,'26/15',2n])for(const z of [6n,7n,'50/7', '51/7',8n]){
  const p=point3(x,y,z),v=[p.x,p.y,p.z],lo=point3('-1/3','2/5',7n),hi=point3('7/6','26/15','51/7'),a=[lo.x,lo.y,lo.z],b=[hi.x,hi.y,hi.z];
  const outside=v.some((q,i)=>q.compare(a[i]!)<0||q.compare(b[i]!)>0),boundary=v.some((q,i)=>q.compare(a[i]!)===0||q.compare(b[i]!)===0);
  assert.equal(locateBody3(body,p),outside?'outside':boundary?'boundary':'inside');
 }
 assert.throws(()=>boundaryBoxMaterial3(point3(0n,0n),0n,1n,1n),/positive/);
});
test('box/cylinder intersection keeps planar faces and a curved wall with replay',()=>{
 const box=boundaryBoxMaterial3(point3(0n,-2n,-2n),2n,4n,4n),c=prepareFiniteCylinder3(cylinder3(line3(point3(0n,0n),point3(0n,0n,1n)),1n),-1n,1n),cyl=boundaryCylinderMaterialExpression3([c],[],{kind:'cylinder',cylinder:0}),raw=booleanCylinderMaterials3(box,cyl,'intersection');
 assert.ok(raw.faces.some(f=>f.origin.kind==='halfspace'));assert.ok(raw.faces.some(f=>f.surface.kind==='cylinder'));
 const body=restoreBody3(serializeBody3(bodyFromCylinderMaterial3(raw)));
 assert.equal(locateBody3(body,point3('1/2',0n)),'inside');assert.equal(locateBody3(body,point3('-1/2',0n)),'outside');assert.equal(locateBody3(body,point3(0n,0n)),'boundary');assert.equal(locateBody3(body,point3('3/2',0n)),'outside');
});
test('all four box/cylinder material operations match independent strict rational predicates',()=>{
 const box=boundaryBoxMaterial3(point3(0n,-2n,-2n),2n,4n,4n),c=prepareFiniteCylinder3(cylinder3(line3(point3(0n,0n),point3(0n,0n,1n)),1n),-1n,1n),cyl=boundaryCylinderMaterialExpression3([c],[],{kind:'cylinder',cylinder:0});
 for(const kind of ['union','intersection','difference','xor'] as const){const result=booleanCylinderMaterials3(box,cyl,kind);for(const edge of result.sewn.topology.edges)assert.equal(edge.coedges.reduce((sum,id)=>sum+result.sewn.topology.coedges[id]!.direction,0),0);for(const x of ['-3/2','-1/2','1/2','3/2','5/2'])for(const y of ['-3/2','-1/2','1/2','3/2'])for(const z of ['-3/2','-1/2','1/2','3/2']){const p=point3(x,y,z),a=p.x.sign()>0&&p.x.compare(point3(2n,0n).x)<0,b=p.x.mul(p.x).add(p.y.mul(p.y)).compare(point3(1n,0n).x)<0&&p.z.compare(point3(-1n,0n).x)>0&&p.z.compare(point3(1n,0n).x)<0,expected=kind==='union'?a||b:kind==='intersection'?a&&b:kind==='difference'?a&&!b:a!==b;assert.equal(result.locate(p),expected?'inside':'outside');}}
});
