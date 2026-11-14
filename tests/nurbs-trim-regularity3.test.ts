import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsCurve3,nurbsSurface3,prepareNurbsParameterDomain2,analyzeNurbsTrimRegularity3,reverseNurbsCurve3,AlgebraicReal,Rational,evaluateNurbsTrimSingularEdge3} from '../dist/index.js';
const K=[0n,0n,1n,1n],surface=()=>nurbsSurface3(1,2,[0n,1n].map(u=>['1/4','-1/4','1/4'].map(v=>point3(u,v,0n))),K,[0n,0n,0n,1n,1n,1n]);
const line=(x:string,y:string,X:string,Y:string)=>nurbsCurve3(1,[point3(x,y,0n),point3(X,Y,0n)],K);
const rectangle=(a:string,b:string,c:string,d:string)=>[line(a,b,c,b),line(c,b,c,d),line(c,d,a,d),line(a,d,a,b)];
const reverse=(a:ReturnType<typeof rectangle>)=>a.slice().reverse().map(reverseNurbsCurve3);
test('a singular supporting curve outside the trim is excluded completely',()=>{
  const r=analyzeNurbsTrimRegularity3(surface(),prepareNurbsParameterDomain2(rectangle('1/10','3/5','9/10','9/10')));assert.equal(r.support.everyPatchRegular,false);assert.equal(r.regular,true);assert.equal(r.patches[0]!.points.length,0);assert.equal(r.patches[0]!.edges.length,0);
});
test('crossings of outer and hole boundaries node the exact singular graph',()=>{
  const d=prepareNurbsParameterDomain2(rectangle('1/10','1/10','9/10','9/10'),[reverse(rectangle('1/4','1/4','3/4','3/4'))]),r=analyzeNurbsTrimRegularity3(surface(),d),p=r.patches[0]!;assert.equal(r.regular,false);assert.equal(p.edges.length,2);
  const expected=[['1/10','1/4'],['3/4','9/10']];p.edges.forEach((e,i)=>{assert.equal(e.start.u.compare(AlgebraicReal.fromRational(expected[i]![0]!)),0);assert.equal(e.end.u.compare(AlgebraicReal.fromRational(expected[i]![1]!)),0);assert.equal(e.location,'inside');assert.equal(e.sample.v.compare(AlgebraicReal.fromRational('1/2')),0);});assert.equal(p.points.length,4);
});
test('a boundary-coincident singular interval is retained as boundary',()=>{
  const r=analyzeNurbsTrimRegularity3(surface(),prepareNurbsParameterDomain2(rectangle('1/4','1/2','3/4','9/10'))),p=r.patches[0]!;assert.equal(p.edges.length,1);assert.equal(p.edges[0]!.location,'boundary');assert.equal(p.points.length,2);
});
test('a tangent boundary contact survives as an isolated retained point',()=>{
  const bottom=line('0','0','1','0'),top=nurbsCurve3(2,[point3(1n,0n,0n),point3('1/2',1n,0n),point3(0n,0n,0n)],[0n,0n,0n,1n,1n,1n]),r=analyzeNurbsTrimRegularity3(surface(),prepareNurbsParameterDomain2([bottom,top])),p=r.patches[0]!;assert.equal(p.edges.length,0);assert.equal(p.points.length,1);assert.equal(p.points[0]!.u.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(p.points[0]!.v.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(r.regular,false);
});
test('algebraic boundary cuts of an irrational singular line remain exact',()=>{
  const s=nurbsSurface3(1,3,[0n,1n].map(u=>['0','-1/6','-1/3','-1/6'].map(y=>point3(u,y,0n))),K,[0n,0n,0n,0n,1n,1n,1n,1n]),a=line('0','0','1','0'),b=line('1','0','0','1'),c=line('0','1','0','0'),r=analyzeNurbsTrimRegularity3(s,prepareNurbsParameterDomain2([a,b,c])),p=r.patches[0]!,root=AlgebraicReal.fromRational('1/2').sqrt();assert.equal(p.edges.length,1);assert.equal(p.edges[0]!.end.u.compare(root.affine(-1n,1n)),0);assert.equal(p.edges[0]!.end.v.compare(root),0);
});
test('wholly singular patches retain an implicit region; unused singular patches are empty',()=>{
  const all=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,0n,0n)],[point3(1n,0n,0n),point3(1n,0n,0n)]],K,K),d=prepareNurbsParameterDomain2(rectangle('1/4','1/4','3/4','3/4')),r=analyzeNurbsTrimRegularity3(all,d);assert.ok(r.patches[0]!.region);assert.equal(r.regular,false);
  const partial=nurbsSurface3(1,1,[0,1,1,2].map((x,i)=>[point3(BigInt(x),0n,0n),point3(BigInt(x),i<2?0n:1n,0n)]),[0n,0n,'1/2','1/2',1n,1n],K),trim=prepareNurbsParameterDomain2(rectangle('3/5','1/4','9/10','3/4')),q=analyzeNurbsTrimRegularity3(partial,trim);assert.equal(q.regular,true);assert.equal(q.patches[0]!.region,null);assert.equal(q.support.continuous,false);
});
test('domain geometry is revalidated and excursions outside the surface are rejected',()=>{
  const d=prepareNurbsParameterDomain2(rectangle('1/4','1/4','3/4','3/4')),forged={...d,locate:()=> 'outside' as const},r=analyzeNurbsTrimRegularity3(surface(),forged);assert.equal(r.regular,false);assert.throws(()=>analyzeNurbsTrimRegularity3(surface(),prepareNurbsParameterDomain2(rectangle('-1','0','2','1'))),/domain/);
});

