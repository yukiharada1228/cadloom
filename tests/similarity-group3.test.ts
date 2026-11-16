import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,line3,cylinder3,plane3,similarityTransform3,composeSimilarityTransforms3,inverseSimilarityTransform3,transformPointBySimilarity3,transformVectorBySimilarity3,transformBody3,createClippedCylinderBody3,restoreBody3,serializeBody3,locateBody3,intersectBodyLine3} from '../dist/index.js';
const O=point3(0n,0n,0n),X=point3(1n,0n,0n),Y=point3(0n,1n,0n),Z=point3(0n,0n,1n);
const a=()=>similarityTransform3([point3('6/5','8/5',0n),point3('-8/5','6/5',0n),point3(0n,0n,-2n)],point3('1/3','-2/7','5/11'));
const b=()=>similarityTransform3([Z,X,Y],point3(-3n,2n,1n));
test('composition order, inverse and associativity hold exactly on rational points and vectors',()=>{
 const A=a(),B=b(),C=similarityTransform3([X,Y,Z],point3(9n,-4n,2n)),AB=composeSimilarityTransforms3(A,B),inverse=inverseSimilarityTransform3(A),left=composeSimilarityTransforms3(AB,C),right=composeSimilarityTransforms3(A,composeSimilarityTransforms3(B,C));
 for(let x=-3;x<=3;x++)for(let y=-2;y<=2;y++)for(let z=-2;z<=2;z++){
  const p=point3(`${2*x+1}/7`,`${3*y-1}/11`,`${5*z+2}/13`);
  assert.deepEqual(transformPointBySimilarity3(AB,p),transformPointBySimilarity3(B,transformPointBySimilarity3(A,p)));
  assert.deepEqual(transformVectorBySimilarity3(AB,p),transformVectorBySimilarity3(B,transformVectorBySimilarity3(A,p)));
  assert.deepEqual(transformPointBySimilarity3(inverse,transformPointBySimilarity3(A,p)),p);
  assert.deepEqual(transformPointBySimilarity3(A,transformPointBySimilarity3(inverse,p)),p);
  assert.deepEqual(transformPointBySimilarity3(left,p),transformPointBySimilarity3(right,p));
 }
 assert.equal(AB.scaleSquared.toString(),'4');assert.equal(inverse.scaleSquared.toString(),'1/4');
 for(const t of [composeSimilarityTransforms3(A,inverse),composeSimilarityTransforms3(inverse,A)]){assert.deepEqual(t.columns,[X,Y,Z]);assert.deepEqual(t.translation,O);}
 assert.throws(()=>inverseSimilarityTransform3({...A}),RangeError);assert.throws(()=>composeSimilarityTransforms3({...A},B),RangeError);assert.throws(()=>composeSimilarityTransforms3(A,{...B}),RangeError);
});
test('composed and sequential Body transforms agree after replay, and inversion restores geometry',()=>{
 const source=createClippedCylinderBody3(cylinder3(line3(O,Z),1n),-1n,1n,[{plane:plane3(1n,0n,0n,0n),side:-1}]),A=a(),B=b();
 const direct=restoreBody3(serializeBody3(transformBody3(source,composeSimilarityTransforms3(A,B)))),sequential=restoreBody3(serializeBody3(transformBody3(transformBody3(source,A),B))),restored=restoreBody3(serializeBody3(transformBody3(transformBody3(source,A),inverseSimilarityTransform3(A))));
 for(const p of [point3('-1/2','1/4','1/3'),point3('1/2','1/4','1/3'),point3(0n,'1/2',0n),point3(2n,0n,0n)]){
  const q=transformPointBySimilarity3(composeSimilarityTransforms3(A,B),p);assert.equal(locateBody3(direct,q),locateBody3(source,p));assert.equal(locateBody3(sequential,q),locateBody3(source,p));assert.equal(locateBody3(restored,p),locateBody3(source,p));
 }
 const origin=point3(-2n,'1/3','1/4'),original=intersectBodyLine3(source,origin,X),again=intersectBodyLine3(restored,origin,X);assert.equal(original.hits.length,again.hits.length);original.hits.forEach((h,i)=>assert.equal(h.parameter.compare(again.hits[i]!.parameter),0));
});
