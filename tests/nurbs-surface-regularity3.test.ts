import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,point3,nurbsSurface3,analyzeNurbsSurfaceRegularity3,differentialNurbsSurface3,evaluateNurbsSurface3,insertNurbsSurfaceKnot3,reverseNurbsSurface3,AlgebraicReal} from '../dist/index.js';
// Independent power-to-tensor-Bernstein conversion on [0,1]² for fixtures.
type Terms=readonly (readonly [number,number,string])[];
const choose=(n:number,k:number)=>{let r=1n;for(let i=1;i<=k;i++)r=r*BigInt(n-i+1)/BigInt(i);return r;};
function polynomialSurface(x:Terms,y:Terms,z:Terms,p:number,q:number){
  const coefficient=(terms:Terms,i:number,j:number)=>terms.reduce((sum,[a,b,c])=>a<=i&&b<=j?sum.add(Rational.parse(c).mul(new Rational(choose(i,a),choose(p,a))).mul(new Rational(choose(j,b),choose(q,b)))):sum,new Rational(0n));
  const points=Array.from({length:p+1},(_,i)=>Array.from({length:q+1},(_,j)=>point3(coefficient(x,i,j),coefficient(y,i,j),coefficient(z,i,j))));
  return nurbsSurface3(p,q,points,[...Array(p+1).fill(0n),...Array(p+1).fill(1n)],[...Array(q+1).fill(0n),...Array(q+1).fill(1n)]);
}
const saddle=()=>polynomialSurface([[1,0,'1']],[[0,1,'1']],[[1,1,'1']],1,1);
test('regular saddle and weighted surface reports match exact differential values',()=>{
  const s=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],[0n,0n,1n,1n],[0n,0n,1n,1n],[[1n,2n],[3n,4n]]),r=analyzeNurbsSurfaceRegularity3(s);
  assert.equal(r.everyPatchRegular,true);assert.equal(r.continuous,true);const p=r.patches[0]!,W=p.patch.weight;
  for(let i=0;i<=4;i++)for(let j=0;j<=4;j++){const u=new Rational(BigInt(i),4n),v=new Rational(BigInt(j),4n),d=differentialNurbsSurface3(s,u,v),den=W.evaluate(u,v).mul(W.evaluate(u,v)).mul(W.evaluate(u,v));for(const [key,f] of [['x',p.normalX],['y',p.normalY],['z',p.normalZ]] as const)assert.equal(d.normal[key].compare(AlgebraicReal.fromRational(f.evaluate(u,v).div(den))),0);}
});
test('an irrational singular line is represented as a bounded exact curve, not sampled away',()=>{
  const s=polynomialSurface([[1,0,'1']],[[0,3,'1/3'],[0,1,'-1/2']],[],1,3),r=analyzeNurbsSurfaceRegularity3(s),p=r.patches[0]!,a=AlgebraicReal.fromRational('1/2').sqrt();assert.equal(r.everyPatchRegular,false);assert.equal(p.points.length,0);assert.equal(p.locus?.kind,'curve');assert.equal(p.locus!.edges.length,1);for(const v of p.locus!.vertices)assert.equal(v.v.compare(a),0);assert.equal(differentialNurbsSurface3(s,'1/3',a).regular,false);
});
test('three normal equations retain an isolated singular point with its exact spatial image',()=>{
  const s=polynomialSurface([[2,0,'1'],[1,0,'-1'],[0,0,'1/4']],[[0,2,'1'],[0,1,'-1'],[0,0,'1/4']],[[1,1,'1'],[1,0,'-1/2'],[0,1,'-1/2'],[0,0,'1/4']],2,2),r=analyzeNurbsSurfaceRegularity3(s),p=r.patches[0]!;assert.equal(r.everyPatchRegular,false);assert.equal(p.points.length,1);assert.equal(p.points[0]!.u.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(p.points[0]!.v.compare(AlgebraicReal.fromRational('1/2')),0);for(const k of ['x','y','z'] as const)assert.equal(p.points[0]!.point[k].sign(),0);
});
test('a shared polynomial may have only an isolated real zero or no real zeros',()=>{
  const isolated=polynomialSurface([[1,0,'1']],[[2,1,'1'],[1,1,'-1'],[0,1,'1/2'],[0,3,'1/3'],[0,2,'-1/2']],[],2,3),a=analyzeNurbsSurfaceRegularity3(isolated).patches[0]!;assert.equal(a.regular,false);assert.equal(a.points.length,0);assert.equal(a.locus!.vertices.length,1);assert.equal(a.locus!.edges.length,0);
  const empty=polynomialSurface([[1,0,'1']],[[0,3,'1/3'],[0,1,'1']],[],1,3),b=analyzeNurbsSurfaceRegularity3(empty).patches[0]!;assert.equal(b.regular,true);assert.equal(b.locus!.vertices.length,0);
});
test('rank-one and constant surfaces retain a whole singular area',()=>{
  for(const x of [[],[[1,0,'1']]] as Terms[]){const r=analyzeNurbsSurfaceRegularity3(polynomialSurface(x,[],[],1,1));assert.equal(r.everyPatchRegular,false);assert.equal(r.patches[0]!.locus!.kind,'area');}
});
test('refinement and reversal preserve regularity while reporting every interior seam',()=>{
  const s=insertNurbsSurfaceKnot3(insertNurbsSurfaceKnot3(saddle(),'u','1/3',2),'v','2/3',2),r=analyzeNurbsSurfaceRegularity3(s);assert.equal(r.patches.length,4);assert.equal(r.seams.length,4);assert.equal(r.continuous,true);assert.equal(r.everyPatchRegular,true);assert.equal(analyzeNurbsSurfaceRegularity3(reverseNurbsSurface3(s,'u')).everyPatchRegular,true);
});
test('whole seam identity detects an interior gap even when both endpoints match',()=>{
  // Left z=0; right boundary z=v(1-v), zero at both endpoints only.
  const s=nurbsSurface3(1,2,[0,1,1,2].map((x,i)=>[point3(BigInt(x),0n,0n),point3(BigInt(x),'1/2',i<2?0n:'1/2'),point3(BigInt(x),1n,0n)]),[0n,0n,'1/2','1/2',1n,1n],[0n,0n,0n,1n,1n,1n]),r=analyzeNurbsSurfaceRegularity3(s);assert.equal(r.everyPatchRegular,true);assert.equal(r.continuous,false);assert.equal(r.seams.length,1);assert.equal(r.seams[0]!.continuous,false);
});
test('singularities exactly on the closed patch boundary are retained',()=>{
  const s=polynomialSurface([[2,0,'1']],[[0,1,'1']],[],2,1),r=analyzeNurbsSurfaceRegularity3(s);assert.equal(r.everyPatchRegular,false);const g=r.patches[0]!.locus!;assert.equal(g.edges.length,1);for(const p of g.vertices)assert.equal(p.u.sign(),0);
});
test('a regular noninjective cylinder keeps distinct parameters and does not imply a surface embedding',()=>{
  const xy=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1],[1,0]],w=[1n,1n,2n,2n,4n,4n,8n,8n,16n],s=nurbsSurface3(2,1,xy.map(([x,y])=>[point3(BigInt(x!),BigInt(y!),0n),point3(BigInt(x!),BigInt(y!),1n)]),[0n,0n,0n,1n,1n,2n,2n,3n,3n,4n,4n,4n],[0n,0n,1n,1n],w.map(a=>[a,a])),r=analyzeNurbsSurfaceRegularity3(s);assert.equal(r.everyPatchRegular,true);assert.equal(r.continuous,true);
  const a=evaluateNurbsSurface3(s,0n,'1/2'),b=evaluateNurbsSurface3(s,4n,'1/2');for(const key of ['x','y','z'] as const)assert.equal(a[key].compare(b[key]),0);
});
test('a continuous folded seam may have regular patches with different one-sided normals',()=>{
  const s=nurbsSurface3(1,1,[0,1,1,2].map((x,i)=>[point3(BigInt(x),0n,i<3?0n:1n),point3(BigInt(x),1n,i<3?0n:1n)]),[0n,0n,'1/2','1/2',1n,1n],[0n,0n,1n,1n]),r=analyzeNurbsSurfaceRegularity3(s);assert.equal(r.everyPatchRegular,true);assert.equal(r.continuous,true);assert.equal(r.patches[0]!.normalX.evaluate('1/2','1/2').sign(),0);assert.equal(r.patches[1]!.normalX.evaluate('1/2','1/2').sign(),-1);
});
