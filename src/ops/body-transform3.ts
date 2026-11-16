import {isOwnedCappedNurbsBody3} from '../model/capped-nurbs-body3.js';
import type {CappedNurbsBody3} from '../model/capped-nurbs-body3.js';
import {transformCappedNurbsBody3} from './capped-nurbs-body3.js';
import {isOwnedCellularBody3,planarMaterialOfCellularBody3,cellularBodyFromPlanarMaterial3} from './cellular-body3.js';
import type {CellularBody3} from './cellular-body3.js';
import {transformPlanarMaterial3} from './planar-material3.js';
import {assertOwnedBody3} from '../model/body3.js';
import type {Body3} from '../model/body3.js';
import type {KernelBody3} from '../model/body3.js';
import {isOwnedNurbsBody3} from '../model/nurbs-body3.js';
import type {NurbsBody3} from '../model/nurbs-body3.js';
import {transformNurbsBody3} from './nurbs-body3.js';
import {assertOwnedSimilarityTransform3} from '../geometry/similarity3.js';
import type {SimilarityTransform3} from '../geometry/similarity3.js';
import {transformCylinderMaterialProgram3} from '../geometry/transform-material-program3.js';
import {boundaryMaterialSurfaces3} from '../geometry/material-surface-boundary3.js';
import {materialProgramOfBody3,bodyFromMaterialSurfaceBoundary3} from './body3.js';
/** Rebuild exact transformed definitions; cellular inputs preserve their material regions. */
export function transformBody3(body:CellularBody3,transform:SimilarityTransform3):CellularBody3;
export function transformBody3(body:CappedNurbsBody3,transform:SimilarityTransform3):CappedNurbsBody3;
export function transformBody3(body:NurbsBody3,transform:SimilarityTransform3):NurbsBody3;
export function transformBody3(body:Body3,transform:SimilarityTransform3):Body3;
export function transformBody3(body:Body3|CellularBody3,transform:SimilarityTransform3):Body3|CellularBody3;
export function transformBody3(body:KernelBody3,transform:SimilarityTransform3):KernelBody3;
export function transformBody3(body:KernelBody3,transform:SimilarityTransform3):KernelBody3 {
 if(isOwnedCappedNurbsBody3(body))return transformCappedNurbsBody3(body,transform);
 if(isOwnedNurbsBody3(body))return transformNurbsBody3(body,transform);
 if(isOwnedCellularBody3(body))return cellularBodyFromPlanarMaterial3(transformPlanarMaterial3(planarMaterialOfCellularBody3(body),transform));
 assertOwnedBody3(body);assertOwnedSimilarityTransform3(transform);
 const program=transformCylinderMaterialProgram3(materialProgramOfBody3(body),transform);
 return bodyFromMaterialSurfaceBoundary3(boundaryMaterialSurfaces3(program,{requireClosed:true}));
}
