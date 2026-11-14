import {point3,vector3,circle3,prepareCircularFace3} from '../dist/index.js';
// An annular plane face with an arbitrary rational normal; no unit-vector approximation.
const center=point3(2n,3n,4n),normal=vector3(1n,1n,1n);
const face=prepareCircularFace3(circle3(center,normal,4n),[circle3(center,normal,1n)]);
console.log({
  boundaryLoops:face.boundary.length,
  interiorWitness:face.locate(face.sample),
  inHole:face.locate(center),
  inMaterial:face.locate(point3(3n,2n,4n)),
  outsidePlane:face.locate(point3(2n,3n,5n)),
  manifoldBoundary:face.topology.manifoldVertices,
  closedShell:face.topology.closed,
});
