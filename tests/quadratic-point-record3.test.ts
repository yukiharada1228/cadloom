import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,isolateRealRoots,point3,vector3,line3,cylinder3,classifyPointToSurface3,encodeExactPoint3,decodeExactPoint3,encodeExactReal3,readBodyRecord3,decodeBodyGeometry3} from '../dist/index.js';
import {algebraicQuadraticPoint3,getQuadraticParameterization3,compareAlgebraicPoints3,compareLinearPoints3} from '../dist/geometry/algebraic-point3.js';
import {constructionRecordsAgree3} from '../dist/convert/body-equivalence3.js';
const P=(...xs:bigint[])=>new Polynomial(xs),T=P(0n,1n),source=isolateRealRoots(P(1n,0n,-10n,0n,1n))[3]!,D=P(1n,1n),K=D.mul(D).scale(12n).sub(T.mul(T)),p=algebraicQuadraticPoint3(source,[T,P(),P()],vector3(0n,1n),K,D),clone=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
const body=(vertex:unknown)=>({version:1,units:'mm',coordinates:'right-handed-z-up',curves:[],surfaces:[],vertices:[vertex],edges:[],loops:[],faces:[],shells:[{kind:'vertex',vertex:0}],regions:[{shells:[0],void:false}]});
test('quadratic-map JSON round trips preserve the defining field, degree and geometric membership',()=>{
 const r=encodeExactPoint3(p);assert.equal(r.kind,'quadratic-map');const raw:any=clone(r),q=decodeExactPoint3(raw);assert.ok(getQuadraticParameterization3(q));assert.notEqual(getQuadraticParameterization3(q)!.parameter,source);assert.equal(compareAlgebraicPoints3(q,p),0);assert.equal(compareLinearPoints3(q,p,vector3(1n,1n)),0);for(const k of ['x','y','z'] as const)assert.ok(q[k].polynomial.degree<=8);assert.equal(classifyPointToSurface3(q,{kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n),vector3(0n,0n,1n)),12n)}),0);assert.deepEqual(encodeExactPoint3(q),r);
 if(raw.kind==='quadratic-map')raw.numerators[0]![0]='999';assert.equal(compareAlgebraicPoints3(q,p),0);
});
test('quadratic-map schemas and constructors reject malformed definitions without granting geometry ownership',()=>{
 const r:any=clone(encodeExactPoint3(p));for(const mutate of [(x:any)=>x.coefficients.pop(),(x:any)=>x.numerators.pop(),(x:any)=>x.radicand=['-1'],(x:any)=>x.denominator=[],(x:any)=>x.parameter={kind:'root',polynomial:['-2','0','1'],lower:'-2',upper:'2'},(x:any)=>x.trusted=true]){const bad=clone(r);mutate(bad);assert.throws(()=>decodeExactPoint3(bad),RangeError);}
 assert.throws(()=>readBodyRecord3(body(r),{maxItems:5}),/budget/);assert.throws(()=>readBodyRecord3(body(r),{maxNumericCharacters:1}),/budget/);
});
test('ordered record equivalence recognizes quadratic maps and legacy coordinate point definitions',()=>{
 const r=encodeExactPoint3(p),legacy={kind:'coordinates',x:encodeExactReal3(p.x),y:encodeExactReal3(p.y),z:encodeExactReal3(p.z)},a=readBodyRecord3(body(r)),b=readBodyRecord3(body(legacy));assert.equal(constructionRecordsAgree3(a,b),true);assert.equal(constructionRecordsAgree3(b,a),true);const decoded=decodeBodyGeometry3(a);assert.ok(getQuadraticParameterization3(decoded.vertices[0]!));const bad=readBodyRecord3(body({...legacy,x:{kind:'rational',value:'0'}}));assert.equal(constructionRecordsAgree3(a,bad),false);
});
test('decoded quadratic points recover actual generator decompositions without serialized line flags',async()=>{
 const {algebraicRationalPoint3}=await import('../dist/geometry/algebraic-point3.js'),{algebraicSegment3,pointOnAlgebraicSegment3}=await import('../dist/index.js'),{algebraicSegmentOnSurface3}=await import('../dist/geometry/algebraic-segment3.js'),r=AlgebraicReal.fromRational(2n).sqrt(),N:[Polynomial,Polynomial,Polynomial]=[T,P(),P()],a=algebraicQuadraticPoint3(r,N,vector3(0n,1n),P(3n)),b=algebraicQuadraticPoint3(r,N,vector3(0n,1n),P(5n)),segment=algebraicSegment3(decodeExactPoint3(clone(encodeExactPoint3(a))),decodeExactPoint3(clone(encodeExactPoint3(b)))),middle=algebraicRationalPoint3(r,[T,P(2n),P()]);assert.equal(algebraicSegmentOnSurface3(segment,{kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n),vector3(0n,1n)),2n)}),true);assert.equal(algebraicSegmentOnSurface3(segment,{kind:'cylinder',cylinder:cylinder3(line3(point3(0n,0n),vector3(0n,1n)),3n)}),false);assert.equal(pointOnAlgebraicSegment3(middle,segment),true);
});
