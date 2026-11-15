import {brepCurveSchema3} from './brep-curve3.js';
import type {BRepCurveRecord3} from './brep-curve3.js';
import type {Schema3} from './schema.js';
import {faceDomainSchema3} from './face-domain3.js';
import type {FaceDomainRecord3} from './face-domain3.js';
import {RecordReader3,objectSchema3,taggedSchema3,arraySchema3,literalSchema3,indexSchema3,directionSchema3,booleanSchema3,recordError3} from './schema.js';
import type {RecordReadLimits3} from './schema.js';
import {realSchema3,pointSchema3} from './exact3.js';
import type {ExactRealRecord3,ExactPointRecord3} from './exact3.js';
import {curveSchema3,surfaceSchema3} from './geometry3.js';
import type {CurveRecord3,SurfaceRecord3} from './geometry3.js';

export interface BodyEdgeRecord3 {readonly curve:number;readonly start:number;readonly end:number;}
export interface BodyEdgeUseRecord3 {readonly edge:number;readonly direction:1|-1;/** If present, a local (u,v,0) curve traversed with this use. */readonly pcurve?:number;}
export interface BodyLoopRecord3 {readonly uses:readonly BodyEdgeUseRecord3[];}
export interface BodyFaceRecord3 {readonly surface:number;readonly sense:1|-1;readonly loops:readonly number[];readonly parameterBounds?:readonly [ExactRealRecord3,ExactRealRecord3,ExactRealRecord3,ExactRealRecord3];readonly domain?:FaceDomainRecord3;}
export type BodyShellRecord3=
 | {readonly kind:'faces';readonly faces:readonly {readonly face:number;readonly direction:1|-1}[];readonly wires:readonly number[]}
 | {readonly kind:'wire';readonly edges:readonly number[]}
 | {readonly kind:'vertex';readonly vertex:number};
/** Index 0 is infinite, never void. For bounded regions shells[0] is the outer
 * shell and later entries bound cavities. Shells may be shared by two regions.
 * These are declared roles, not a containment or material certificate.
 */
