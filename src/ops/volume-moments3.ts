import {isOwnedCellularBody3,planarMaterialOfCellularBody3} from './cellular-body3.js';
import type {CellularBody3} from './cellular-body3.js';
import {planarMaterialVolumeMoments3} from './planar-material3.js';
import {assertOwnedBody3,planarSourceOfBody3} from '../model/body3.js';
import type {Body3} from '../model/body3.js';
import {planarSolidFromBoundary3} from '../convert/planar-body3.js';
import {planarVolumeMoments3} from '../geometry/planar-volume-moments3.js';
import type {PlanarVolumeMoments3} from '../geometry/planar-volume-moments3.js';

/** Exact unit-density volume moments for an owned rational, straight-edged
 * planar Body. Curved supports/edges and nonrational vertices fail explicitly. */
export function planarBodyVolumeMoments3(body:Body3|CellularBody3):PlanarVolumeMoments3 {
 if(isOwnedCellularBody3(body))return planarMaterialVolumeMoments3(planarMaterialOfCellularBody3(body));
 assertOwnedBody3(body);
 return planarVolumeMoments3(planarSourceOfBody3(body)??planarSolidFromBoundary3(body.topology));
}
