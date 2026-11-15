import type {PreparedPlanarSolid3} from './planar-solid3.js';
import {compilePlanarChambers3} from './planar-material-chambers3.js';
import {boundaryCylinderMaterialExpression3} from './cylinder-material-expression3.js';
import type {CylinderMaterialBoundary3} from './cylinder-material-expression3.js';

/** Construct the exact regularized boundary of owned planar material, including
 * concave boundaries and nested shells. The compiler checks source ownership;
 * the material backend performs complete partitioning and sewing. Inspect the
 * returned manifold certificate before adopting it as a common Body. */
export function boundaryPlanarMaterial3(source:PreparedPlanarSolid3):CylinderMaterialBoundary3 {
 const program=compilePlanarChambers3(source);
 return boundaryCylinderMaterialExpression3(program.cylinders,program.planes,program.expression);
}
