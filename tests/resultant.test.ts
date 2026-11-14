import test from 'node:test';
import assert from 'node:assert/strict';
import {Polynomial,polynomialResultant} from '../dist/index.js';
import {resultantInParameter,sumElimination,productElimination} from '../dist/numeric/resultant.js';
const p=(...xs:bigint[])=>new Polynomial(xs);
function determinant(a:readonly (readonly bigint[])[]):bigint {
 const n=a.length,used=new Set<number>(),permutation:number[]=[];let result=0n;
 function visit(){
  if(permutation.length===n){
   let term=1n,inversions=0;
   permutation.forEach((j,i)=>{term*=a[i]![j]!;for(let k=i+1;k<n;k++)if(j>permutation[k]!)inversions++;});
   result+=inversions%2?-term:term;return;
  }
  for(let j=0;j<n;j++)if(!used.has(j)){used.add(j);permutation.push(j);visit();permutation.pop();used.delete(j);}
 }
 visit();return result;
}
test('rational resultants match independent raw BigInt Leibniz determinants, including row pivoting',()=>{
 let seed=87231;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 const degreePairs=new Set<string>();
 for(let trial=0;trial<60;trial++){
  const a=Array.from({length:1+trial%4},()=>BigInt(next()%9)-4n),b=Array.from({length:1+Math.floor(trial/4)%4},()=>BigInt(next()%9)-4n);
  a[a.length-1] ||= 1n;b[b.length-1] ||= -1n;
  degreePairs.add(`${a.length-1},${b.length-1}`);
  const m=a.length-1,n=b.length-1,size=m+n,matrix=Array.from({length:size},()=>Array<bigint>(size).fill(0n));
  for(let i=0;i<n;i++)a.slice().reverse().forEach((c,j)=>{matrix[i]![i+j]=c;});
  for(let i=0;i<m;i++)b.slice().reverse().forEach((c,j)=>{matrix[n+i]![i+j]=c;});
  assert.equal(polynomialResultant(new Polynomial(a),new Polynomial(b)).toString(),String(determinant(matrix)));
 }
 assert.equal(degreePairs.size,16);
 assert.equal(polynomialResultant(p(2n,0n,2n),p(3n,1n,3n)).toString(),'4');
 assert.equal(polynomialResultant(p(),p(1n)).toString(),'0');assert.equal(polynomialResultant(p(2n),p(3n)).toString(),'1');
 assert.equal(polynomialResultant(p(2n),p(3n,2n,1n)).toString(),'4');assert.equal(polynomialResultant(p(1n,2n),p(2n,4n)).toString(),'0');
 assert.equal(polynomialResultant(new Polynomial(['-1/2','1/3']),new Polynomial(['2/7','3/5'])).toString(),'83/210');
});
test('symbolic sum/product elimination agrees with independent quadratic formulas and zero-root factors',()=>{
 assert.ok(sumElimination(p(-2n,0n,1n),p(-3n,0n,1n)).equals(p(1n,0n,-10n,0n,1n)));
 assert.ok(productElimination(p(-2n,0n,1n),p(-3n,0n,1n)).equals(p(36n,0n,-12n,0n,1n)));
 assert.ok(sumElimination(p(-2n,0n,1n),p(-2n,0n,1n)).equals(p(0n,0n,-8n,0n,1n)));
 assert.ok(productElimination(p(0n,-1n,1n),p(0n,-2n,1n)).equals(p(0n,0n,0n,-2n,1n)));
 assert.ok(resultantInParameter([p(0n,1n),p(1n)],[p(1n),p(0n,1n)]).equals(p(1n,0n,-1n)));
 const A=p(1n,1n),B=p(-2n,1n);
 assert.ok(resultantInParameter([A,p(),A],[B,p(1n),B]).equals(A.mul(A)));
});
test('symbolic polynomial pivots and exact Bareiss divisions match independent polynomial Leibniz determinants',()=>{
 let seed=9543;
 const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let trial=0;trial<20;trial++){
  const first=Array.from({length:3},()=>p(BigInt(next()%7)-3n,BigInt(next()%7)-3n));
  const second=Array.from({length:3},()=>p(BigInt(next()%7)-3n,BigInt(next()%7)-3n));
  if(first[2]!.degree<0)first[2]=p(1n);if(second[2]!.degree<0)second[2]=p(-1n);
  const matrix=[[first[2]!,first[1]!,first[0]!,p()],[p(),first[2]!,first[1]!,first[0]!],[second[2]!,second[1]!,second[0]!,p()],[p(),second[2]!,second[1]!,second[0]!]];
  let expected=p();
  for(let a=0;a<4;a++)for(let b=0;b<4;b++)for(let c=0;c<4;c++)for(let d=0;d<4;d++){
   const permutation=[a,b,c,d];if(new Set(permutation).size!==4)continue;
   let term=p(1n),inversions=0;
   permutation.forEach((j,i)=>{term=term.mul(matrix[i]![j]!);for(let k=i+1;k<4;k++)if(j>permutation[k]!)inversions++;});
   expected=expected.add(inversions%2?term.neg():term);
  }
  assert.ok(resultantInParameter(first,second).equals(expected));
 }
});
