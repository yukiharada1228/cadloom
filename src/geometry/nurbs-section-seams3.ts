import {Rational} from '../numeric/rational.js';
import {Polynomial} from '../numeric/polynomial.js';
import {AlgebraicReal,isolateRealRoots} from '../numeric/real-roots.js';
import type {ExactInput} from './point2.js';
import {compareAlgebraicPoints3} from './algebraic-point3.js';
import type {AlgebraicCoordinates3} from './algebraic-point3.js';
import type {NurbsSurfacePatch3} from './nurbs-surface3.js';
import {assertOwnedNurbsPlaneSection3,liftNurbsSectionPatch3,nurbsPlaneSectionVertex3,nurbsPlaneSectionEdgePoint3} from './nurbs-plane-section3.js';
import type {NurbsPlaneSection3} from './nurbs-plane-section3.js';

export interface NurbsSectionCell3 {readonly kind:'piece'|'area';readonly index:number;}
export interface NurbsSectionSeam3 {
  readonly first:NurbsSectionCell3;readonly second:NurbsSectionCell3;
  /** Named parameter is fixed; the other varies over [lower,upper]. */
  readonly axis:'u'|'v';readonly fixed:Rational;readonly lower:Rational;readonly upper:Rational;
  /** Matching section points at the SAME parameter, not arbitrary spatial overlap. */
  readonly kind:'interval'|'points'|'none';readonly points:readonly AlgebraicReal[];
}
export interface NurbsSectionVertexUse3 {readonly piece:number;readonly vertex:number|null;readonly edge:number|null;}
export interface NurbsSectionComplexVertex3 {
  readonly u:AlgebraicReal;readonly v:AlgebraicReal;readonly point:AlgebraicCoordinates3;
  readonly uses:readonly NurbsSectionVertexUse3[];readonly areas:readonly number[];
}
export interface NurbsSectionComplexEdge3 {
  readonly from:number;readonly to:number;
  /** Source edge coordinate: u for a branch, v for a vertical edge. */
  readonly lower:AlgebraicReal;readonly upper:AlgebraicReal;
  readonly uses:readonly {readonly piece:number;readonly edge:number}[];
  /** Whole-interval matches on contained-patch boundaries. */
  readonly areas:readonly number[];
}
export interface NurbsSectionComplex3 {
  readonly source:NurbsPlaneSection3;
  readonly vertices:readonly NurbsSectionComplexVertex3[];readonly edges:readonly NurbsSectionComplexEdge3[];
  readonly seams:readonly NurbsSectionSeam3[];
  readonly areaCornerLinks:readonly {readonly first:number;readonly second:number;readonly u:Rational;readonly v:Rational}[];
  /** Areas index source.containedPatches. Components describe this seam quotient,
   * not the topology of a potentially self-overlapping spatial surface image.
   */
  readonly components:readonly {readonly vertices:readonly number[];readonly edges:readonly number[];readonly areas:readonly number[]}[];
}
type Line={axis:'u'|'v';fixed:Rational};
type Cell={ref:NurbsSectionCell3;patch:NurbsSurfacePatch3};
const owned=new WeakSet<NurbsSectionComplex3>(),real=(x:AlgebraicReal|ExactInput)=>x instanceof AlgebraicReal?x:AlgebraicReal.fromRational(x);
const key=(line:Line)=>line.axis+':'+line.fixed.toString();
const max=(a:Rational,b:Rational)=>a.compare(b)>0?a:b,min=(a:Rational,b:Rational)=>a.compare(b)<0?a:b;
function boundary(p:NurbsSurfacePatch3,line:Line):readonly Polynomial[]{return [p.x,p.y,p.z,p.weight].map(f=>line.axis==='u'?f.specializeU(line.fixed):f.specializeV(line.fixed));}
function sameMaps(a:NurbsSurfacePatch3,b:NurbsSurfacePatch3,line:Line):boolean {
  const A=boundary(a,line),B=boundary(b,line);return [0,1,2].every(i=>A[i]!.mul(B[3]!).sub(B[i]!.mul(A[3]!)).degree<0);
}
function onBoundary(p:NurbsSurfacePatch3,line:Line):boolean {return line.axis==='u'?line.fixed.equals(p.startU)||line.fixed.equals(p.endU):line.fixed.equals(p.startV)||line.fixed.equals(p.endV);}
function interval(p:NurbsSurfacePatch3,line:Line):readonly [Rational,Rational]{return line.axis==='u'?[p.startV,p.endV]:[p.startU,p.endU];}
function inside(p:NurbsSurfacePatch3,u:AlgebraicReal,v:AlgebraicReal):boolean{return u.compare(real(p.startU))>=0&&u.compare(real(p.endU))<=0&&v.compare(real(p.startV))>=0&&v.compare(real(p.endV))<=0;}
/** Sew only equal-parameter boundary contacts. Node seam edges before merging;
 * distinct-parameter spatial overlaps and surface embedding are not certified.
 */
