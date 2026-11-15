import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,Polynomial,point3,translateAlgebraicPoint3} from '../dist/index.js';
import {algebraicRationalPoint3,getRationalParameterization3,signLinearAlgebraicPoint3} from '../dist/geometry/algebraic-point3.js';
test('rational-chart translation retains source identity and exact shifted coordinate certificates',()=>{
 const t=AlgebraicReal.fromRational(2n).sqrt(),p=algebraicRationalPoint3(t,[new Polynomial([1n,1n]),new Polynomial([0n,1n]),new Polynomial([1n])],new Polynomial([1n,1n])),v=point3('2/3','-5/7',11n),moved=translateAlgebraicPoint3(p,v),chart=getRationalParameterization3(moved)!;assert.ok(chart);assert.equal(chart.parameter,t);
 for(const k of ['x','y','z'] as const){assert.equal(moved[k].compare(p[k].affine(1n,v[k])),0);assert.equal(moved[k].polynomial.degree,p[k].polynomial.degree);}
 assert.equal(moved.x.rational!.toString(),'5/3');assert.equal(signLinearAlgebraicPoint3(moved,point3(1n,0n),v.x.add(p.x.rational!).neg()),0);
 const back=translateAlgebraicPoint3(moved,point3(v.x.neg(),v.y.neg(),v.z.neg()));for(const k of ['x','y','z'] as const)assert.equal(back[k].compare(p[k]),0);
});
