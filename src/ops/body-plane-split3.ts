import {isOwnedRecutNurbsBody3} from '../model/recut-nurbs-body3.js';
import type {RecutNurbsBody3} from '../model/recut-nurbs-body3.js';
import {splitCappedNurbsBodyByPlane3} from './recut-nurbs-body3.js';
import {isOwnedCappedNurbsBody3} from '../model/capped-nurbs-body3.js';
import type {CappedNurbsBody3} from '../model/capped-nurbs-body3.js';
import type {NurbsBody3} from '../model/nurbs-body3.js';
import {splitNurbsBodyByPlane3} from './capped-nurbs-body3.js';
import type {KernelBody3,Body3} from '../model/body3.js';
import {isOwnedNurbsBody3} from '../model/nurbs-body3.js';
import {assertOwnedBody3} from '../model/body3.js';
import {isOwnedCellularBody3} from '../model/cellular-body3.js';
import {plane3} from '../geometry/plane3.js';
import type {Plane3} from '../geometry/plane3.js';
import {clipCylinderMaterialProgram3} from '../geometry/cylinder-material-program3.js';
import {compactCylinderMaterialProgram3} from '../geometry/compact-material-program3.js';
import {boundaryMaterialSurfaces3} from '../geometry/material-surface-boundary3.js';
import {materialProgramOfBody3,bodyFromMaterialSurfaceBoundary3,rationalPlanarBody3} from './body3.js';
import {splitPlanarBodyByPlane3} from './planar-body-split3.js';
import type {PlanarBodyPlaneSplit3} from './planar-body-split3.js';

export type BodyPlaneSplit3 =
 | Readonly<{representation:'planar';parent:KernelBody3;plane:Plane3;negative:KernelBody3;positive:KernelBody3;planar:PlanarBodyPlaneSplit3}>
 | Readonly<{representation:'nurbs-recut';parent:CappedNurbsBody3;plane:Plane3;negative:RecutNurbsBody3;positive:RecutNurbsBody3}>
 | Readonly<{representation:'nurbs';parent:NurbsBody3;plane:Plane3;negative:CappedNurbsBody3;positive:CappedNurbsBody3}>
 | Readonly<{representation:'surface-material';parent:KernelBody3;plane:Plane3;negative:Body3;positive:Body3}>;
const ownedSplits=new WeakSet<BodyPlaneSplit3>();
function finish<T extends BodyPlaneSplit3>(split:T):T {ownedSplits.add(split);return split;}
/** Internal metadata guard; structural copies cannot claim split ownership. */
export function assertOwnedBodyPlaneSplit3(split:BodyPlaneSplit3):void {if(!ownedSplits.has(split))throw new RangeError('Expected a factory-created common Body plane split');}
/** Split supported owned material Bodies without replacing curved boundaries by
 * meshes. Curved children must pass the existing closed manifold certificate.
 * Optional bodySplitInterface3 derives common finite cut-boundary atom maps. */
export function splitBodyByPlane3(body:KernelBody3,input:Plane3):BodyPlaneSplit3 {
 if(isOwnedRecutNurbsBody3(body))throw new RangeError('A third NURBS Body plane cut is not implemented');
 if(isOwnedCappedNurbsBody3(body)){const split=splitCappedNurbsBodyByPlane3(body,input);return finish(Object.freeze({representation:'nurbs-recut',parent:body,...split}));}
 if(isOwnedNurbsBody3(body)){const split=splitNurbsBodyByPlane3(body,input);return finish(Object.freeze({representation:'nurbs',parent:body,...split}));}
 const cell=isOwnedCellularBody3(body);if(!cell)assertOwnedBody3(body as Body3);
 const plane=plane3(input.normal.x,input.normal.y,input.normal.z,input.offset);
 const planar=rationalPlanarBody3(body);
 if(planar){const split=splitPlanarBodyByPlane3(body,plane);return finish(Object.freeze({representation:'planar',parent:body,plane,negative:split.negative,positive:split.positive,planar:split}));}
 const source=compactCylinderMaterialProgram3(materialProgramOfBody3(body)),child=(side:-1|1)=>bodyFromMaterialSurfaceBoundary3(boundaryMaterialSurfaces3(compactCylinderMaterialProgram3(clipCylinderMaterialProgram3(source,[{plane,side}])),{requireClosed:true}));
 return finish(Object.freeze({representation:'surface-material',parent:body,plane,negative:child(-1),positive:child(1)}));
}
