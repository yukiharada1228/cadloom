import {Polynomial} from '../numeric/polynomial.js';
import {Rational} from '../numeric/rational.js';
import type {Sign} from '../numeric/rational.js';
import {AlgebraicReal} from '../numeric/real-roots.js';
import {point3,vector3,dot3,cross3} from './point3.js';
import {point2} from './point2.js';
import {algebraicPoint2} from './algebraic-point2.js';
import type {Point3} from './point3.js';
import {plane3,intersectPlanes3} from './plane3.js';
import type {Plane3} from './plane3.js';
import {cylinder3,classifyPointToSurface3} from './surface3.js';
import type {Cylinder3} from './surface3.js';
import {algebraicLine3} from './algebraic-line3.js';
import type {AlgebraicLine3} from './algebraic-line3.js';
import {algebraicQuadraticPoint3,algebraicCoordinates3,compareAlgebraicPoints3,snapshotExactPoint3,getPointParameterization3,getRationalParameterization3,algebraicRationalPoint3,algebraicPoint3,rationalPointLinearNumerator3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import {pointInPlaneFrame3,mapPlanePoint3} from './plane-frame3.js';
import type {PlaneFrame3} from './plane-frame3.js';
import {translatePlanarFace3} from './planar-face3.js';
import type {PreparedPlanarFace3} from './planar-face3.js';
import {intersectPlaneCylinder3} from './plane-cylinder3.js';
import {curveEndpoints3,pointOnCurve3,reverseCurve3} from './curve3.js';
import type {Curve3} from './curve3.js';
import {algebraicSegment3} from './algebraic-segment3.js';
import {ellipticArc3,fullEllipseArc3,locatePointInEllipse3} from './ellipse3.js';
import type {Ellipse3} from './ellipse3.js';
import {collectCurveNodingEvents3} from './curve-noding3.js';
import {chartGeometry,duals,map,mapQ,uniqueReals,samePoint} from './planar-trim-utils3.js';
import {evaluatePlaneAtAlgebraicPoint3 as evaluate} from './algebraic-segment-plane3.js';
import {sewBRepFaces3} from './sew-brep3.js';
import type {SewnBRep3} from './sew-brep3.js';
import type {CurveRegionLocation2} from './curve-boolean2.js';
const zero=new Rational(0n),one=new Rational(1n),two=new Rational(2n);
export type PlanarVerticalBound3={readonly kind:'segment';readonly curve:Extract<Curve3,{kind:'algebraic-segment'}>}|{readonly kind:'ellipse';readonly ellipse:Ellipse3;readonly branch:-1|1};
export interface PlanarCylinderFaceCell3 {
 readonly left:AlgebraicReal;readonly right:AlgebraicReal;readonly lower:PlanarVerticalBound3;readonly upper:PlanarVerticalBound3;
 readonly side:Sign;readonly cylinderSides:readonly Sign[];readonly planeSides:readonly Sign[];readonly sample:AlgebraicCoordinates3;readonly boundary:readonly Curve3[];
 locate(point:Point3|AlgebraicCoordinates3):CurveRegionLocation2;
}
export interface PlanarFaceCylinderPartition3 {
 readonly base:PreparedPlanarFace3;readonly frame:PlaneFrame3;readonly cutter:Cylinder3;readonly planes:readonly Plane3[];
 readonly cutters:readonly Cylinder3[];
 readonly cells:readonly PlanarCylinderFaceCell3[];readonly sewn:SewnBRep3;
 /** Boundary/support intersections and extrema; not a contact multiplicity certificate. */
 readonly events:readonly AlgebraicCoordinates3[];
}
const owned=new WeakSet<PlanarFaceCylinderPartition3>();
export function assertOwnedPlanarFaceCylinderPartition3(input:PlanarFaceCylinderPartition3):void {if(!owned.has(input))throw new RangeError('Expected a factory-created planar cylinder partition');}
function between(lower:AlgebraicReal,upper:AlgebraicReal):Rational {let a=lower,b=upper;while(a.upper.compare(b.lower)>=0){a=a.refine();b=b.refine();}return a.upper.add(b.lower).div(two);}
/** Vertical native-conic arrangement in an owned planar face. Complete events
 * split embedded strip cells; artificial vertical cuts remain in the result.
 */
export function partitionPlanarFaceByCylinder3(input:PreparedPlanarFace3,inputCutter:Cylinder3,inputPlanes:readonly Plane3[]=[]):PlanarFaceCylinderPartition3 {
 return partitionPlanarFaceByCylinders3(input,[inputCutter],inputPlanes);
}
/** Exact simultaneous arrangement of all cylinder sections and plane cuts. */
export function partitionPlanarFaceByCylinders3(input:PreparedPlanarFace3,inputCutters:readonly Cylinder3[],inputPlanes:readonly Plane3[]=[]):PlanarFaceCylinderPartition3 {
 if(!inputCutters.length)throw new RangeError("At least one cylinder cutter is required");
 const cutters=Object.freeze(inputCutters.map(c=>cylinder3(c.axis,c.radiusSquared))),cutter=cutters[0]!;
 const base=translatePlanarFace3(input,vector3(0n,0n,0n)),planes=Object.freeze(inputPlanes.map(p=>plane3(p.normal.x,p.normal.y,p.normal.z,p.offset))),original=chartGeometry(base),frame=original.frame,[DU,DV]=duals(frame),curves:Curve3[]=[...original.curves],known:AlgebraicCoordinates3[]=[];
 function lineCurve(line:AlgebraicLine3):Curve3 {
  const p=pointInPlaneFrame3(frame,line.origin)!;const dx=dot3(DU,line.direction),dy=dot3(DV,line.direction),coordinate=dx.sign()!==0?'x':'y',rate=coordinate==='x'?dx:dy,start=coordinate==='x'?original.xMin:original.yMin,end=coordinate==='x'?original.xMax:original.yMax;
  const at=(bound:Rational)=>{const t=AlgebraicReal.fromRational(bound).sub(p[coordinate]).affine(one.div(rate)),x=p.x.add(t.affine(dx)),y=p.y.add(t.affine(dy));return map(frame,coordinate==='x'?AlgebraicReal.fromRational(bound):x,coordinate==='y'?AlgebraicReal.fromRational(bound):y);};return Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(at(start),at(end))});
 }
 for(const c of cutters){const section=intersectPlaneCylinder3(base.surface,c);
 if(section.kind==='ellipse')curves.push(Object.freeze({kind:'elliptic-arc',arc:fullEllipseArc3(section.ellipse)}));else if(section.kind==='lines')for(const item of section.lines)curves.push(lineCurve(item.line));
 }
 for(const p of planes){const hit=intersectPlanes3(base.surface,p);if(hit.kind==='line')curves.push(lineCurve(algebraicLine3(hit.line.origin,hit.line.direction)));}
 known.push(...collectCurveNodingEvents3(curves).map(event=>event.point));
 const full=new Map<Curve3,Curve3>();for(const c of curves)if(c.kind==='elliptic-arc')full.set(c,Object.freeze({kind:'elliptic-arc',arc:fullEllipseArc3(c.arc.ellipse)}));
 // This carrier is used only for chart arithmetic; it confers no face ownership.
 const g=chartGeometry({...base,boundary:[[...curves,...full.values()]]}),arranged=g.curves.slice(0,curves.length),fullFor=new Map<Curve3,Curve3>();let extra=curves.length;curves.forEach((c,i)=>{if(full.has(c))fullFor.set(arranged[i]!,g.curves[extra++]!);});for(const c of arranged)known.push(...g.extrema(c));
 const cuts=uniqueReals([AlgebraicReal.fromRational(original.xMin),AlgebraicReal.fromRational(original.xMax),...g.critical,...known.map(p=>pointInPlaneFrame3(frame,p)!.x)]).filter(x=>x.compare(AlgebraicReal.fromRational(original.xMin))>=0&&x.compare(AlgebraicReal.fromRational(original.xMax))<=0),cells:PlanarCylinderFaceCell3[]=[];
 function bound(c:Curve3,x:AlgebraicReal,y:AlgebraicReal):PlanarVerticalBound3 {if(c.kind==='algebraic-segment')return Object.freeze({kind:'segment',curve:c});if(c.kind!=='elliptic-arc')throw new Error('Unexpected bound');const fullCurve=fullFor.get(c)!;if(fullCurve.kind!=='elliptic-arc')throw new Error('Missing full ellipse');const values=g.slice(fullCurve,x);return Object.freeze({kind:'ellipse',ellipse:fullCurve.arc.ellipse,branch:values[0]!.compare(y)===0?-1:1});}
 function value(b:PlanarVerticalBound3,x:AlgebraicReal):AlgebraicReal {if(b.kind==='segment'){const values=g.slice(b.curve,x);if(values.length!==1)throw new Error('A nonvertical graph bound has no unique value');return values[0]!;}const c=[...fullFor.values()].find(c=>c.kind==='elliptic-arc'&&c.arc.ellipse===b.ellipse);if(!c)throw new Error('Missing ellipse chart');const values=g.slice(c,x);return values.length===1?values[0]!:values[b.branch===-1?0:1]!;}
 const ellipseCache=new Map<Ellipse3,{K:Rational;vertex:Plane3;linear:Polynomial;radicand:Polynomial}>();
 function ellipseData(e:Ellipse3){let result=ellipseCache.get(e);if(result)return result;const [EU,EV]=duals(e.frame),a=dot3(EU,frame.u),b=dot3(EU,frame.v),h=dot3(EU,frame.origin).sub(dot3(EU,e.frame.origin)),d=dot3(EV,frame.u),v=dot3(EV,frame.v),k=dot3(EV,frame.origin).sub(dot3(EV,e.frame.origin)),K=e.radiusVSquared.mul(b.mul(b)).add(e.radiusUSquared.mul(v.mul(v))),L0=e.radiusVSquared.mul(b).mul(h).add(e.radiusUSquared.mul(v).mul(k)).mul(two),L1=e.radiusVSquared.mul(a).mul(b).add(e.radiusUSquared.mul(d).mul(v)).mul(two),n=point3(DU.x.mul(L1).add(DV.x.mul(K).mul(two)),DU.y.mul(L1).add(DV.y.mul(K).mul(two)),DU.z.mul(L1).add(DV.z.mul(K).mul(two)));const linear=new Polynomial([L0,L1]),U=new Polynomial([h,a]),V=new Polynomial([k,d]),constant=U.mul(U).scale(e.radiusVSquared).add(V.mul(V).scale(e.radiusUSquared)).sub(new Polynomial([e.radiusUSquared.mul(e.radiusVSquared)])),radicand=linear.mul(linear).sub(constant.scale(K.mul(new Rational(4n))));result={K,vertex:plane3(n.x,n.y,n.z,L0.sub(dot3(n,frame.origin))),linear,radicand};ellipseCache.set(e,result);return result;}
 function compare(b:PlanarVerticalBound3,p:AlgebraicCoordinates3,x:AlgebraicReal,y:AlgebraicReal):Sign {if(b.kind==='segment')return y.compare(value(b,x));const vertex=classifyPointToSurface3(p,{kind:'plane',plane:ellipseData(b.ellipse).vertex}),location=locatePointInEllipse3(p,b.ellipse),sign=location==='boundary'?0:location==='inside'?-1:1;return b.branch===-1?vertex>0?1:sign===0?0:sign>0?-1:1:vertex<0?-1:sign===0?0:sign>0?1:-1;}
 const rationalGraphs=new Map<Extract<Curve3,{kind:'algebraic-segment'}>,Readonly<{slope:Rational;offset:Rational}>|null>();
 function rationalGraph(curve:Extract<Curve3,{kind:'algebraic-segment'}>){
  const cached=rationalGraphs.get(curve);if(cached!==undefined)return cached;
  const a=pointInPlaneFrame3(frame,curve.segment.start)!,b=pointInPlaneFrame3(frame,curve.segment.end)!,ax=a.x.rational,ay=a.y.rational,bx=b.x.rational,by=b.y.rational;
  let result:Readonly<{slope:Rational;offset:Rational}>|null=null;
  if(ax!==null&&ay!==null&&bx!==null&&by!==null&&!ax.equals(bx)){
   const slope=by.sub(ay).div(bx.sub(ax)),offset=ay.sub(slope.mul(ax));
   result=Object.freeze({slope,offset});
  }
  rationalGraphs.set(curve,result);return result;
 }
 function point(b:PlanarVerticalBound3,x:AlgebraicReal):AlgebraicCoordinates3 {
  for(const p of known){const q=pointInPlaneFrame3(frame,p)!;if(q.x.compare(x)!==0)continue;if(compare(b,p,q.x,q.y)===0)return p;
   if(b.kind==='ellipse'&&locatePointInEllipse3(p,b.ellipse)==='boundary'){
    // The other vertical root is a rational affine reflection y -> -L(x)/K-y.
    // Preserve the known event's source field instead of taking another radical.
    const data=ellipseData(b.ellipse),rational=getRationalParameterization3(p),affine=getPointParameterization3(p),axes=['x','y','z'] as const;
    if(rational){const T=rationalPointLinearNumerator3(rational,data.vertex.normal,data.vertex.offset).scale(one.div(data.K));return algebraicRationalPoint3(rational.parameter,rational.numerators.map((N,i)=>N.sub(T.scale(frame.v[axes[i]!])) ) as [Polynomial,Polynomial,Polynomial],rational.denominator);}
    if(affine){const t0=dot3(data.vertex.normal,affine.origin).add(data.vertex.offset).div(data.K),rate=dot3(data.vertex.normal,affine.direction).div(data.K);return algebraicPoint3(point3(...axes.map(k=>affine.origin[k].sub(frame.v[k].mul(t0))) as Parameters<typeof point3>),point3(...axes.map(k=>affine.direction[k].sub(frame.v[k].mul(rate))) as Parameters<typeof point3>),affine.parameter);}
   }
  }
  if(b.kind==='segment'){
   // A rational chart line y=m*x+k has world point o+v*k+(u+v*m)*x.
   // The affine plane map retains both that source field and its actual fixed-x line construction.
   const graph=rationalGraph(b.curve);if(graph)return mapPlanePoint3(frame,algebraicPoint2(point2(0n,graph.offset),point2(1n,graph.slope),x));
  }
  if(b.kind==='ellipse'){
   // y=(-L(x) +/- sqrt(L(x)^2-4*K*M(x)))/(2*K). Preserve x as
   // the common source so support predicates reduce in one quadratic field.
   const data=ellipseData(b.ellipse),D=data.K.mul(two),axes=['x','y','z'] as const,N=axes.map(k=>new Polynomial([frame.origin[k],frame.u[k]]).scale(D).sub(data.linear.scale(frame.v[k]))) as [Polynomial,Polynomial,Polynomial],coefficients=point3(...axes.map(k=>frame.v[k].mul(new Rational(BigInt(b.branch)))) as Parameters<typeof point3>);
   return algebraicQuadraticPoint3(x,N,coefficients,data.radicand,new Polynomial([D]));
  }
  return map(frame,x,value(b,x));
 }
 function graph(b:PlanarVerticalBound3,left:AlgebraicReal,right:AlgebraicReal):Curve3 {const start=point(b,left),end=point(b,right);if(b.kind==='segment')return Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(start,end)});const orientation=dot3(cross3(b.ellipse.frame.u,b.ellipse.frame.v),cross3(frame.u,frame.v)).sign(),direction=orientation*(b.branch===-1?1:-1)>0?'ccw':'cw';return Object.freeze({kind:'elliptic-arc',arc:ellipticArc3(b.ellipse,start,end,{direction})});}
 for(let i=0;i+1<cuts.length;i++){
  const left=cuts[i]!,right=cuts[i+1]!,x=AlgebraicReal.fromRational(between(left,right)),hits=arranged.flatMap(curve=>g.slice(curve,x).map(y=>({curve,y}))).sort((a,b)=>a.y.compare(b.y)).filter((p,i,all)=>i===0||p.y.compare(all[i-1]!.y)!==0);
  for(let j=0;j+1<hits.length;j++){
   const lo=hits[j]!,hi=hits[j+1]!,sample=snapshotExactPoint3(mapQ(frame,x.rational!,between(lo.y,hi.y)));if(base.locate(sample)!=='inside')continue;
   const lower=bound(lo.curve,x,lo.y),upper=bound(hi.curve,x,hi.y),bottom=graph(lower,left,right),top=graph(upper,left,right),[bl,br]=curveEndpoints3(bottom),[tl,tr]=curveEndpoints3(top),loop:Curve3[]=[bottom];if(!samePoint(br,tr))loop.push(Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(br,tr)}));loop.push(reverseCurve3(top));if(!samePoint(tl,bl))loop.push(Object.freeze({kind:'algebraic-segment',segment:algebraicSegment3(tl,bl)}));
   const boundary=Object.freeze(dot3(base.normal,cross3(frame.u,frame.v)).sign()>0?loop:[...loop].reverse().map(reverseCurve3)),cylinderSides=Object.freeze(cutters.map(cylinder=>classifyPointToSurface3(sample,{kind:'cylinder',cylinder}))),side=cylinderSides[0]!,planeSides=Object.freeze(planes.map(p=>{const sign=evaluate(p,sample).sign();if(sign===0&&intersectPlanes3(base.surface,p).kind!=='coincident')throw new Error('Open planar cell contains an unpartitioned plane zero');return sign;}));if(cylinderSides.some(s=>s===0))throw new Error('A planar open cell lies on an unpartitioned cylinder zero');
   const locate:PlanarCylinderFaceCell3['locate']=inputPoint=>{const p=snapshotExactPoint3(inputPoint),q=pointInPlaneFrame3(frame,p);if(q===null)return 'outside';const l=q.x.compare(left),r=q.x.compare(right);if(l<0||r>0)return 'outside';const a=compare(lower,p,q.x,q.y),b=compare(upper,p,q.x,q.y);return a<0||b>0?'outside':l===0||r===0||a===0||b===0?'boundary':'inside';};const cell=Object.freeze({left,right,lower,upper,side,cylinderSides,planeSides,sample,boundary,locate});if(locate(sample)!=='inside')throw new Error('Planar cell lacks an interior witness');cells.push(cell);
  }
 }
 if(!cells.length)throw new Error('A nonempty planar source produced no arrangement cells');
 const sewn=sewBRepFaces3(cells.map(c=>({surface:{kind:'plane' as const,plane:base.surface},sense:base.sense,loops:[c.boundary]}))),result=Object.freeze({base,frame,cutter,cutters,planes,cells:Object.freeze(cells),sewn,events:Object.freeze(known.filter((p,i,all)=>all.findIndex(q=>samePoint(p,q))===i&&base.locate(p)!=='outside'))});owned.add(result);return result;
}
