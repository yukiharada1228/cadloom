import {point3,vector3,circle3,plane3,prepareCircularFace3,prepareTrimmedPlanar3,splitTrimmedPlanarByPlane3} from '../dist/index.js';
const face=prepareCircularFace3(circle3(point3(0n,0n,0n),vector3(0n,0n,1n),4n),[
  circle3(point3(0n,0n,0n),vector3(0n,0n,1n),1n),
]);
const strip=prepareTrimmedPlanar3(face,[
  {plane:plane3(1n,0n,0n,'-1/2'),side:-1},
  {plane:plane3(-1n,0n,0n,'-1/2'),side:-1},
]);
console.log('Annulus strip components:',strip.components.length);
const split=splitTrimmedPlanarByPlane3(prepareTrimmedPlanar3(face),plane3(1n,0n,0n));
if(split.kind==='split')console.log('Annulus split:',{
  negativeComponents:split.negative.components.length,
  positiveComponents:split.positive.components.length,
  sharedEdges:split.sharedEdges.length,
  incidenceFaces:split.topology?.faces.length??null,
});
