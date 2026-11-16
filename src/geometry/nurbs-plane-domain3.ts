import {assertOwnedNurbsPlaneWires3} from './nurbs-plane-wires3.js';
import type {NurbsPlaneWiresCertificate3} from './nurbs-plane-wires3.js';
import {planeFrame3,mapPlanePoint3,pointInPlaneFrame3} from './plane-frame3.js';
import type {PlaneFrame3} from './plane-frame3.js';
import {point3,cross3,dot3} from './point3.js';
import type {Point2} from './point2.js';
import type {AlgebraicCoordinates2} from './algebraic-point2.js';
import type {AlgebraicReal} from '../numeric/real-roots.js';
import {nurbsBoundaryPlaneEdgePoint3} from './sewn-nurbs-source-boundary-plane3.js';
import {locateSewnNurbsSourceMaterial3} from './sewn-nurbs-source-material-query3.js';
import type {SewnNurbsMaterialLocation3} from './sewn-nurbs-source-material-query3.js';
import type {SewnNurbsParitySearchOptions3} from './sewn-nurbs-source-parity-search3.js';

/** Exact implicit cap domain. This is not a sewn face or a child Body. */
export interface NurbsPlaneDomain3 {
 readonly boundary:NurbsPlaneWiresCertificate3;
 /** u × v is a positive multiple of the section plane normal. */
 readonly frame:PlaneFrame3;
}
const owned=new WeakSet<NurbsPlaneDomain3>();
function assertOwned(d:NurbsPlaneDomain3):void {if(!owned.has(d))throw new RangeError('Expected factory-created NURBS plane domain');}
export function nurbsPlaneDomain3(boundary:NurbsPlaneWiresCertificate3):NurbsPlaneDomain3 {
 assertOwnedNurbsPlaneWires3(boundary);
 const {normal:n,offset}=boundary.source.plane,n2=dot3(n,n),scale=offset.neg().div(n2);
 const origin=point3(n.x.mul(scale),n.y.mul(scale),n.z.mul(scale));
 const axis=n.x.sign()!==0||n.y.sign()!==0?point3(0n,0n,1n):point3(1n,0n,0n);
 const u=cross3(axis,n),v=cross3(n,u),frame=planeFrame3(origin,u,v);
 const domain=Object.freeze({boundary,frame});owned.add(domain);return domain;
}
/** Membership is the closed material intersected with the chart plane.
 * Unresolved material queries remain unresolved; no polygonal filling guess. */
export function locateNurbsPlaneDomain3(domain:NurbsPlaneDomain3,point:Point2|AlgebraicCoordinates2,options:SewnNurbsParitySearchOptions3={}):SewnNurbsMaterialLocation3 {
 assertOwned(domain);
 return locateSewnNurbsSourceMaterial3(domain.boundary.source.material,mapPlanePoint3(domain.frame,point),options);
}
/** Evaluate an original implicit edge in the cap chart using its native
 * parameter (independent of the oriented wire use direction). */
export function nurbsPlaneDomainEdgePoint3(domain:NurbsPlaneDomain3,edge:number,parameter:AlgebraicReal):AlgebraicCoordinates2 {
 assertOwned(domain);
 const q=nurbsBoundaryPlaneEdgePoint3(domain.boundary.source,edge,parameter),p=pointInPlaneFrame3(domain.frame,q.point);
 if(p===null)throw new Error('Certified section edge left its cap plane');
 return p;
}
