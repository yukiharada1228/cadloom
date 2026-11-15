import {AlgebraicReal,point3,line3,cylinder3,circle3,circularArc3,algebraicCoordinates3,prepareCylinderFace3,intersectCylinders3,clipCylinderIntersectionToFaces3} from '../dist/index.js';
const origin=point3(0n,0n),z=point3(0n,0n,1n),a=cylinder3(line3(origin,z),1n),b=cylinder3(line3(origin,point3(1n,0n,0n)),1n),graph=intersectCylinders3(a,b);
if(graph.kind!=='bounded')throw new Error('Expected bounded cylinder SSI');
const start=algebraicCoordinates3(AlgebraicReal.fromRational('1/3').sqrt(),AlgebraicReal.fromRational('2/3').sqrt()),angular=circularArc3(circle3(origin,z,1n),start,algebraicCoordinates3(-1n,0n)),first=prepareCylinderFace3(a,'-3/4','3/4',{angular}),second=prepareCylinderFace3(b,-1n,1n),result=clipCylinderIntersectionToFaces3(graph,first,second);
// Diagnostic counts only: not a persistent Body record or a solid certificate.
console.log(JSON.stringify({sourceArcs:graph.arcs.length,retainedArcs:result.arcs.length,vertices:result.vertices.length,isolatedContacts:result.isolatedPoints.length,components:result.components.length},null,2));
