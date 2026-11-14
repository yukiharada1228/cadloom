import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,Polynomial,AlgebraicReal,isolateRealRoots,point3,vector3,planeFrame3,ellipse3,intersectEllipses3,compareAlgebraicPoints3,algebraicCoordinates3,pointOnEllipse3} from '../dist/index.js';
const O=point3(0n,0n,0n),U=vector3(1n,0n,0n),V=vector3(0n,1n,0n),frame=planeFrame3(O,U,V),real=(q:bigint|string)=>AlgebraicReal.fromRational(q);
const same=(p:Parameters<typeof algebraicCoordinates3>[0],q:Parameters<typeof algebraicCoordinates3>[1])=>algebraicCoordinates3(p,q,0n);
function pointSet(hit:ReturnType<typeof intersectEllipses3>,expected:ReturnType<typeof algebraicCoordinates3>[]){assert.equal(hit.kind,expected.length?'points':'none');if(hit.kind==='points'){assert.equal(hit.points.length,expected.length);for(const p of expected)assert.ok(hit.points.some(q=>compareAlgebraicPoints3(p,q)===0));}}
test('rational functions retain source algebraic dependence and remove zero-denominator conjugates',()=>{
 const p=new Polynomial([-2n,0n,1n]),x=isolateRealRoots(p)[1]!;
 assert.equal(x.rationalFunction(new Polynomial([0n,0n,1n])).compare(real(2n)),0);
 assert.equal(x.rationalFunction(new Polynomial([1n,1n]),new Polynomial([1n,-1n])).compare(x.affine(-2n,-3n)),0);
 const reducible=p.mul(new Polynomial([-1n,1n])),root=isolateRealRoots(reducible)[2]!;
 assert.equal(root.rationalFunction(new Polynomial([-1n,1n]),new Polynomial([-1n,1n])).compare(real(1n)),0);
 assert.throws(()=>x.rationalFunction(new Polynomial([1n]),p),RangeError);
 assert.equal(x.rationalFunction(p).compare(real(0n)),0);
});
test('rational image certificates stay at most source degree for independent polynomial powers',()=>{
 const p=new Polynomial([-2n,0n,0n,1n]),x=isolateRealRoots(p)[0]!;
 for(let i=0;i<=8;i++){
  const coefficients=Array<bigint>(i+1).fill(0n);coefficients[i]=1n;const result=x.rationalFunction(new Polynomial(coefficients));
  assert.ok(result.polynomial.degree<=p.degree);const remainder=i%3,factor=2n**BigInt(Math.floor(i/3));
  const expected=remainder===0?real(factor):remainder===1?x.affine(factor):x.rationalFunction(new Polynomial([0n,0n,1n])).affine(factor);
  assert.equal(result.compare(expected),0);
 }
});
test('coincident, disjoint, tangent and transverse spatial ellipses return exact sets',()=>{
 const a=ellipse3(frame,4n,1n),scaled=ellipse3(planeFrame3(O,vector3(2n,0n,0n),V),1n,1n);
 assert.equal(intersectEllipses3(a,scaled).kind,'coincident');
 pointSet(intersectEllipses3(a,ellipse3(planeFrame3(point3(5n,0n,0n),U,V),4n,1n)),[]);
 pointSet(intersectEllipses3(a,ellipse3(planeFrame3(point3(4n,0n,0n),U,V),4n,1n)),[same(2n,0n)]);
 const vertical=ellipse3(planeFrame3(O,U,vector3(0n,0n,1n)),4n,1n);pointSet(intersectEllipses3(a,vertical),[same(-2n,0n),same(2n,0n)]);
 pointSet(intersectEllipses3(a,ellipse3(planeFrame3(point3(0n,0n,1n),U,V),4n,1n)),[]);
});
test('four intersections and two points sharing x survive zero linear recovery coefficients',()=>{
 const a=ellipse3(frame,4n,1n),b=ellipse3(frame,1n,4n),s=real('4/5').sqrt(),expected=[same(s,s),same(s,s.neg()),same(s.neg(),s),same(s.neg(),s.neg())];
 const hit=intersectEllipses3(a,b);pointSet(hit,expected);pointSet(intersectEllipses3(b,a),expected);
 if(hit.kind==='points')for(const p of hit.points){assert.ok(pointOnEllipse3(p,a));assert.ok(pointOnEllipse3(p,b));}
});
test('mixed quadratic terms recover the correct y branch from each quartic root',()=>{
 const a=ellipse3(frame,1n,1n),b=ellipse3(planeFrame3(O,U,vector3(1n,1n,0n)),1n,1n),s=real('1/5').sqrt();
 const expected=[same(1n,0n),same(-1n,0n),same(s,s.affine(2n)),same(s.neg(),s.affine(-2n))];
 pointSet(intersectEllipses3(a,b),expected);pointSet(intersectEllipses3(b,a),expected);
});
test('translated circle intersections agree with an independent rational radical-axis oracle',()=>{
 for(let k=-5n;k<=5n;k++)if(k!==0n){
  const shift=new Rational(k,3n),a=ellipse3(frame,4n,4n),b=ellipse3(planeFrame3(point3(shift,0n,0n),U,V),4n,4n),x=shift.div(new Rational(2n)),y=AlgebraicReal.fromRational(new Rational(4n).sub(x.mul(x))).sqrt();
  pointSet(intersectEllipses3(a,b),[same(x,y),same(x,y.neg())]);
 }
});
test('irreducible quartic branches occupy four independently sign-bracketed real intervals',()=>{
 const a=ellipse3(frame,1n,1n),b=ellipse3(planeFrame3(point3('1/2',0n,0n),U,vector3(1n,1n,0n)),1n,1n),quartic=new Polynomial([9n,24n,-72n,-32n,80n]),intervals=[['-1','-1/2'],['-1/2','0'],['1/2','3/4'],['3/4','1']] as const;
 // Unit circle substitution into (x-y-1/2)^2+y^2=1 gives
 // (1-2x)y=x²+x-5/4; squaring yields this quartic.
 const hit=intersectEllipses3(a,b);assert.equal(hit.kind,'points');if(hit.kind!=='points')return;assert.equal(hit.points.length,4);
 for(const [lo,hi] of intervals){assert.equal(quartic.evaluate(lo).sign()*quartic.evaluate(hi).sign(),-1);const points=hit.points.filter(p=>p.x.compare(real(lo))>0&&p.x.compare(real(hi))<0);assert.equal(points.length,1);const p=points[0]!;assert.equal(p.x.signOf(quartic),0);assert.equal(p.y.compare(p.x.rationalFunction(new Polynomial(['-5/4',1n,1n]),new Polynomial([1n,-2n]))),0);assert.ok(p.x.polynomial.degree<=4&&p.y.polynomial.degree<=4);}
 pointSet(intersectEllipses3(b,a),[...hit.points]);
 const reparameterized=ellipse3(planeFrame3(O,vector3(2n,0n,0n),V),'1/4',1n);pointSet(intersectEllipses3(reparameterized,b),[...hit.points]);
});