export interface BodyRegionRecord3 {readonly shells:readonly number[];readonly void:boolean;}
export type BodyCurveRecord3=CurveRecord3|Extract<BRepCurveRecord3,{kind:'cylinder-ssi'}>;
const bodyCurveSchema3:Schema3=(v,p,r)=>v!==null&&typeof v==='object'&&Object.hasOwn(v,'kind')&&(v as {kind:unknown}).kind==='cylinder-ssi'?brepCurveSchema3(v,p,r):curveSchema3(v,p,r);
export interface BodyRecord3 {
  readonly version:1;readonly units:'mm';readonly coordinates:'right-handed-z-up';
  /** Bounded geometry; edge/face use and pcurve correspondence remain explicit. */
  readonly curves:readonly BodyCurveRecord3[];readonly surfaces:readonly SurfaceRecord3[];
  readonly vertices:readonly ExactPointRecord3[];readonly edges:readonly BodyEdgeRecord3[];
  readonly loops:readonly BodyLoopRecord3[];readonly faces:readonly BodyFaceRecord3[];
  readonly shells:readonly BodyShellRecord3[];readonly regions:readonly BodyRegionRecord3[];
}
const indices=arraySchema3(indexSchema3),useSchema=objectSchema3({edge:indexSchema3,direction:directionSchema3},{pcurve:indexSchema3}),shellSchema=taggedSchema3({
  faces:objectSchema3({kind:literalSchema3('faces'),faces:arraySchema3(objectSchema3({face:indexSchema3,direction:directionSchema3}),1),wires:indices}),
  wire:objectSchema3({kind:literalSchema3('wire'),edges:arraySchema3(indexSchema3,1)}),
  vertex:objectSchema3({kind:literalSchema3('vertex'),vertex:indexSchema3}),
});
export const bodySchema3=objectSchema3({version:literalSchema3(1),units:literalSchema3('mm'),coordinates:literalSchema3('right-handed-z-up'),curves:arraySchema3(bodyCurveSchema3),surfaces:arraySchema3(surfaceSchema3),vertices:arraySchema3(pointSchema3),edges:arraySchema3(objectSchema3({curve:indexSchema3,start:indexSchema3,end:indexSchema3})),loops:arraySchema3(objectSchema3({uses:arraySchema3(useSchema,1)})),faces:arraySchema3(objectSchema3({surface:indexSchema3,sense:directionSchema3,loops:indices},{parameterBounds:arraySchema3(realSchema3,4,4),domain:faceDomainSchema3})),shells:arraySchema3(shellSchema),regions:arraySchema3(objectSchema3({shells:indices,void:booleanSchema3}),1)});
/** Strict, immutable JSON/data snapshot. No geometry evaluation or body certification. */
export function readBodyRecord3(input:unknown,limits:RecordReadLimits3={}):BodyRecord3 {
  const b=bodySchema3(input,'body',new RecordReader3(limits)) as unknown as BodyRecord3;
  const ref=(id:number,length:number,path:string)=>{if(id>=length)recordError3(path,'reference is out of range');};
  const unique=(ids:readonly number[],path:string)=>{if(new Set(ids).size!==ids.length)recordError3(path,'duplicate reference');};
  const dimensions=(degree:number,n:number,k:number,path:string)=>{if(degree<1||n<degree+1||k!==n+degree+1)recordError3(path,'NURBS degree, point and knot counts disagree');};
  b.curves.forEach((c,i)=>{if(c.kind==='nurbs'){dimensions(c.degree,c.points.length,c.knots.length,`curves[${i}]`);if(c.weights.length!==c.points.length)recordError3(`curves[${i}].weights`,'NURBS weight count disagrees');}});
  b.surfaces.forEach((s,i)=>{if(s.kind==='nurbs'){
    const n=s.points.length,m=s.points[0]?.length??0;dimensions(s.degreeU,n,s.knotsU.length,`surfaces[${i}].u`);dimensions(s.degreeV,m,s.knotsV.length,`surfaces[${i}].v`);
    if(s.points.some(row=>row.length!==m)||s.weights.length!==n||s.weights.some(row=>row.length!==m))recordError3(`surfaces[${i}]`,'NURBS grid dimensions disagree');
  }});
  b.edges.forEach((e,i)=>{ref(e.curve,b.curves.length,`edges[${i}].curve`);ref(e.start,b.vertices.length,`edges[${i}].start`);ref(e.end,b.vertices.length,`edges[${i}].end`);});
  b.loops.forEach((l,i)=>l.uses.forEach((u,j)=>{
    ref(u.edge,b.edges.length,`loops[${i}].uses[${j}].edge`);if(u.pcurve!==undefined)ref(u.pcurve,b.curves.length,`loops[${i}].uses[${j}].pcurve`);
  }));
  b.loops.forEach((l,i)=>l.uses.forEach((u,j)=>{
    const next=l.uses[(j+1)%l.uses.length]!,a=b.edges[u.edge]!,c=b.edges[next.edge]!,target=u.direction===1?a.end:a.start,origin=next.direction===1?c.start:c.end;
    if(target!==origin)recordError3(`loops[${i}].uses[${j}]`,'edge uses do not form a closed chain');
  }));
  const loopOwners=new Array(b.loops.length).fill(0),faceOwners=new Array(b.faces.length).fill(0),shellOwners=new Array(b.shells.length).fill(0);
  b.faces.forEach((f,i)=>{ref(f.surface,b.surfaces.length,`faces[${i}].surface`);unique(f.loops,`faces[${i}].loops`);for(const l of f.loops){ref(l,b.loops.length,`faces[${i}].loops`);loopOwners[l]++;}});
  b.shells.forEach((s,i)=>{
    if(s.kind==='vertex')ref(s.vertex,b.vertices.length,`shells[${i}].vertex`);
    else if(s.kind==='wire'){unique(s.edges,`shells[${i}].edges`);for(const e of s.edges)ref(e,b.edges.length,`shells[${i}].edges`);}
    else {unique(s.faces.map(f=>f.face),`shells[${i}].faces`);for(const f of s.faces){ref(f.face,b.faces.length,`shells[${i}].faces`);faceOwners[f.face]++;}unique(s.wires,`shells[${i}].wires`);for(const e of s.wires)ref(e,b.edges.length,`shells[${i}].wires`);}
  });
  const usedEdges=new Set<number>(),usedVertices=new Set<number>();
  for(const l of b.loops)for(const u of l.uses)usedEdges.add(u.edge);
  for(const s of b.shells)if(s.kind==='vertex')usedVertices.add(s.vertex);else for(const e of s.kind==='wire'?s.edges:s.wires)usedEdges.add(e);
  for(const e of usedEdges){usedVertices.add(b.edges[e]!.start);usedVertices.add(b.edges[e]!.end);}
  if(usedEdges.size!==b.edges.length||usedVertices.size!==b.vertices.length)recordError3('body','orphan edge or vertex records');
  if(b.regions[0]!.void)recordError3('regions[0].void','the infinite region must not be void');
  b.regions.forEach((r,i)=>{if(i>0&&r.shells.length===0)recordError3(`regions[${i}].shells`,'a bounded region needs an outer shell');unique(r.shells,`regions[${i}].shells`);for(const s of r.shells){ref(s,b.shells.length,`regions[${i}].shells`);shellOwners[s]++;}});
  if(loopOwners.some(n=>n!==1))recordError3('loops','each loop must belong to exactly one face');
  if(faceOwners.some(n=>n!==1))recordError3('faces','each face must belong to exactly one shell');
  if(shellOwners.some(n=>n<1||n>2))recordError3('shells','each shell must belong to one or two regions');
  return b;
}
/** Serialize only a fully checked structural snapshot. */
export function stringifyBodyRecord3(input:unknown):string{return JSON.stringify(readBodyRecord3(input));}
export function parseBodyRecord3(json:string,limits:RecordReadLimits3={}):BodyRecord3 {
  const reader=new RecordReader3(limits);if(typeof json!=='string'||json.length>reader.maxNumericCharacters+reader.maxItems*64)throw new RangeError('Body JSON text budget exceeded');return readBodyRecord3(JSON.parse(json),limits);
}
