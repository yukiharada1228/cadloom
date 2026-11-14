/** Internal JSON-shaped readers. They snapshot own fields and never bless geometry. */
export interface RecordReadLimits3 {readonly maxItems?:number;readonly maxNumericCharacters?:number;}
export type Schema3=(value:unknown,path:string,reader:RecordReader3)=>unknown;
export class RecordReader3 {
  private items=0;private characters=0;
  readonly maxItems:number;readonly maxNumericCharacters:number;
  constructor(limits:RecordReadLimits3={}){
    this.maxItems=limits.maxItems??1_000_000;this.maxNumericCharacters=limits.maxNumericCharacters??16_000_000;
    if(!Number.isSafeInteger(this.maxItems)||this.maxItems<1||!Number.isSafeInteger(this.maxNumericCharacters)||this.maxNumericCharacters<1)throw new RangeError('Record limits must be positive safe integers');
  }
  item(path:string):void {if(++this.items>this.maxItems)throw new RangeError(`${path}: record item budget exceeded`);}
  numeric(n:number,path:string):void {this.characters+=n;if(this.characters>this.maxNumericCharacters)throw new RangeError(`${path}: numeric character budget exceeded`);}
}
export function recordError3(path:string,why:string):never {throw new RangeError(`${path}: ${why}`);}
export const rationalSchema3:Schema3=(v,p,r)=>{r.item(p);if(typeof v!=='string'||! /^-?(?:0|[1-9][0-9]*)(?:\/[1-9][0-9]*)?$/.test(v))recordError3(p,'expected an exact rational string');r.numeric(v.length,p);return v;};
export const indexSchema3:Schema3=(v,p,r)=>{r.item(p);if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0)recordError3(p,'expected a nonnegative safe index');return v;};
export const booleanSchema3:Schema3=(v,p,r)=>{r.item(p);if(typeof v!=='boolean')recordError3(p,'expected a boolean');return v;};
export function literalSchema3(...allowed:readonly unknown[]):Schema3{return(v,p,r)=>{r.item(p);if(!allowed.includes(v))recordError3(p,`expected ${allowed.join(' or ')}`);return v;};}
export const directionSchema3=literalSchema3(1,-1);
export function arraySchema3(item:Schema3,min=0,length?:number):Schema3{return(v,p,r)=>{
  r.item(p);if(!Array.isArray(v)||v.length<min||length!==undefined&&v.length!==length)recordError3(p,'invalid array length');
  if(v.length>r.maxItems)recordError3(p,'record item budget exceeded');return Object.freeze(Array.from(v,(x,i)=>item(x,`${p}[${i}]`,r)));
};}
export function objectSchema3(fields:Readonly<Record<string,Schema3>>,optional:Readonly<Record<string,Schema3>>={}):Schema3{return(v,p,r)=>{
  r.item(p);if(v===null||typeof v!=='object'||Array.isArray(v))recordError3(p,'expected an object');const data=v as Record<string,unknown>,out:Record<string,unknown>={};
  for(const key of Object.keys(data))if(!Object.hasOwn(fields,key)&&!Object.hasOwn(optional,key))recordError3(`${p}.${key}`,'unknown field');
  for(const [key,schema] of Object.entries(fields)){if(!Object.hasOwn(data,key))recordError3(`${p}.${key}`,'missing field');out[key]=schema(data[key],`${p}.${key}`,r);}
  for(const [key,schema] of Object.entries(optional))if(Object.hasOwn(data,key))out[key]=schema(data[key],`${p}.${key}`,r);
  return Object.freeze(out);
};}
export function taggedSchema3(variants:Readonly<Record<string,Schema3>>):Schema3{return(v,p,r)=>{
  if(v===null||typeof v!=='object'||!Object.hasOwn(v,'kind'))recordError3(p,'expected a tagged object');const kind=(v as {kind:unknown}).kind;
  if(typeof kind!=='string'||!Object.hasOwn(variants,kind))recordError3(`${p}.kind`,'unknown kind');return variants[kind]!(v,p,r);
};}
