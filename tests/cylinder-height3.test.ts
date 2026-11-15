import test from 'node:test';
import assert from 'node:assert/strict';
import {AlgebraicReal,point3,line3,cylinder3,algebraicCoordinates3,intersectCylinders3} from '../dist/index.js';
import {cylinderHeight3,cylinderCoordinates3} from '../dist/geometry/cylinder-coordinates3.js';
const root=(n:bigint)=>AlgebraicReal.fromRational(n).sqrt();
test('height-only queries preserve signed nonunit frames, arbitrary coordinates and SSI inverse identities',()=>{
 const c=cylinder3(line3(point3(0n,0n,7n),point3(0n,0n,-3n)),2n),p=algebraicCoordinates3(root(2n),root(3n),root(5n));
 assert.equal(cylinderHeight3(c,p).compare(root(5n).affine('-1/3','7/3')),0);
 const rational=cylinder3(line3(point3(1n,2n,3n),point3(1n,2n,2n)),5n);assert.equal(cylinderHeight3(rational,point3(4n,6n,7n)).rational!.toString(),'19/9');
 const a=cylinder3(line3(point3(0n,0n),point3(0n,0n,1n)),1n),b=cylinder3(line3(point3(0n,0n),point3(1n,0n)),4n),g=intersectCylinders3(a,b);assert.equal(g.kind,'bounded');if(g.kind==='bounded')for(const arc of g.arcs){assert.equal(cylinderHeight3(a,arc.sample).compare(arc.sample.z),0);assert.equal(cylinderHeight3(a,arc.sample).compare(cylinderCoordinates3(a,arc.sample).height),0);}
});
