import { booleanSolids3, extrudePolygon, point2, triangle3 } from '../dist/index.js';
const cube=(low:bigint,high:bigint)=>{
  const mesh=extrudePolygon([[point2(low,low),point2(high,low),point2(high,high),point2(low,high)]],high-low,{baseZ:low});
  return mesh.triangles.map(t=>triangle3(mesh.vertices[t[0]]!,mesh.vertices[t[1]]!,mesh.vertices[t[2]]!));
};
for(const operation of ['union','intersection','difference','xor'] as const){
  const result=booleanSolids3(cube(0n,2n),cube(1n,3n),operation);
  console.log({operation,volume:result.volume.toString(),triangles:result.boundary.length,closedManifold:result.topology.closedManifold});
}
