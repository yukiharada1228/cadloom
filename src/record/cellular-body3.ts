import {bodyBoundaryFields3,readBodyRecord3} from './body3.js';
import type {BodyRecord3} from './body3.js';
import {rationalPointSchema3} from './exact3.js';
import type {RationalPointRecord3} from './exact3.js';
import {RecordReader3,objectSchema3,arraySchema3,literalSchema3,booleanSchema3,indexSchema3,rationalSchema3,recordError3} from './schema.js';
import type {Schema3,RecordReadLimits3} from './schema.js';

/** Geometry and shell connectivity, with no shell-based material declarations. */
export type CellularBoundaryRecord3=Omit<BodyRecord3,'regions'>;
export interface CellularRegionRecord3 {
 readonly material:boolean;readonly bounded:boolean;readonly sample:RationalPointRecord3;readonly volume:string|null;
}
export interface CellularBodyRecord3 {
 readonly version:1;readonly kind:'cellular-body';readonly boundary:CellularBoundaryRecord3;
 /** Zero is unbounded exterior; material/void components remain distinct at contacts. */
 readonly regions:readonly CellularRegionRecord3[];
 /** Regions on negative/positive sides of each face's physical oriented support. */
 readonly faceRegions:readonly Readonly<{negative:number;positive:number}>[];
}
const volumeSchema3:Schema3=(v,p,r)=>v===null?literalSchema3(null)(v,p,r):rationalSchema3(v,p,r);
const schema=objectSchema3({version:literalSchema3(1),kind:literalSchema3('cellular-body'),boundary:objectSchema3(bodyBoundaryFields3),regions:arraySchema3(objectSchema3({material:booleanSchema3,bounded:booleanSchema3,sample:rationalPointSchema3,volume:volumeSchema3}),1),faceRegions:arraySchema3(objectSchema3({negative:indexSchema3,positive:indexSchema3}))});
/** Internal structural bridge only. Its temporary shell roles do not certify material. */
export function cellularBoundaryAsBodyRecord3(boundary:CellularBoundaryRecord3,limits:RecordReadLimits3={}):BodyRecord3 {
 return readBodyRecord3({...boundary,regions:[{shells:boundary.shells.map((_,i)=>i),void:false}]},limits);
}
/** Frozen structural snapshot, not a certificate of embedding or material membership. */
export function readCellularBodyRecord3(input:unknown,limits:RecordReadLimits3={}):CellularBodyRecord3 {
 const r=schema(input,'cellularBody',new RecordReader3(limits)) as CellularBodyRecord3;
 cellularBoundaryAsBodyRecord3(r.boundary,limits);
 if(r.faceRegions.length!==r.boundary.faces.length)recordError3('faceRegions','one region pair is required per face');
 const outside=r.regions[0]!;
 if(outside.material||outside.bounded||outside.volume!==null)recordError3('regions[0]','expected unbounded nonmaterial exterior with null volume');
 r.regions.forEach((v,i)=>{if(i>0&&(!v.bounded||v.volume===null))recordError3(`regions[${i}]`,'bounded region requires a finite volume');});
 const uses=r.regions.map(()=>0);
 r.faceRegions.forEach((pair,i)=>{
  if(pair.negative>=r.regions.length||pair.positive>=r.regions.length||pair.negative===pair.positive)recordError3(`faceRegions[${i}]`,'invalid region pair');
  if(!r.regions[pair.negative]!.material||r.regions[pair.positive]!.material)recordError3(`faceRegions[${i}]`,'physical negative side must be material and positive side nonmaterial');
  uses[pair.negative]=uses[pair.negative]!+1;uses[pair.positive]=uses[pair.positive]!+1;
 });
 if(uses.some((n,i)=>i>0&&n===0))recordError3('regions','bounded region has no boundary faces');
 return r;
}
export function parseCellularBodyRecord3(json:string,limits:RecordReadLimits3={}):CellularBodyRecord3 {
 const r=new RecordReader3(limits);if(typeof json!=='string'||json.length>r.maxNumericCharacters+r.maxItems*64)throw new RangeError('Cellular Body document text budget exceeded');
 return readCellularBodyRecord3(JSON.parse(json),limits);
}
