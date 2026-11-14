import {point3,vector3,line3,cylinder3,circle3,prepareCylinderFace3,
  prepareCircularFace3,intersectPlanarCylinderFaces3} from '../dist/index.js';
const origin=point3(0n,0n,0n),axis=vector3(0n,0n,1n);
const cylinder=prepareCylinderFace3(cylinder3(line3(origin,axis),1n),-2n,2n);
const normal=vector3(1n,0n,-1n); // planar face in x=z
const annulus=prepareCircularFace3(circle3(origin,normal,'3/2'),[circle3(origin,normal,'5/4')]);
const intersection=intersectPlanarCylinderFaces3(annulus,cylinder);
console.log('Bounded annulus/cylinder intersection:',{
  curves:intersection.curves.length,
  isolatedPoints:intersection.points.length,
  curveKinds:intersection.curves.map(c=>c.curve.kind),
});
const tangentDisk=prepareCircularFace3(circle3(origin,normal,1n));
const contacts=intersectPlanarCylinderFaces3(tangentDisk,cylinder);
console.log('Tangent disk:',{curves:contacts.curves.length,isolatedPoints:contacts.points.length});
