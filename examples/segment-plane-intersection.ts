import { point3, segment3, planeFromPoints, orient3d, intersectSegmentPlane } from "../dist/index.js";
const a=point3(1n,0n,0n),b=point3(0n,1n,0n),c=point3(0n,0n,1n);
const plane=planeFromPoints(a,b,c); // x + y + z - 1 = 0
const segment=segment3(point3(0n,0n,0n),point3(1n,1n,1n));
console.log(JSON.stringify({plane,side:orient3d(a,b,c,segment.end),intersection:intersectSegmentPlane(segment,plane)},null,2));
