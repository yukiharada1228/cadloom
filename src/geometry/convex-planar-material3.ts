import {assertOwnedPlanarSolid3} from './planar-solid3.js';
import type {PreparedPlanarSolid3} from './planar-solid3.js';
import {point3} from './point3.js';
import {plane3,evaluatePlane3} from './plane3.js';
import {line3,cylinder3} from './surface3.js';
import {prepareFiniteCylinder3} from './finite-cylinder-boolean3.js';
import {exactRational} from '../numeric/polynomial.js';
import {boundaryCylinderMaterialExpression3} from './cylinder-material-expression3.js';
import type {CylinderMaterialBoundary3,CylinderMaterialExpression3} from './cylinder-material-expression3.js';

/** Internal backend selection on an actual immutable prepared source. */
export function isConvexPlanarMaterial3(source:PreparedPlanarSolid3):boolean {
 assertOwnedPlanarSolid3(source);
 if(source.shells.length!==1||source.shells[0]!.depth!==0||source.volume.sign()<=0)return false;
 const vertices=source.polygons.flat();
 return source.topology.faces.every(face=>{
  const surface=face.surface;if(surface.kind!=='plane')return false;
  return vertices.every(v=>evaluatePlane3(surface.plane,v).sign()*face.sense<=0);
 });
}

/** Lower an owned convex rational polyhedron to its exact supporting halfspaces.
 * Concave material, multiple shells and voids require a richer decomposition. */
export function boundaryConvexPlanarMaterial3(source:PreparedPlanarSolid3):CylinderMaterialBoundary3 {
 assertOwnedPlanarSolid3(source);
 if(source.shells.length!==1||source.shells[0]!.depth!==0||source.volume.sign()<=0)throw new RangeError('Expected one nonempty convex planar material shell');
 if(!isConvexPlanarMaterial3(source))throw new RangeError('Planar material is not convex');
 const vertices=source.polygons.flat(),planes=source.topology.faces.map(face=>{
  if(face.surface.kind!=='plane')throw new RangeError('Expected planar supports');
  const p=face.surface.plane,n=p.normal,s=face.sense;
  return s===1?plane3(n.x,n.y,n.z,p.offset):plane3(n.x.neg(),n.y.neg(),n.z.neg(),p.offset.neg());
 });
 const axes=['x','y','z'] as const,lo=point3(...axes.map(k=>vertices.reduce((a,p)=>p[k].compare(a)<0?p[k]:a,vertices[0]![k])) as Parameters<typeof point3>),hi=point3(...axes.map(k=>vertices.reduce((a,p)=>p[k].compare(a)>0?p[k]:a,vertices[0]![k])) as Parameters<typeof point3>),one=exactRational(1n),w=hi.x.sub(lo.x),d=hi.y.sub(lo.y);
 // The actual closed convex boundary has every vertex in these halfspaces;
 // its intersection is exactly the convex polytope. The guard is strictly
 // inactive on the containing vertex box, including its boundary.
 const guard=prepareFiniteCylinder3(cylinder3(line3(point3(lo.x,lo.y,0n),point3(0n,0n,1n)),w.mul(w).add(d.mul(d)).add(one)),lo.z.sub(one),hi.z.add(one));
 let expression:CylinderMaterialExpression3={kind:'cylinder',cylinder:0};
 planes.forEach((_,halfspace)=>{expression={kind:'intersection',first:expression,second:{kind:'halfspace',halfspace}};});
 return boundaryCylinderMaterialExpression3([guard],planes,expression);
}
