import {point3,plane3,nurbsSurface3,insertNurbsSurfaceKnot3,intersectNurbsSurfacePlane3,sewNurbsPlaneSection3} from '../dist/index.js';
const K=[0n,0n,1n,1n];let surface=nurbsSurface3(1,1,[[point3(0n,0n,0n),point3(0n,1n,0n)],[point3(1n,0n,0n),point3(1n,1n,1n)]],K,K);
surface=insertNurbsSurfaceKnot3(insertNurbsSurfaceKnot3(surface,'u','1/2'),'v','1/2');
const section=intersectNurbsSurfacePlane3(surface,plane3(0n,0n,1n,'-1/4')),joined=sewNurbsPlaneSection3(section);
console.log({sourcePieces:section.pieces.length,joinedVertices:joined.vertices.length,joinedEdges:joined.edges.length,components:joined.components.length,sourceVertexUses:joined.vertices.map(v=>v.uses.length)});
