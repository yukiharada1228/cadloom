import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsCurve3,nurbsSurface3,liftNurbsSurfaceBoundary3,evaluateNurbsSurfaceBoundaryPiece3,nurbsSurfaceBoundaryMatchesCurve3,evaluateNurbsSurface3,evaluateNurbsCurve3,AlgebraicReal,insertNurbsKnot3,insertNurbsSurfaceKnot3} from '../dist/index.js';
const knots=[0n,0n,1n,1n],line=(a:ReturnType<typeof point3>,b:ReturnType<typeof point3>)=>nurbsCurve3(1,[a,b],knots),real=(x:string)=>AlgebraicReal.fromRational(x);
const saddle=()=>nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],knots,knots);
function equal(a:{x:AlgebraicReal;y:AlgebraicReal;z:AlgebraicReal},b:{x:AlgebraicReal;y:AlgebraicReal;z:AlgebraicReal}){for(const k of ['x','y','z'] as const)assert.equal(a[k].compare(b[k]),0);}
test('surface boundary composition raises degree and certifies whole parameter correspondence',()=>{
  const b=liftNurbsSurfaceBoundary3(saddle(),line(point3(0n,0n,0n),point3(1n,1n,0n)));
  assert.equal(b.pieces.length,1);assert.equal(b.pieces[0]!.z.degree,2);
  const correct=nurbsCurve3(2,[point3(0n,0n,0n),point3('1/2','1/2',0n),point3(1n,1n,1n)],[0n,0n,0n,1n,1n,1n]);
  assert.equal(nurbsSurfaceBoundaryMatchesCurve3(b,correct),true);assert.equal(nurbsSurfaceBoundaryMatchesCurve3(b,insertNurbsKnot3(correct,'1/3',2)),true);
  // Same endpoints are insufficient: a chord is not the lifted parabola.
  assert.equal(nurbsSurfaceBoundaryMatchesCurve3(b,line(point3(0n,0n,0n),point3(1n,1n,1n))),false);
  const a=real('1/2').sqrt();equal(evaluateNurbsSurfaceBoundaryPiece3(b,0,a),{x:a,y:a,z:real('1/2')});
});
test('algebraic knot preimages split a nonlinear parameter curve exactly',()=>{
  const s=insertNurbsSurfaceKnot3(saddle(),'u','1/2'),c=nurbsCurve3(2,[point3(0n,0n,0n),point3(0n,'1/2',0n),point3(1n,1n,0n)],[0n,0n,0n,1n,1n,1n]),b=liftNurbsSurfaceBoundary3(s,c),a=real('1/2').sqrt();
  assert.equal(b.pieces.length,2);assert.equal(b.pieces[0]!.endParameter.compare(a),0);assert.equal(b.pieces[1]!.startParameter.compare(a),0);
  equal(evaluateNurbsSurfaceBoundaryPiece3(b,0,a),evaluateNurbsSurfaceBoundaryPiece3(b,1,a));
  equal(evaluateNurbsSurfaceBoundaryPiece3(b,1,a),{x:real('1/2'),y:a,z:a.affine('1/2')});
});
test('rational weights preserve exact single-source composition under independent surface evaluation',()=>{
  const s=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,2n)]],knots,knots,[[1n,2n],[3n,4n]]),c=nurbsCurve3(2,[point3(0n,0n,0n),point3('1/3','4/5',0n),point3(1n,1n,0n)],[0n,0n,0n,1n,1n,1n],[1n,3n,2n]),b=liftNurbsSurfaceBoundary3(s,c);
  for(const t of ['0','1/7','2/5','3/4','1']){const uv=evaluateNurbsCurve3(c,t);equal(evaluateNurbsSurfaceBoundaryPiece3(b,0,t),evaluateNurbsSurface3(s,uv.x,uv.y));}
});
test('full-multiplicity surface seams retain distinct closed one-sided images',()=>{
  const s=nurbsSurface3(1,1,[0n,1n,1n,2n].map((x,i)=>[point3(x,0n,i<2?0n:3n),point3(x,1n,i<2?0n:3n)]),[0n,0n,'1/2','1/2',1n,1n],knots),c=line(point3(0n,'1/2',0n),point3(1n,'1/2',0n)),b=liftNurbsSurfaceBoundary3(s,c);
  assert.equal(b.pieces.length,2);assert.equal(evaluateNurbsSurfaceBoundaryPiece3(b,0,'1/2').z.compare(real('0')),0);assert.equal(evaluateNurbsSurfaceBoundaryPiece3(b,1,'1/2').z.compare(real('3')),0);
  const seam=line(point3('1/2',0n,0n),point3('1/2',1n,0n)),left=liftNurbsSurfaceBoundary3(s,seam,{uSide:'left'}),right=liftNurbsSurfaceBoundary3(s,seam);
  assert.equal(evaluateNurbsSurfaceBoundaryPiece3(left,0,'1/3').z.sign(),0);assert.equal(evaluateNurbsSurfaceBoundaryPiece3(right,0,'1/3').z.compare(real('3')),0);
});
test('tangent contact with a knot is retained and domain excursions are rejected',()=>{
  const s=insertNurbsSurfaceKnot3(saddle(),'u','1/2'),touch=nurbsCurve3(2,[point3('1/4',0n,0n),point3('3/4','1/2',0n),point3('1/4',1n,0n)],[0n,0n,0n,1n,1n,1n]),b=liftNurbsSurfaceBoundary3(s,touch);
  assert.equal(b.pieces.length,2);assert.equal(b.pieces[0]!.patch.uSpan,b.pieces[1]!.patch.uSpan);assert.equal(b.pieces[0]!.endParameter.compare(real('1/2')),0);
  const excursion=nurbsCurve3(2,[point3('1/2',0n,0n),point3(2n,'1/2',0n),point3('1/2',1n,0n)],[0n,0n,0n,1n,1n,1n]);assert.throws(()=>liftNurbsSurfaceBoundary3(saddle(),excursion),/domain/);
});
test('owned snapshots, exact parameter domain, indices and knot-side validation',()=>{
  const c=line(point3(0n,0n,0n),point3(1n,1n,0n)),b=liftNurbsSurfaceBoundary3(saddle(),c);assert.ok(Object.isFrozen(b));assert.ok(Object.isFrozen(b.pieces));
  assert.throws(()=>evaluateNurbsSurfaceBoundaryPiece3({...b},0,0n),/factory/);assert.throws(()=>evaluateNurbsSurfaceBoundaryPiece3(b,-1,0n),/index/);assert.throws(()=>evaluateNurbsSurfaceBoundaryPiece3(b,0,2n),/outside/);
  assert.throws(()=>liftNurbsSurfaceBoundary3(saddle(),line(point3(0n,0n,1n),point3(1n,1n,1n))),/z=0/);
  assert.throws(()=>liftNurbsSurfaceBoundary3(saddle(),c,{uSide:'invalid' as 'left'}),/side/);
  const differentDomain=nurbsCurve3(1,[point3(0n,0n,0n),point3(1n,1n,1n)],[0n,0n,2n,2n]);assert.equal(nurbsSurfaceBoundaryMatchesCurve3(b,differentDomain),false);
});
test('identical image sets with different parameterizations do not pass correspondence certification',()=>{
  const s=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,0n)]],knots,knots),b=liftNurbsSurfaceBoundary3(s,line(point3(0n,0n,0n),point3(1n,0n,0n))),reparameterized=nurbsCurve3(2,[point3(0n,0n,0n),point3(0n,0n,0n),point3(1n,0n,0n)],[0n,0n,0n,1n,1n,1n]);
  assert.equal(nurbsSurfaceBoundaryMatchesCurve3(b,reparameterized),false);
});
test('parameter jumps retain their separate span images rather than inserting a chord',()=>{
  const c=nurbsCurve3(1,[point3(0n,0n,0n),point3('1/4',0n,0n),point3('3/4',1n,0n),point3(1n,1n,0n)],[0n,0n,'1/2','1/2',1n,1n]),b=liftNurbsSurfaceBoundary3(saddle(),c);
  assert.equal(b.pieces.length,2);assert.equal(evaluateNurbsSurfaceBoundaryPiece3(b,0,'1/2').x.compare(real('1/4')),0);assert.equal(evaluateNurbsSurfaceBoundaryPiece3(b,1,'1/2').x.compare(real('3/4')),0);
  const matching=nurbsCurve3(1,[point3(0n,0n,0n),point3('1/4',0n,0n),point3('3/4',1n,'3/4'),point3(1n,1n,1n)],[0n,0n,'1/2','1/2',1n,1n]);assert.equal(nurbsSurfaceBoundaryMatchesCurve3(b,matching),true);
});
test('64 weighted parameter curves agree with an independent bilinear point oracle and knot refinement',()=>{
  let state=271828;const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state;};
  const s=insertNurbsSurfaceKnot3(insertNurbsSurfaceKnot3(saddle(),'u','1/3'),'v','2/3');
  for(let n=0;n<64;n++){
    const points=Array.from({length:3},()=>point3(`${next()%13}/12`,`${next()%13}/12`,0n)),weights=Array.from({length:3},()=>BigInt(1+next()%5)),c=nurbsCurve3(2,points,[0n,0n,0n,1n,1n,1n],weights),b=liftNurbsSurfaceBoundary3(s,c);
    for(const t of ['0','1/4','1/2','3/4','1']){
      const a=real(t),uv=evaluateNurbsCurve3(c,t),p=b.pieces.findIndex(p=>a.compare(p.startParameter)>=0&&a.compare(p.endParameter)<=0);assert.ok(p>=0);equal(evaluateNurbsSurfaceBoundaryPiece3(b,p,t),{x:uv.x,y:uv.y,z:uv.x.mul(uv.y)});
    }
  }
});
