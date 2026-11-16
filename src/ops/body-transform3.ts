import {assertOwnedBody3} from '../model/body3.js';
import type {Body3} from '../model/body3.js';
import {assertOwnedSimilarityTransform3} from '../geometry/similarity3.js';
import type {SimilarityTransform3} from '../geometry/similarity3.js';
import {transformCylinderMaterialProgram3} from '../geometry/transform-material-program3.js';
import {boundaryMaterialSurfaces3} from '../geometry/material-surface-boundary3.js';
import {materialProgramOfBody3,bodyFromMaterialSurfaceBoundary3} from './body3.js';
/** Rebuild exact transformed definitions through the common manifold Body path. */
export function transformBody3(body:Body3,transform:SimilarityTransform3):Body3 {
 assertOwnedBody3(body);assertOwnedSimilarityTransform3(transform);
 const program=transformCylinderMaterialProgram3(materialProgramOfBody3(body),transform);
 return bodyFromMaterialSurfaceBoundary3(boundaryMaterialSurfaces3(program,{requireClosed:true}));
}
