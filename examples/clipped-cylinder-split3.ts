import {point3,vector3,line3,cylinder3,plane3,clipCylinderBRep3,splitClippedCylinderByPlane3,rejoinClippedCylinderSplit3} from '../dist/index.js';

const solid=clipCylinderBRep3(cylinder3(line3(point3(0n,0n,0n),vector3(0n,0n,1n)),1n),-1n,1n,[]);
const split=splitClippedCylinderByPlane3(solid,plane3(1n,0n,1n));
if(split.kind!=='split')throw new Error('Expected a genuine volume split');
const joined=rejoinClippedCylinderSplit3(split);
console.log({
  kind:split.kind,
  negativeClosed:split.negative.topology.closedOrientedIncidence,
  positiveClosed:split.positive.topology.closedOrientedIncidence,
  sharedEdges:split.shared.edges.length,
  childBoundaryMappings:[split.shared.negativeBoundary.length,split.shared.positiveBoundary.length],
  rejoinedClosed:joined.sewing.topology.closedOrientedIncidence,
  rejoinedShells:joined.sewing.topology.shells.length,
  supportingContact:splitClippedCylinderByPlane3(solid,plane3(3n,4n,0n,-5n)).kind,
  missingPlane:splitClippedCylinderByPlane3(solid,plane3(1n,0n,0n,-2n)).kind,
});
