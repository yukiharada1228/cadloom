import {AlgebraicReal,point3,vector3,line3,cylinder3,circle3,circularArc3,algebraicPoint3,prepareCylinderFace3,translateAlgebraicPoint3} from '../dist/index.js';
const origin=point3(0n,0n,0n),axis=vector3(1n,1n,1n),root=AlgebraicReal.fromRational('1/2').sqrt();
const circle=circle3(origin,axis,1n);
const start=algebraicPoint3(origin,vector3(0n,1n,-1n),root);
const end=algebraicPoint3(origin,vector3(-1n,1n,0n),root);
const face=prepareCylinderFace3(cylinder3(line3(origin,axis),1n),0n,'2/3',{angular:circularArc3(circle,start,end)});
const normal=face.normalAt(face.sample);
console.log({
  boundaryLoops:face.boundary.length,
  boundaryKinds:face.boundary.flat().map(c=>c.kind),
  interiorWitness:face.locate(face.sample),
  angularBoundary:face.locate(translateAlgebraicPoint3(start,vector3('1/3','1/3','1/3'))),
  normalSigns:[normal.x.sign(),normal.y.sign(),normal.z.sign()],
  manifoldBoundary:face.topology.manifoldVertices,
});
