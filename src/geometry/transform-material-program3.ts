import {assertOwnedCylinderMaterialProgram3,prepareCylinderMaterialProgram3} from './cylinder-material-program3.js';
import type {CylinderMaterialProgram3} from './cylinder-material-program3.js';
import {assertOwnedSimilarityTransform3,transformPointBySimilarity3,transformVectorBySimilarity3} from './similarity3.js';
import type {SimilarityTransform3} from './similarity3.js';
import {line3,cylinder3} from './surface3.js';
import {prepareFiniteCylinder3} from './finite-cylinder-boolean3.js';
import {plane3} from './plane3.js';
import {point3,dot3} from './point3.js';
/** Transform defining predicates, preserving axis parameters and local formulas. */
export function transformCylinderMaterialProgram3(source:CylinderMaterialProgram3,transform:SimilarityTransform3):CylinderMaterialProgram3 {
 assertOwnedCylinderMaterialProgram3(source);assertOwnedSimilarityTransform3(transform);
 const cylinders=source.cylinders.map(c=>prepareFiniteCylinder3(cylinder3(line3(transformPointBySimilarity3(transform,c.cylinder.axis.origin),transformVectorBySimilarity3(transform,c.cylinder.axis.direction)),c.cylinder.radiusSquared.mul(transform.scaleSquared)),c.lower,c.upper));
 const planes=source.planes.map(p=>{const v=transformVectorBySimilarity3(transform,p.normal),s=transform.scaleSquared,n=point3(v.x.div(s),v.y.div(s),v.z.div(s));return plane3(n.x,n.y,n.z,p.offset.sub(dot3(n,transform.translation)));});
 return prepareCylinderMaterialProgram3(cylinders,planes,source.expression);
}
