import {Rational} from '../numeric/rational.js';
import {exactRational} from '../numeric/polynomial.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {point2} from './point2.js';
import {algebraicCoordinates2,algebraicPoint2} from './algebraic-point2.js';
import type {Point3} from './point3.js';
import {point3,vector3} from './point3.js';
import {snapshotExactPoint3,getPointParameterization3,translateAlgebraicPoint3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {algebraicSegment3} from './algebraic-segment3.js';
import {planeFrame3,mapPlanePoint3,curveEndpoints3,translateCurve3} from './curve3.js';
import type {Curve3} from './curve3.js';
import {line3,cylinder3} from './surface3.js';
import {circle3,circularArc3} from './circle3.js';
import {preparePlanarFace3,prepareRectangleFace3,translatePlanarFace3} from './planar-face3.js';
import type {PreparedPlanarFace3} from './planar-face3.js';
import {prepareCylinderFace3} from './cylinder-face3.js';
import type {PreparedCylinderFace3} from './cylinder-face3.js';
import {booleanCurveRegions2} from './curve-boolean2.js';
import type {CurveRegion2,CurveBooleanResult2,CurveRegionLocation2,CurveBoundary2} from './curve-boolean2.js';
import type {FillRule} from './polygon-boolean.js';
import {buildBRepTopology3} from './brep-topology3.js';
import type {BRepTopology3,BRepFaceInput3,BRepEdgeUse3} from './brep-topology3.js';

export interface ExtrudeBRepOptions3 {readonly baseZ?:ExactInput;readonly fillRule?:FillRule;}
export type ExtrudedBRepFace3={readonly kind:'planar';readonly face:PreparedPlanarFace3}|{readonly kind:'cylindrical';readonly face:PreparedCylinderFace3};
/** Constructively embedded outward boundary of a vertical product solid.
 * Disconnected material components and through-holes are supported; pinches are
 * rejected. Empty material gives an empty valid complex with no interior samples.
 */
export interface ExtrudedBRep3 {
  readonly region:CurveBooleanResult2;
  readonly profiles:readonly PreparedPlanarFace3[];
  readonly zMin:Rational;readonly zMax:Rational;
  readonly topology:BRepTopology3;
  /** Same face indexing as topology.faces; each domain has its own local incidence. */
  readonly faces:readonly ExtrudedBRepFace3[];
  readonly samples:readonly AlgebraicCoordinates3[];
  locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
const Z=vector3(0n,0n,1n),xy=planeFrame3(point3(0n,0n,0n),vector3(1n,0n,0n),vector3(0n,1n,0n));
const use=(edge:number,direction:1|-1):BRepEdgeUse3=>({edge,direction});
/** Exact line/circular-arc extrusion, retaining analytic edges/faces rather than
 * tessellating them. Input fill is regularized before checking manifold boundaries.
 * No approximate or falsely algebraic curved-volume value is returned.
 */
export function extrudeCurveRegionBRep3(input:CurveRegion2,height:ExactInput,options:ExtrudeBRepOptions3={}):ExtrudedBRep3 {
  const h=exactRational(height),base=exactRational(options.baseZ??0n);if(h.sign()===0)throw new RangeError('Extrusion height must be nonzero');
  const end=base.add(h),zMin=h.sign()>0?base:end,zMax=h.sign()>0?end:base;
  const normalized=booleanCurveRegions2(input,[],'union',options.fillRule??'even-odd');
  // Rebuild only the resulting true boundaries, removing internal arrangement
  // subdivisions before partitioning connected material components.
  const region=booleanCurveRegions2(normalized.rings,[],'union','nonzero'),a=region.arrangement;
  if(a.outgoing.some(ids=>ids.length!==2))throw new RangeError('Extrusion requires disjoint manifold profile boundaries');
  const selected=new Set(region.selectedFaces),sourceFace=new Map<number,number>();
  a.edges.forEach((edge,id)=>{
    if(edge.uses.length!==1)throw new Error('Canonical region has a multiply used boundary edge');
    const u=edge.uses[0]!,left=a.halfEdgeFaces[2*id+(u.direction===1?0:1)]!,right=a.halfEdgeFaces[2*id+(u.direction===1?1:0)]!;
    if(!selected.has(left)||selected.has(right))throw new Error('Canonical boundary material must lie on its left');
    const prior=sourceFace.get(u.source);if(prior!==undefined&&prior!==left)throw new Error('Boundary primitive spans distinct material faces');sourceFace.set(u.source,left);
  });
  const groups=new Map<number,(readonly CurveBoundary2[])[]>();let source=0;
  for(const ring of normalized.rings){
    const face=sourceFace.get(source);if(face===undefined)throw new Error('Canonical boundary has no material face');
    for(let i=0;i<ring.length;i++)if(sourceFace.get(source++)!==face)throw new Error('One manifold boundary loop borders different material faces');
    const values=groups.get(face);if(values)values.push(ring);else groups.set(face,[ring]);
  }
  if(groups.size!==region.selectedFaces.length)throw new Error('Material component boundary partition is incomplete');
  const profiles=Object.freeze(region.selectedFaces.map(id=>preparePlanarFace3(xy,groups.get(id)!))),edges:Curve3[]=[],inputs:BRepFaceInput3[]=[],faces:ExtrudedBRepFace3[]=[];
  const addEdge=(curve:Curve3)=>{const id=edges.length;edges.push(curve);return id;};
  const pushPlanar=(face:PreparedPlanarFace3,loops:readonly (readonly BRepEdgeUse3[])[])=>{inputs.push({surface:{kind:'plane',plane:face.surface},sense:face.sense,loops});faces.push(Object.freeze({kind:'planar',face}));};
  const lowerShift=vector3(0n,0n,zMin),upperShift=vector3(0n,0n,zMax);
  for(const profile of profiles){
    if(profile.domain.kind!=='chart')throw new Error('Extrusion profile must retain its chart construction');
    const sourceRings=profile.domain.region.rings;
    const rings=sourceRings.map((ring,r)=>{
      if(ring.length!==profile.boundary[r]!.length)throw new Error('Profile trim provenance lost');
      const pieces=ring.map((curve,i)=>{
        const geometry=profile.boundary[r]![i]!,bottom=addEdge(translateCurve3(geometry,lowerShift)),top=addEdge(translateCurve3(geometry,upperShift));
        return {curve,geometry,bottom,top};
      });
      const generators=pieces.map(p=>{const point=curveEndpoints3(p.geometry)[0];return addEdge(Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(translateAlgebraicPoint3(point,lowerShift),translateAlgebraicPoint3(point,upperShift))}));});
      return {pieces,generators};
    });
    const lower=translatePlanarFace3(profile,lowerShift,-1),upper=translatePlanarFace3(profile,upperShift,1);
    pushPlanar(lower,rings.map(r=>r.pieces.slice().reverse().map(p=>use(p.bottom,-1))));
    pushPlanar(upper,rings.map(r=>r.pieces.map(p=>use(p.top,1))));
    for(const {pieces,generators} of rings)pieces.forEach((p,i)=>{
      const loops=[[use(p.bottom,1),use(generators[(i+1)%pieces.length]!,1),use(p.top,-1),use(generators[i]!,-1)]];
      if(p.curve.kind==='line'){
        const interval=p.curve.interval,line=interval.line,A=interval.startParameter,B=interval.endParameter,forward=A.compare(B)<0;
        const frame=planeFrame3(point3(line.origin.x,line.origin.y,0n),vector3(line.direction.x,line.direction.y,0n),Z);
        const wall=prepareRectangleFace3(frame,forward?A:B,forward?B:A,zMin,zMax,forward?1:-1);pushPlanar(wall,loops);
      }else if(p.curve.kind==='arc'){
        const arc=p.curve.arc;if(arc.fullCircle)throw new Error('Noded circular profile must retain its extrema cuts');
        const c=arc.circle,center=point3(c.center.x,c.center.y,0n),angular=circularArc3(circle3(center,Z,c.radiusSquared),mapPlanePoint3(xy,arc.start),mapPlanePoint3(xy,arc.end),{direction:arc.direction});
        const wall=prepareCylinderFace3(cylinder3(line3(center,Z),c.radiusSquared),zMin,zMax,{angular,sense:arc.direction==='ccw'?1:-1});
        inputs.push({surface:{kind:'cylinder',cylinder:wall.surface},sense:wall.sense,loops});faces.push(Object.freeze({kind:'cylindrical',face:wall}));
      }else throw new Error('Canonical profile boundary must use noded lines/arcs');
    });
  }
  const topology=buildBRepTopology3(edges,inputs);
  if(!topology.closedOrientedIncidence||topology.issues.length||topology.shells.length!==profiles.length)throw new Error('Extruded BRep closed oriented incidence invariant failed');
  const locate:ExtrudedBRep3['locate']=inputPoint=>{
    const p=snapshotExactPoint3(inputPoint),lo=p.z.compare(AlgebraicReal.fromRational(zMin)),hi=p.z.compare(AlgebraicReal.fromRational(zMax));if(lo<0||hi>0)return 'outside';
    const data=getPointParameterization3(p),point=data?algebraicPoint2(point2(data.origin.x,data.origin.y),point2(data.direction.x,data.direction.y),data.parameter):algebraicCoordinates2(p.x,p.y),position=region.locate(point);
    return position==='outside'?'outside':position==='boundary'||lo===0||hi===0?'boundary':'inside';
  };
  const middle=vector3(0n,0n,zMin.add(zMax).div(new Rational(2n))),samples=Object.freeze(profiles.map(p=>translateAlgebraicPoint3(p.sample,middle)));
  if(samples.some(p=>locate(p)!=='inside'))throw new Error('Extrusion interior witness invariant failed');
  return Object.freeze({region,profiles,zMin,zMax,topology,faces:Object.freeze(faces),samples,locate});
}
