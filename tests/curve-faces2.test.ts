import test from 'node:test';
import assert from 'node:assert/strict';
import {point2,segment2,circle2,fullCircleArc2,buildCurveFaces2,buildFaces,algebraicCoordinates2,AlgebraicReal,Polynomial,isolateRealRoots,Rational} from '../dist/index.js';
import type {PlanarCurve2,CurveFaceArrangement2,Point2,Segment2} from '../dist/index.js';
const circle=(x:bigint|string,y:bigint|string,r:bigint|string):PlanarCurve2=>({kind:'arc',arc:fullCircleArc2(circle2(point2(x,y),r))});
const segment=(x:bigint|string,y:bigint|string,X:bigint|string,Y:bigint|string):PlanarCurve2=>({kind:'segment',segment:segment2(point2(x,y),point2(X,Y))});
function verify(input:readonly PlanarCurve2[],expected?:number):CurveFaceArrangement2 {
 const a=buildCurveFaces2(input);if(expected!==undefined)assert.equal(a.faces.length,expected);
 assert.equal(a.faces[0]!.bounded,false);assert.equal(a.boundaryFaces.length,a.boundaries.length);assert.equal(a.halfEdgeFaces.length,a.halfEdges.length);
 const boundaries=new Set<number>(),isolated=new Set<number>();
 a.faces.forEach((f,id)=>{
  assert.equal(f.bounded,id!==0);assert.deepEqual(a.locate(f.sample),{kind:'face',face:id});
  f.boundaries.forEach(b=>{assert.ok(!boundaries.has(b));boundaries.add(b);assert.equal(a.boundaryFaces[b],id);});
  f.isolatedVertices.forEach(v=>{assert.ok(!isolated.has(v));isolated.add(v);assert.equal(a.outgoing[v]!.length,0);assert.deepEqual(a.vertexFaces[v],[id]);});
  assert.ok(Object.isFrozen(f)&&Object.isFrozen(f.boundaries)&&Object.isFrozen(f.isolatedVertices)&&Object.isFrozen(f.sample));
 });
 assert.equal(boundaries.size,a.boundaries.length);
 a.halfEdges.forEach((h,id)=>assert.equal(a.halfEdgeFaces[id],a.boundaryFaces[h.boundary]));
 a.vertices.forEach((v,id)=>{
  assert.deepEqual(a.locate(v.point),{kind:'vertex',vertex:id});
  if(a.outgoing[id]!.length)assert.deepEqual(a.vertexFaces[id],[...new Set(a.outgoing[id]!.map(h=>a.halfEdgeFaces[h]!))].sort((x,y)=>x-y));
  else assert.ok(isolated.has(id));
 });
 const adjacent=a.faces.map(()=>new Set<number>());
 a.edges.forEach((_,i)=>{const left=a.halfEdgeFaces[2*i]!,right=a.halfEdgeFaces[2*i+1]!;adjacent[left]!.add(right);adjacent[right]!.add(left);});
 const seen=new Set([0]),pending=[0];while(pending.length){for(const face of adjacent[pending.pop()!]!)if(!seen.has(face)){seen.add(face);pending.push(face);}}
 assert.equal(seen.size,a.faces.length);
 assert.ok(Object.isFrozen(a)&&Object.isFrozen(a.faces)&&Object.isFrozen(a.vertexFaces)&&a.vertexFaces.every(Object.isFrozen));return a;
}
const faceAt=(a:CurveFaceArrangement2,p:Point2)=>{const result=a.locate(p);assert.equal(result.kind,'face');return result.kind==='face'?result.face:-1;};
function rectangle(lo:bigint,hi:bigint):PlanarCurve2[]{return [segment(lo,lo,hi,lo),segment(hi,lo,hi,hi),segment(hi,hi,lo,hi),segment(lo,hi,lo,lo)];}
test('nested/disconnected/tangent circles group boundary walks into the correct open faces',()=>{
 for(const configuration of [
  [{x:0n,y:0n,r:1n},{x:1n,y:0n,r:1n}],
  [{x:0n,y:0n,r:4n},{x:0n,y:0n,r:1n}],
  [{x:-2n,y:0n,r:1n},{x:2n,y:0n,r:1n}],
  [{x:0n,y:0n,r:1n},{x:2n,y:0n,r:1n}],
  [{x:0n,y:0n,r:1n},{x:'1/2',y:0n,r:'1/4'}],
 ]){
  const inside=(p:Point2,c:typeof configuration[number])=>{
   const dx=p.x.sub(Rational.parse(String(c.x))),dy=p.y.sub(Rational.parse(String(c.y)));
   return dx.mul(dx).add(dy.mul(dy)).compare(Rational.parse(String(c.r)));
  };
  const signature=(p:Point2)=>configuration.map(c=>inside(p,c)<0?'1':'0').join('');
  const expected=configuration[1]!.x===1n?4:3,a=verify(configuration.map(c=>circle(c.x,c.y,c.r)),expected);
  const mapping=new Map(a.faces.map((f,id)=>[signature(f.sample),id]));assert.equal(mapping.size,expected);
  for(let x=-10n;x<=10n;x++)for(let y=-6n;y<=6n;y++){
   const p=point2(new Rational(x,4n),new Rational(y,4n)),hit=a.locate(p);
   if(configuration.some(c=>inside(p,c)===0))assert.notEqual(hit.kind,'face');
   else {assert.equal(hit.kind,'face');if(hit.kind==='face')assert.equal(hit.face,mapping.get(signature(p)),`${configuration} ${x},${y}`);}
  }
 }
});
test('chords split a disk, while dangling tangencies remain in its exterior face',()=>{
 const a=verify([circle(0n,0n,1n),segment(0n,-2n,0n,2n)],3);
 const left=faceAt(a,point2('-1/2',0n)),right=faceAt(a,point2('1/2',0n));assert.notEqual(left,right);assert.notEqual(left,0);assert.notEqual(right,0);
 assert.equal(faceAt(a,point2(0n,3n)),0);assert.equal(a.locate(point2(0n,0n)).kind,'edge');
 const tangent=verify([circle(0n,0n,1n),segment(-2n,1n,2n,1n)],2),disk=faceAt(tangent,point2(0n,0n));assert.notEqual(disk,0);
 tangent.edges.forEach((e,id)=>{if(e.kind==='line')assert.deepEqual([tangent.halfEdgeFaces[2*id],tangent.halfEdgeFaces[2*id+1]],[0,0]);});
});
test('vertical-only components, tangent-event rays and algebraic isolated points belong to their containing faces',()=>{
 const root=isolateRealRoots(new Polynomial(['-1/2',0n,1n]))[1]!;
 const input:PlanarCurve2[]=[...rectangle(-2n,2n),circle(0n,0n,1n),segment(0n,'-3/4',0n,'-1/2'),segment(0n,0n,0n,'1/4'),segment(1n,'-3/4',1n,'-1/2'),segment('3/2',-1n,'3/2',1n),segment(5n,-1n,5n,1n),{kind:'point',point:algebraicCoordinates2(root,0n)},{kind:'point',point:point2('3/2','3/2')},{kind:'point',point:point2(8n,8n)}];
 const a=verify(input,3),disk=faceAt(a,point2('1/2',0n)),ring=faceAt(a,point2('7/4',0n));assert.notEqual(disk,ring);assert.notEqual(disk,0);assert.notEqual(ring,0);
 for(const [source,face] of [[5,disk],[6,disk],[7,ring],[8,ring],[9,0]])a.edges.forEach((e,id)=>{if(e.sources.includes(source!))assert.deepEqual([a.halfEdgeFaces[2*id],a.halfEdgeFaces[2*id+1]],[face,face]);});
 for(const [source,face] of [[10,disk],[11,ring],[12,0]]){const v=a.vertices.findIndex(v=>v.sources.includes(source!));assert.deepEqual(a.vertexFaces[v],[face]);assert.ok(a.faces[face!]!.isolatedVertices.includes(v));}
 assert.deepEqual(a.faces.map(f=>f.boundaries.length).sort((x,y)=>x-y),[2,3,4]);
});
test('general algebraic face/edge queries, isolated points and zero-width graphs have exact cell locations',()=>{
 const a=verify([circle(0n,0n,1n)],2),root=isolateRealRoots(new Polynomial(['-1/2',0n,1n]))[1]!;
 assert.equal(a.locate(algebraicCoordinates2(root,0n)).kind,'face');assert.equal(a.locate(algebraicCoordinates2(root,root)).kind,'edge');
 const p=algebraicCoordinates2(root,root.affine(2n));assert.deepEqual(a.locate(p),{kind:'face',face:0});
 const isolated=verify([{kind:'point',point:p}],1);assert.deepEqual(isolated.vertexFaces[0],[0]);assert.equal(isolated.locate(p).kind,'vertex');
 const vertical=verify([segment(0n,0n,0n,1n),segment(0n,2n,0n,3n)],1);assert.equal(vertical.locate(point2(0n,'1/2')).kind,'edge');assert.equal(vertical.locate(point2(0n,'3/2')).kind,'face');
 assert.equal(verify([],1).faces[0]!.isolatedVertices.length,0);
});
function compareStraight(segments:readonly Segment2[]){
 const old=buildFaces(segments),a=verify(segments.map(s=>({kind:'segment',segment:s})),old.faces.length),mapping=new Map<number,number>([[0,0]]);
 assert.equal(old.boundaries.length,a.boundaries.length);
 old.boundaryFaces.forEach((face,b)=>{const actual=a.boundaryFaces[b]!;if(mapping.has(face))assert.equal(mapping.get(face),actual);else mapping.set(face,actual);});
 assert.equal(mapping.size,old.faces.length);assert.equal(new Set(mapping.values()).size,mapping.size);
 old.faces.forEach((f,id)=>assert.deepEqual(a.faces[mapping.get(id)!]!.isolatedVertices,f.isolatedVertices));
 return a;
}
test('curved sweep grouping agrees with the independent area/winding straight-edge face builder',()=>{
 const rings=[...rectangle(-3n,3n),...rectangle(-1n,1n),segment(0n,'-1/2',0n,'1/2'),{kind:'point' as const,point:point2(5n,5n)}];
 verify(rings,3);
 compareStraight(rings.filter((x):x is Extract<PlanarCurve2,{kind:'segment'}>=>x.kind==='segment').map(c=>c.segment));
 let seed=7213;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let trial=0;trial<50;trial++){
  const segments=Array.from({length:7},()=>segment2(point2(BigInt(next()%7)-3n,BigInt(next()%7)-3n),point2(BigInt(next()%7)-3n,BigInt(next()%7)-3n)));
  compareStraight(segments);
 }
});
test('mixed face grouping is stable under input permutation and handles very thin annuli',()=>{
 const input:PlanarCurve2[]=[circle(0n,0n,4n),circle(0n,0n,1n),segment(0n,'-1/2',0n,'1/2'),{kind:'point',point:point2('3/2',0n)}];
 const a=verify(input,3),b=verify(input.slice().reverse(),3);assert.deepEqual(a.boundaryFaces,b.boundaryFaces);assert.deepEqual(a.halfEdgeFaces,b.halfEdgeFaces);
 const epsilon=Rational.parse('1/1'+'0'.repeat(30)),r=new Rational(1n).sub(epsilon),thin=verify([circle(0n,0n,1n),{kind:'arc',arc:fullCircleArc2(circle2(point2(0n,0n),r.mul(r)))}],3);
 const between=point2(new Rational(1n).sub(epsilon.div(new Rational(2n))),0n),location=thin.locate(between);assert.equal(location.kind,'face');if(location.kind==='face'){assert.notEqual(location.face,0);assert.notEqual(location.face,faceAt(thin,point2(0n,0n)));}
});