export function sewNurbsPlaneSection3(source:NurbsPlaneSection3):NurbsSectionComplex3 {
  assertOwnedNurbsPlaneSection3(source);
  const cells:Cell[]=[...source.pieces.map((p,index)=>({ref:Object.freeze({kind:'piece' as const,index}),patch:p.patch})),...source.containedPatches.map((patch,index)=>({ref:Object.freeze({kind:'area' as const,index}),patch}))],cuts=new Map<string,AlgebraicReal[]>(),seams:NurbsSectionSeam3[]=[],areaCornerLinks:{first:number;second:number;u:Rational;v:Rational}[]=[];
  const addCut=(line:Line,t:AlgebraicReal)=>{const k=key(line);let values=cuts.get(k);if(!values){values=[];cuts.set(k,values);}values.push(t);};
  for(const {patch:p} of cells)for(const u of [p.startU,p.endU])for(const v of [p.startV,p.endV]){addCut({axis:'u',fixed:u},real(v));addCut({axis:'v',fixed:v},real(u));}
  source.pieces.forEach(({patch:p,topology:t})=>t.vertices.forEach(v=>{
    for(const u of [p.startU,p.endU])if(v.u.compare(real(u))===0)addCut({axis:'u',fixed:u},v.v);
    for(const y of [p.startV,p.endV])if(v.v.compare(real(y))===0)addCut({axis:'v',fixed:y},v.u);
  }));
  const planePolynomial=(H:readonly Polynomial[])=>H[0]!.scale(source.plane.normal.x).add(H[1]!.scale(source.plane.normal.y)).add(H[2]!.scale(source.plane.normal.z)).add(H[3]!.scale(source.plane.offset));
  for(let i=0;i<cells.length;i++)for(let j=i+1;j<cells.length;j++){
    const a=cells[i]!,b=cells[j]!,A=a.patch,B=b.patch,u0=max(A.startU,B.startU),u1=min(A.endU,B.endU),v0=max(A.startV,B.startV),v1=min(A.endV,B.endV);if(u0.compare(u1)>0||v0.compare(v1)>0)continue;
    let line:Line|undefined,lower:Rational|undefined,upper:Rational|undefined;
    if(u0.equals(u1)&&v0.compare(v1)<0){line={axis:'u',fixed:u0};lower=v0;upper=v1;}
    else if(v0.equals(v1)&&u0.compare(u1)<0){line={axis:'v',fixed:v0};lower=u0;upper=u1;}
    else if(u0.equals(u1)&&v0.equals(v1)&&a.ref.kind==='area'&&b.ref.kind==='area'&&compareAlgebraicPoints3(liftNurbsSectionPatch3(A,real(u0),real(v0)),liftNurbsSectionPatch3(B,real(u0),real(v0)))===0){areaCornerLinks.push(Object.freeze({first:a.ref.index,second:b.ref.index,u:u0,v:v0}));}
    if(!line||lower===undefined||upper===undefined)continue;
    const X=boundary(A,line),Y=boundary(B,line),equations=[...([0,1,2].map(c=>X[c]!.mul(Y[3]!).sub(Y[c]!.mul(X[3]!)))),planePolynomial(X),planePolynomial(Y)],gcd=equations.reduce((g,p)=>g.gcd(p),new Polynomial()),points=gcd.degree>0?isolateRealRoots(gcd).map(p=>p.recognizeRational()).filter(p=>p.compare(real(lower!))>=0&&p.compare(real(upper!))<=0):[],kind=gcd.degree<0?'interval' as const:points.length?'points' as const:'none' as const;
    if(kind==='interval'){addCut(line,real(lower));addCut(line,real(upper));}else for(const p of points)addCut(line,p);
    seams.push(Object.freeze({first:a.ref,second:b.ref,...line,lower,upper,kind,points:Object.freeze(points)}));
  }
  for(const [k,values] of cuts)cuts.set(k,values.sort((a,b)=>a.compare(b)).filter((v,i,all)=>i===0||v.compare(all[i-1]!)!==0));
  type MutableVertex={u:AlgebraicReal;v:AlgebraicReal;point:AlgebraicCoordinates3;uses:NurbsSectionVertexUse3[];areas:number[]};
  type MutableEdge={from:number;to:number;lower:AlgebraicReal;upper:AlgebraicReal;uses:{piece:number;edge:number}[];areas:number[];line:Line|null};
  const vertices:MutableVertex[]=[],edges:MutableEdge[]=[];
  const vertex=(u:AlgebraicReal,v:AlgebraicReal,point:AlgebraicCoordinates3,use:NurbsSectionVertexUse3):number=>{
    let id=vertices.findIndex(p=>p.u.compare(u)===0&&p.v.compare(v)===0&&compareAlgebraicPoints3(p.point,point)===0);if(id<0){id=vertices.length;vertices.push({u,v,point,uses:[],areas:[]});}
    const uses=vertices[id]!.uses;if(!uses.some(p=>p.piece===use.piece&&p.vertex===use.vertex&&p.edge===use.edge))uses.push(Object.freeze(use));return id;
  };
  const originals=source.pieces.map(({topology:t},piece)=>t.vertices.map((p,id)=>vertex(p.u,p.v,nurbsPlaneSectionVertex3(source,piece,id),{piece,vertex:id,edge:null})));
  source.pieces.forEach(({patch:p,topology:t},piece)=>t.edges.forEach((e,edge)=>{
    const a=t.vertices[e.from]!,b=t.vertices[e.to]!;let line:Line|null=null;
    if(e.kind==='vertical'){for(const u of [p.startU,p.endU])if(a.u.compare(real(u))===0)line={axis:'u',fixed:u};}
    else for(const v of [p.startV,p.endV])if(e.sample.v.compare(real(v))===0&&t.nonvertical.specializeV(v).degree<0)line={axis:'v',fixed:v};
    const lower=e.kind==='branch'?a.u:a.v,upper=e.kind==='branch'?b.u:b.v,parameters=[lower,...(line?(cuts.get(key(line))??[]).filter(v=>v.compare(lower)>0&&v.compare(upper)<0):[]),upper];
    const ids=parameters.map((value,i)=>{if(i===0)return originals[piece]![e.from]!;if(i===parameters.length-1)return originals[piece]![e.to]!;const u=e.kind==='branch'?value:a.u,v=e.kind==='branch'?a.v:value;return vertex(u,v,nurbsPlaneSectionEdgePoint3(source,piece,edge,value),{piece,vertex:null,edge});});
    for(let i=0;i+1<ids.length;i++){
      const from=ids[i]!,to=ids[i+1]!,prior=line?edges.findIndex(q=>q.line!==null&&key(q.line)===key(line!)&&q.from===from&&q.to===to&&sameMaps(source.pieces[q.uses[0]!.piece]!.patch,p,line!)):-1;
      if(prior>=0)edges[prior]!.uses.push(Object.freeze({piece,edge}));else edges.push({from,to,lower:parameters[i]!,upper:parameters[i+1]!,uses:[Object.freeze({piece,edge})],areas:[],line});
    }
  }));
  vertices.forEach(p=>source.containedPatches.forEach((area,i)=>{if(inside(area,p.u,p.v)&&compareAlgebraicPoints3(p.point,liftNurbsSectionPatch3(area,p.u,p.v))===0)p.areas.push(i);}));
  edges.forEach(e=>{if(!e.line)return;const p=source.pieces[e.uses[0]!.piece]!.patch;source.containedPatches.forEach((area,i)=>{const [lo,hi]=interval(area,e.line!);if(onBoundary(area,e.line!)&&e.lower.compare(real(lo))>=0&&e.upper.compare(real(hi))<=0&&sameMaps(p,area,e.line!))e.areas.push(i);});});
  const offset=vertices.length,parents=Array.from({length:offset+source.containedPatches.length},(_,i)=>i),find=(id:number):number=>{while(parents[id]!==id){parents[id]=parents[parents[id]!]!;id=parents[id]!;}return id;},join=(a:number,b:number)=>{a=find(a);b=find(b);parents[Math.max(a,b)]=Math.min(a,b);};
  edges.forEach(e=>join(e.from,e.to));vertices.forEach((v,i)=>v.areas.forEach(a=>join(i,offset+a)));
  seams.forEach(s=>{if(s.first.kind==='area'&&s.second.kind==='area'&&s.kind!=='none')join(offset+s.first.index,offset+s.second.index);});areaCornerLinks.forEach(c=>join(offset+c.first,offset+c.second));
  const groups=new Map<number,{vertices:number[];edges:number[];areas:number[]}>(),group=(id:number)=>{const root=find(id);let value=groups.get(root);if(!value){value={vertices:[],edges:[],areas:[]};groups.set(root,value);}return value;};
  vertices.forEach((_,i)=>group(i).vertices.push(i));source.containedPatches.forEach((_,i)=>group(offset+i).areas.push(i));edges.forEach((e,i)=>group(e.from).edges.push(i));
  const result:NurbsSectionComplex3=Object.freeze({source,vertices:Object.freeze(vertices.map(v=>Object.freeze({...v,uses:Object.freeze(v.uses),areas:Object.freeze(v.areas)}))),edges:Object.freeze(edges.map(({line:_,...e})=>Object.freeze({...e,uses:Object.freeze(e.uses),areas:Object.freeze(e.areas)}))),seams:Object.freeze(seams),areaCornerLinks:Object.freeze(areaCornerLinks),components:Object.freeze([...groups.values()].map(g=>Object.freeze({vertices:Object.freeze(g.vertices),edges:Object.freeze(g.edges),areas:Object.freeze(g.areas)})))});owned.add(result);return result;
}
export function nurbsSectionComplexEdgePoint3(input:NurbsSectionComplex3,edge:number,parameter:AlgebraicReal|ExactInput):AlgebraicCoordinates3 {
  if(!owned.has(input))throw new RangeError('Complex evaluation requires a factory-created section complex');
  if(!Number.isSafeInteger(edge)||edge<0||edge>=input.edges.length)throw new RangeError('Invalid section complex edge');const e=input.edges[edge]!,t=real(parameter);if(t.compare(e.lower)<0||t.compare(e.upper)>0)throw new RangeError('Parameter is outside the section complex edge');const use=e.uses[0]!;return nurbsPlaneSectionEdgePoint3(input.source,use.piece,use.edge,t);
}
