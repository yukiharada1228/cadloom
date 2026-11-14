import test from 'node:test';
import assert from 'node:assert/strict';
import {Rational,AlgebraicReal,point3,nurbsCurve3,nurbsCurveSpans3,insertNurbsKnot3,reverseNurbsCurve3,intersectNurbsCurves3,evaluateNurbsCurveRelation3,nurbsCurveRelationEdgePoint3,compareAlgebraicPoints3} from '../dist/index.js';
import type {NurbsCurveIntersection3,NurbsSpan3} from '../dist/index.js';
const K=[0n,0n,1n,1n],real=(x:bigint|string)=>AlgebraicReal.fromRational(x),line=(a:ReturnType<typeof point3>,b:ReturnType<typeof point3>)=>nurbsCurve3(1,[a,b],K);
function at(s:NurbsSpan3,t:AlgebraicReal){return {x:t.rationalFunction(s.x,s.weight),y:t.rationalFunction(s.y,s.weight),z:t.rationalFunction(s.z,s.weight)};}
function audit(result:NurbsCurveIntersection3){
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.points)&&Object.isFrozen(result.relations));const A=nurbsCurveSpans3(result.first),B=nurbsCurveSpans3(result.second);
  for(const p of result.points)for(const branch of p.branches){const a=A.find(s=>s.index===branch.firstSpan)!,b=B.find(s=>s.index===branch.secondSpan)!;assert.equal(compareAlgebraicPoints3(p.point,at(a,p.firstParameter)),0);assert.equal(compareAlgebraicPoints3(p.point,at(b,p.secondParameter)),0);}
  result.relations.forEach((r,index)=>{
    const a=A.find(s=>s.index===r.firstSpan)!,b=B.find(s=>s.index===r.secondSpan)!,pairs:{u:AlgebraicReal;v:AlgebraicReal}[]=[...r.topology.vertices,...r.topology.edges.map(e=>e.sample)];
    if(r.topology.kind==='area')pairs.push({u:AlgebraicReal.fromRational(a.startParameter.add(a.endParameter).div(new Rational(2n))),v:AlgebraicReal.fromRational(b.startParameter.add(b.endParameter).div(new Rational(2n)))});
    for(const p of pairs){const value=evaluateNurbsCurveRelation3(result,index,p.u,p.v);assert.equal(compareAlgebraicPoints3(value.point,at(a,p.u)),0);assert.equal(compareAlgebraicPoints3(value.point,at(b,p.v)),0);}
  });
}
test('spatial line intersections reject skew projections and collect all continuous knot branches',()=>{
  const A=line(point3(0n,0n,0n),point3(1n,0n,0n)),B=line(point3('1/2','-1/2',0n),point3('1/2','1/2',0n)),result=intersectNurbsCurves3(A,B);audit(result);assert.equal(result.points.length,1);assert.equal(result.relations.length,0);assert.equal(result.points[0]!.firstParameter.compare(real('1/2')),0);assert.equal(result.points[0]!.secondParameter.compare(real('1/2')),0);
  const skew=intersectNurbsCurves3(A,line(point3('1/2','-1/2',1n),point3('1/2','1/2',1n)));audit(skew);assert.equal(skew.points.length,0);assert.equal(skew.relations.length,0);
  const refined=intersectNurbsCurves3(insertNurbsKnot3(A,'1/2'),insertNurbsKnot3(B,'1/2'));audit(refined);assert.equal(refined.points.length,1);assert.equal(refined.points[0]!.branches.length,4);
});
test('irrational parabola intersections and tangencies keep exact parameter coordinates',()=>{
  const A=nurbsCurve3(2,[point3(0n,0n,0n),point3('1/2',0n,0n),point3(1n,1n,0n)],[0n,0n,0n,1n,1n,1n]),B=line(point3(0n,'1/2',0n),point3(1n,'1/2',0n)),result=intersectNurbsCurves3(A,B);audit(result);assert.equal(result.points.length,1);const root=real('1/2').sqrt();assert.equal(result.points[0]!.firstParameter.compare(root),0);assert.equal(result.points[0]!.secondParameter.compare(root),0);
  const curve=nurbsCurve3(2,[point3(-1n,1n,0n),point3(0n,-1n,0n),point3(1n,1n,0n)],[-1n,-1n,-1n,1n,1n,1n]),axis=nurbsCurve3(1,[point3(-1n,0n,0n),point3(1n,0n,0n)],[-1n,-1n,1n,1n]),tangent=intersectNurbsCurves3(curve,axis);audit(tangent);assert.equal(tangent.points.length,1);assert.equal(tangent.points[0]!.firstParameter.sign(),0);assert.equal(tangent.points[0]!.secondParameter.sign(),0);
});
test('reversed rational circle arcs retain a full exact parameter correspondence',()=>{
  const A=nurbsCurve3(2,[point3(1n,0n,0n),point3(1n,1n,0n),point3(0n,1n,0n)],[0n,0n,0n,1n,1n,1n],[1n,1n,2n]),result=intersectNurbsCurves3(A,reverseNurbsCurve3(A));audit(result);assert.equal(result.points.length,0);assert.equal(result.relations.length,1);assert.equal(result.relations[0]!.topology.components.length,1);const p=nurbsCurveRelationEdgePoint3(result,0,0,'1/4');assert.equal(p.firstParameter.compare(real('1/4')),0);assert.equal(p.secondParameter.compare(real('3/4')),0);
});
test('nonlinear and noninjective reparameterizations retain both overlap branches',()=>{
  const A=line(point3(0n,0n,0n),point3(1n,0n,0n)),B=nurbsCurve3(2,[point3(1n,0n,0n),point3(-1n,0n,0n),point3(1n,0n,0n)],[-1n,-1n,-1n,1n,1n,1n]),result=intersectNurbsCurves3(A,B);audit(result);assert.equal(result.relations.length,1);assert.equal(result.relations[0]!.topology.edges.length,2);const pairs=[0,1].map(edge=>nurbsCurveRelationEdgePoint3(result,0,edge,'1/4'));assert.ok(pairs.some(p=>p.secondParameter.compare(real('-1/2'))===0));assert.ok(pairs.some(p=>p.secondParameter.compare(real('1/2'))===0));assert.ok(pairs.every(p=>p.point.x.compare(real('1/4'))===0));
});
test('partial overlaps and corner-only overlap contacts respect both closed parameter domains',()=>{
  const A=line(point3(0n,0n,0n),point3(1n,0n,0n)),B=line(point3('1/2',0n,0n),point3('5/2',0n,0n)),result=intersectNurbsCurves3(A,B);audit(result);assert.equal(result.relations.length,1);const p=nurbsCurveRelationEdgePoint3(result,0,0,'3/4');assert.equal(p.secondParameter.compare(real('1/8')),0);
  const endpoint=intersectNurbsCurves3(A,line(point3(1n,0n,0n),point3(2n,0n,0n)));audit(endpoint);assert.equal(endpoint.points.length,1);assert.equal(endpoint.relations.length,1);assert.equal(endpoint.relations[0]!.topology.edges.length,0);assert.equal(endpoint.points[0]!.firstParameter.compare(real(1n)),0);assert.equal(endpoint.points[0]!.secondParameter.sign(),0);
});
test('constant curves distinguish infinite parameter relations from spatial overlap arcs',()=>{
  const point=line(point3('1/2',0n,0n),point3('1/2',0n,0n)),axis=line(point3(0n,0n,0n),point3(1n,0n,0n));
  for(const [a,b] of [[point,axis],[axis,point]]){const r=intersectNurbsCurves3(a!,b!);audit(r);assert.equal(r.points.length,0);assert.equal(r.relations.length,1);assert.equal(r.relations[0]!.topology.edges.length,1);const p=nurbsCurveRelationEdgePoint3(r,0,0,'1/4');assert.equal(p.point.x.compare(real('1/2')),0);}
  const equal=intersectNurbsCurves3(point,point);audit(equal);assert.equal(equal.relations[0]!.topology.kind,'area');assert.equal(evaluateNurbsCurveRelation3(equal,0,'1/4','3/4').point.x.compare(real('1/2')),0);
  const distinct=intersectNurbsCurves3(point,line(point3('3/4',0n,0n),point3('3/4',0n,0n)));audit(distinct);assert.equal(distinct.relations.length,0);assert.equal(distinct.points.length,0);
});
test('self-intersection parameter pairs coexist with the diagonal overlap relation',()=>{
  const A=nurbsCurve3(3,[point3(3n,-6n,0n),point3('-7/3','26/3',0n),point3('-7/3','-26/3',0n),point3(3n,6n,0n)],[-2n,-2n,-2n,-2n,2n,2n,2n,2n]),result=intersectNurbsCurves3(A,A);audit(result);assert.equal(result.relations.length,1);assert.equal(result.points.length,2);for(const p of result.points){assert.equal(p.firstParameter.add(p.secondParameter).sign(),0);assert.equal(p.firstParameter.mul(p.firstParameter).compare(real(1n)),0);assert.equal(p.point.x.sign(),0);assert.equal(p.point.y.sign(),0);}
});
test('discontinuous endpoints keep distinct spatial points at the same parameter pair and ignore forged metadata',()=>{
  const jump=[0n,0n,1n,1n,2n,2n],A=nurbsCurve3(1,[point3(0n,0n,0n),point3(1n,0n,0n),point3(10n,0n,0n),point3(11n,0n,0n)],jump),B=nurbsCurve3(1,[point3(1n,-1n,0n),point3(1n,0n,0n),point3(10n,0n,0n),point3(10n,1n,0n)],jump),result=intersectNurbsCurves3({...A,startParameter:new Rational(-99n)},B);audit(result);assert.equal(result.points.length,2);assert.deepEqual(result.points.map(p=>p.point.x.recognizeRational().rational!.toString()),['1','10']);assert.ok(result.points.every(p=>p.firstParameter.compare(real(1n))===0&&p.secondParameter.compare(real(1n))===0));
  const overlap=intersectNurbsCurves3(line(point3(0n,0n,0n),point3(1n,0n,0n)),line(point3(0n,0n,0n),point3(1n,0n,0n)));assert.throws(()=>evaluateNurbsCurveRelation3({...overlap},0,'1/2','1/2'),RangeError);assert.throws(()=>evaluateNurbsCurveRelation3(overlap,0,'-1/2','-1/2'),RangeError);assert.throws(()=>evaluateNurbsCurveRelation3(overlap,0,'1/4','1/2'),RangeError);assert.throws(()=>nurbsCurveRelationEdgePoint3(overlap,0,-1,'1/2'),RangeError);
});
