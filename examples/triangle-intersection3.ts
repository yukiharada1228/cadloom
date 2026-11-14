import { point3, triangle3, intersectTriangles3, inspectTriangleEmbedding } from "../dist/index.js";
const a=triangle3(point3(0n,0n,0n),point3(2n,0n,0n),point3(0n,2n,0n));
const b=triangle3(point3('1/2',0n,-1n),point3('1/2',2n,-1n),point3('1/2',0n,1n));
const c=triangle3(point3(0n,0n,0n),point3(1n,0n,0n),point3(0n,1n,0n));
console.log(JSON.stringify({transverse:intersectTriangles3(a,b),coplanar:intersectTriangles3(a,c),embedding:inspectTriangleEmbedding([a,b])},null,2));
