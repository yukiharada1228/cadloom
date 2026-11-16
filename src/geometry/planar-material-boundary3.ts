import {prepareCylinderMaterialProgram3} from './cylinder-material-program3.js';
import type {CylinderMaterialProgram3} from './cylinder-material-program3.js';
import type {PreparedPlanarSolid3} from './planar-solid3.js';
import {compilePlanarChambers3} from './planar-material-chambers3.js';
import {boundaryCylinderMaterialExpression3} from './cylinder-material-expression3.js';
import type {CylinderMaterialBoundary3} from './cylinder-material-expression3.js';
import {isConvexPlanarMaterial3,prepareConvexPlanarMaterialProgram3} from './convex-planar-material3.js';

/** Construct the exact regularized boundary of owned planar material, including
 * concave boundaries and nested shells. The compiler checks source ownership;
 * the material backend performs complete partitioning and sewing. Inspect the
 * returned manifold certificate before adopting it as a common Body. */
export function preparePlanarMaterialProgram3(source:PreparedPlanarSolid3):CylinderMaterialProgram3 {
 if(isConvexPlanarMaterial3(source))return prepareConvexPlanarMaterialProgram3(source);
 const p=compilePlanarChambers3(source);return prepareCylinderMaterialProgram3(p.cylinders,p.planes,p.expression);
}
export function boundaryPlanarMaterial3(source:PreparedPlanarSolid3):CylinderMaterialBoundary3 {
 const p=preparePlanarMaterialProgram3(source);return boundaryCylinderMaterialExpression3(p.cylinders,p.planes,p.expression);
}
