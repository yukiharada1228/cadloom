import test from 'node:test';
import assert from 'node:assert/strict';
import {point3,nurbsCurve3,intersectNurbsCurves3,AlgebraicReal} from '../dist/index.js';
test('a nonplanar cubic uses the third equation to select the true intersection and isolated shared loci become events',()=>{
  const cubic=nurbsCurve3(3,[point3(-1n,1n,-1n),point3('-1/3','-1/3',1n),point3('1/3','-1/3',-1n),point3(1n,1n,1n)],[-1n,-1n,-1n,-1n,1n,1n,1n,1n]),line=nurbsCurve3(1,[point3(-1n,'1/4','-11/8'),point3(1n,'1/4','5/8')],[-1n,-1n,1n,1n]),result=intersectNurbsCurves3(cubic,line);
  assert.equal(result.points.length,1);assert.equal(result.relations.length,0);const p=result.points[0]!;assert.equal(p.firstParameter.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(p.secondParameter.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(p.point.x.compare(AlgebraicReal.fromRational('1/2')),0);assert.equal(p.point.y.compare(AlgebraicReal.fromRational('1/4')),0);assert.equal(p.point.z.compare(AlgebraicReal.fromRational('1/8')),0);
  const knots=[-1n,-1n,-1n,1n,1n,1n],positive=nurbsCurve3(2,[point3(1n,0n,0n),point3(-1n,0n,0n),point3(1n,0n,0n)],knots),negative=nurbsCurve3(2,[point3(-1n,0n,0n),point3(1n,0n,0n),point3(-1n,0n,0n)],knots),contact=intersectNurbsCurves3(positive,negative);
  assert.equal(contact.points.length,1);assert.equal(contact.points[0]!.firstParameter.sign(),0);assert.equal(contact.points[0]!.secondParameter.sign(),0);assert.equal(contact.relations.length,1);assert.equal(contact.relations[0]!.topology.vertices.length,1);assert.equal(contact.relations[0]!.topology.edges.length,0);
  const unclamped=nurbsCurve3(2,[point3(0n,0n,0n),point3(1n,0n,0n),point3(2n,0n,0n)],[-2n,-1n,0n,1n,2n,3n]),cross=intersectNurbsCurves3(unclamped,nurbsCurve3(1,[point3(1n,-1n,0n),point3(1n,1n,0n)],[0n,0n,1n,1n]));assert.equal(cross.points.length,1);assert.equal(cross.points[0]!.firstParameter.compare(AlgebraicReal.fromRational('1/2')),0);
  const outside=intersectNurbsCurves3(unclamped,nurbsCurve3(1,[point3(0n,-1n,0n),point3(0n,1n,0n)],[0n,0n,1n,1n]));assert.equal(outside.points.length,0);assert.equal(outside.relations.length,0);
});
