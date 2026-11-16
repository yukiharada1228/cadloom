import {adoptCellularBody3,locateOwnedCellularBody3} from '../model/cellular-body3.js';
import type {CellularBody3} from '../model/cellular-body3.js';
export {isOwnedCellularBody3} from '../model/cellular-body3.js';
export type {CellularBody3} from '../model/cellular-body3.js';
import {partitionPlanarBRepFaces3} from '../geometry/planar-brep-partition3.js';
import {bodyRecordFromTopology3} from '../convert/body3.js';
import {encodePlanarPolygonDomain3} from '../convert/planar-body3.js';
import {encodeRationalPoint3} from '../convert/exact3.js';
import {restoreNativeBRepFaces3} from '../convert/native-faces3.js';
import {readCellularBodyRecord3,cellularBoundaryAsBodyRecord3} from '../record/cellular-body3.js';
import type {CellularBodyRecord3} from '../record/cellular-body3.js';
import {RecordReader3,objectSchema3,literalSchema3} from '../record/schema.js';
import type {RecordReadLimits3} from '../record/schema.js';
import {planarMaterialDocument3,restorePlanarMaterial3,planarMaterialRegions3,locatePlanarMaterial3,booleanPlanarMaterials3,planarMaterialFromBody3} from './planar-material3.js';
import type {PlanarMaterial3,PlanarMaterialDocument3,PlanarMaterialReadLimits3} from './planar-material3.js';
import type {Body3} from '../model/body3.js';
import type {Point3} from '../geometry/point3.js';
import type {AlgebraicCoordinates3} from '../geometry/algebraic-point3.js';
import type {BooleanOperation} from '../geometry/polygon-boolean.js';

const states=new WeakMap<CellularBody3,PlanarMaterial3>();
function material(body:CellularBody3):PlanarMaterial3 {const m=states.get(body);if(!m)throw new RangeError('Operation requires a factory-created cellular Body');return m;}
/** Adopt only geometry-derived owned material; no caller region table is trusted. */
export function cellularBodyFromPlanarMaterial3(source:PlanarMaterial3):CellularBody3 {
 const analysis=planarMaterialRegions3(source),parts=analysis.boundaryUses.map(u=>u.polygon),sewn=partitionPlanarBRepFaces3(parts,[]).sewn.topology;
 if(sewn.faces.length!==parts.length)throw new Error('Cellular boundary face correspondence changed during sewing');
 const raw=bodyRecordFromTopology3(sewn,[{shells:sewn.shells.map((_,i)=>i),void:false}]),{regions:ignored,...boundary}=raw;
 const faces=raw.faces.map((f,i)=>{const surface=sewn.faces[i]!.surface;if(surface.kind!=='plane')throw new Error('Cellular planar face has curved support');return {...f,domain:encodePlanarPolygonDomain3(parts[i]!,surface.plane.normal)};});
 const record=readCellularBodyRecord3({version:1,kind:'cellular-body',boundary:{...boundary,faces},regions:analysis.regions.map(r=>({material:r.material,bounded:r.bounded,sample:encodeRationalPoint3(r.sample),volume:r.volume?.toString()??null})),faceRegions:analysis.boundaryUses.map(u=>({negative:u.materialRegion,positive:u.voidRegion}))});
 const restored=restoreNativeBRepFaces3(cellularBoundaryAsBodyRecord3(record.boundary));
 // Balanced contact edges are allowed; open or inconsistently oriented boundaries are not.
 if(restored.boundary.topology.edges.some(e=>e.coedges.length<2||e.coedges.reduce((sum,id)=>sum+restored.boundary.topology.coedges[id]!.direction,0)!==0))throw new Error('Cellular Body has an unbalanced boundary');
 const result:CellularBody3=Object.freeze({kind:'cellular-body',record,topology:restored.boundary.topology,faces:restored.faces,materialFaces:Object.freeze(analysis.boundaryUses.map(u=>u.face)),interiorSamples:Object.freeze(analysis.regions.filter(r=>r.material).map(r=>r.sample))});
 states.set(result,source);return adoptCellularBody3(result,p=>locatePlanarMaterial3(source,p));
}
export function cellularBodyFromBody3(body:Body3):CellularBody3 {return cellularBodyFromPlanarMaterial3(planarMaterialFromBody3(body));}
export function planarMaterialOfCellularBody3(body:CellularBody3):PlanarMaterial3 {return material(body);}
export function locateCellularBody3(body:CellularBody3,point:Point3|AlgebraicCoordinates3){return locateOwnedCellularBody3(body,point);}
export function booleanCellularBodies3(a:CellularBody3|Body3,b:CellularBody3|Body3,operation:BooleanOperation):CellularBody3 {
 const resolve=(v:CellularBody3|Body3)=>states.has(v as CellularBody3)?material(v as CellularBody3):planarMaterialFromBody3(v as Body3);
 return cellularBodyFromPlanarMaterial3(booleanPlanarMaterials3(resolve(a),resolve(b),operation));
}
export interface CellularBodyDocument3 {readonly version:1;readonly kind:'cellular-body-document';readonly material:PlanarMaterialDocument3;readonly body:CellularBodyRecord3;}
export function cellularBodyDocument3(body:CellularBody3):CellularBodyDocument3 {return Object.freeze({version:1,kind:'cellular-body-document',material:planarMaterialDocument3(material(body)),body:body.record});}
export function serializeCellularBody3(body:CellularBody3):string {return JSON.stringify(cellularBodyDocument3(body));}
export interface CellularBodyReadLimits3 extends PlanarMaterialReadLimits3 {readonly record?:RecordReadLimits3;}
/** Replay actual geometry and compare all normalized boundary/region data. */
export function restoreCellularBody3(input:unknown,limits:CellularBodyReadLimits3={}):CellularBody3 {
 const maxChars=limits.maxChars??10000000;if(!Number.isSafeInteger(maxChars)||maxChars<1)throw new RangeError('Invalid cellular Body character limit');
 if(typeof input==='string'){if(input.length>maxChars)throw new RangeError('Cellular Body document exceeds character limit');input=JSON.parse(input);}
 const schema=objectSchema3({version:literalSchema3(1),kind:literalSchema3('cellular-body-document'),material:v=>v,body:v=>readCellularBodyRecord3(v,limits.record)}),document=schema(input,'document',new RecordReader3(limits.record)) as CellularBodyDocument3;
 // Finish structural record checks before evaluating the material construction.
 const source=restorePlanarMaterial3(document.material,limits),result=cellularBodyFromPlanarMaterial3(source);
 if(JSON.stringify(result.record)!==JSON.stringify(document.body))throw new RangeError('Stored cellular Body record does not match its reconstructed material');
 return result;
}