test('retained edge evaluation rejects excluded hole intervals and preserves exact spatial images',()=>{
  const r=analyzeNurbsTrimRegularity3(surface(),prepareNurbsParameterDomain2(rectangle('1/10','1/10','9/10','9/10'),[reverse(rectangle('1/4','1/4','3/4','3/4'))]));
  const q=evaluateNurbsTrimSingularEdge3(r,0,0,'1/5');assert.equal(q.point.x.compare(AlgebraicReal.fromRational('1/5')),0);assert.equal(q.point.y.sign(),0);assert.equal(q.point.z.sign(),0);
  assert.throws(()=>evaluateNurbsTrimSingularEdge3(r,0,0,'1/2'),/outside/);assert.throws(()=>evaluateNurbsTrimSingularEdge3({...r},0,0,'1/5'),/factory/);assert.throws(()=>evaluateNurbsTrimSingularEdge3(r,99,0,'1/5'),/index/);assert.throws(()=>evaluateNurbsTrimSingularEdge3(r,0,-1,'1/5'),/index/);
});

test('holes remove both finite-system and shared-polynomial isolated singularities',()=>{
  const square=['1/4','-1/4','1/4'].map(Rational.parse),linear=['-1/2','0','1/2'].map(Rational.parse),d=prepareNurbsParameterDomain2(rectangle('1/10','1/10','9/10','9/10')),withHole=prepareNurbsParameterDomain2(d.outer,[reverse(rectangle('1/4','1/4','3/4','3/4'))]);
  for(const mode of ['finite','shared']){
    const s=nurbsSurface3(2,2,square.map((a,i)=>square.map((b,j)=>mode==='finite'?point3(a,b,linear[i]!.mul(linear[j]!)):point3(a.sub(b),linear[i]!.mul(linear[j]!).mul(new Rational(2n)),0n))),[0n,0n,0n,1n,1n,1n],[0n,0n,0n,1n,1n,1n]);
    assert.equal(analyzeNurbsTrimRegularity3(s,d).regular,false);const r=analyzeNurbsTrimRegularity3(s,withHole);assert.equal(r.regular,true);assert.equal(r.patches[0]!.points.length,0);
  }
});
test('a whole closed singular component inside a hole disappears even without boundary crossings',()=>{
  const A=['0','-1/2','0'].map(Rational.parse),G=['0','49/300','4/25','97/300'].map(Rational.parse),s=nurbsSurface3(2,3,A.map((a,i)=>G.map((g,j)=>point3(new Rational(BigInt(i),2n),g.add(a.mul(new Rational(BigInt(j),3n))),0n))),[0n,0n,0n,1n,1n,1n],[0n,0n,0n,0n,1n,1n,1n,1n]),outer=rectangle('1/10','1/10','9/10','9/10'),without=analyzeNurbsTrimRegularity3(s,prepareNurbsParameterDomain2(outer)),withHole=analyzeNurbsTrimRegularity3(s,prepareNurbsParameterDomain2(outer,[reverse(rectangle('1/4','1/4','3/4','3/4'))]));assert.equal(without.regular,false);assert.ok(without.patches[0]!.edges.length>0);assert.equal(withHole.regular,true);
});
test('a wholly singular patch touching the trim only on its boundary is retained without dimension claims',()=>{
  const s=nurbsSurface3(1,1,[0,1,1,2].map((x,i)=>[point3(BigInt(x),0n,0n),point3(BigInt(x),i<2?0n:1n,0n)]),[0n,0n,'1/2','1/2',1n,1n],K),r=analyzeNurbsTrimRegularity3(s,prepareNurbsParameterDomain2(rectangle('1/2','1/4','3/4','3/4')));assert.equal(r.regular,false);assert.ok(r.patches[0]!.region);assert.equal(r.patches[0]!.points[0]!.u.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(r.patches[1]!.regular,true);
});
test('vertical singular edges are cut and evaluated by v rather than u',()=>{
  const s=nurbsSurface3(2,1,['1/4','-1/4','1/4'].map(x=>[point3(x,0n,0n),point3(x,1n,0n)]),[0n,0n,0n,1n,1n,1n],K),r=analyzeNurbsTrimRegularity3(s,prepareNurbsParameterDomain2(rectangle('1/10','1/10','9/10','9/10'),[reverse(rectangle('1/4','1/4','3/4','3/4'))])),p=r.patches[0]!;assert.equal(p.edges.length,2);assert.equal(p.edges[0]!.endParameter.compare(AlgebraicReal.fromRational('1/4')),0);assert.equal(p.edges[1]!.startParameter.compare(AlgebraicReal.fromRational('3/4')),0);const q=evaluateNurbsTrimSingularEdge3(r,0,1,'4/5');assert.equal(q.u.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(q.v.compare(AlgebraicReal.fromRational('4/5')),0);
});
test('events at the same u on distinct implicit branches are assigned to the correct branch',()=>{
  const A=['0','-1/2','0'].map(Rational.parse),G=['0','49/300','4/25','97/300'].map(Rational.parse),s=nurbsSurface3(2,3,A.map((a,i)=>G.map((g,j)=>point3(new Rational(BigInt(i),2n),g.add(a.mul(new Rational(BigInt(j),3n))),0n))),[0n,0n,0n,1n,1n,1n],[0n,0n,0n,0n,1n,1n,1n,1n]),r=analyzeNurbsTrimRegularity3(s,prepareNurbsParameterDomain2(rectangle('9/20','9/20','11/20','9/10'))),p=r.patches[0]!;assert.equal(p.edges.length,1);assert.equal(p.edges[0]!.start.u.compare(AlgebraicReal.fromRational('9/20')),0);assert.equal(p.edges[0]!.end.u.compare(AlgebraicReal.fromRational('11/20')),0);assert.equal(p.edges[0]!.sample.v.compare(AlgebraicReal.fromRational('1/2')),1);assert.equal(p.points.length,2);
});
