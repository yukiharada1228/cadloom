import { point2, triangle3, extrudePolygon, buildTriangleTopology, plane3, splitTriangleByPlane } from "../dist/index.js";
const region=[[point2(0n,0n),point2(1n,0n),point2(1n,1n),point2(0n,1n)]];
const mesh=extrudePolygon(region,1n);
const faces=mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!));
const closed=buildTriangleTopology(faces);
const cut=plane3(1n,0n,0n,"-1/2");
const positive=buildTriangleTopology(faces.flatMap(t=>splitTriangleByPlane(t,cut).positive));
const summary=(t:typeof closed)=>({vertices:t.vertices.length,edges:t.edges.length,faces:t.faces.length,
  shells:t.shells.length,closedManifold:t.closedManifold,boundaryLoops:t.boundaryLoops?.length,
  signedVolumes:t.shells.map(s=>s.signedVolume),issues:t.issues});
console.log(JSON.stringify({original:summary(closed),positiveCut:summary(positive)},null,2));
