import { point3, triangle3, plane3, splitTriangleByPlane } from "../dist/index.js";
const triangle=triangle3(point3(0n,0n,0n),point3(2n,0n,0n),point3(0n,2n,0n));
const result=splitTriangleByPlane(triangle,plane3(1n,0n,0n,-1n));
console.log(JSON.stringify(result,null,2));
