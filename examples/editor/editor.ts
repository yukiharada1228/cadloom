import { Rational } from "../../dist/index.js";
import { buildPlate, defaultParameters, restorePlate, serializePlate } from "./model.js";
import type { PlateModel, PlateParameters } from "./model.js";
import { createViewer } from "./viewer.js";

function element<T extends HTMLElement>(id:string):T {
  const found=document.getElementById(id);
  if(!found)throw new Error(`Missing element ${id}`);
  return found as T;
}
const input=(id:string)=>element<HTMLInputElement>(id);
const message=element("message"),state=element("state"),save=element<HTMLButtonElement>("save");
const holeFields=element<HTMLFieldSetElement>("hole-fields");
let model:PlateModel|null=null, timer:ReturnType<typeof setTimeout>|undefined,revision=0;
let viewer:ReturnType<typeof createViewer>|null=null;
try { viewer=createViewer(element<HTMLCanvasElement>("view")); }
catch(error){message.textContent=String(error);message.classList.add("error");}
function showMessage(text:string,error=false){message.textContent=text;message.classList.toggle("error",error);}
function readParameters():PlateParameters {
  return {width:input("width").value,depth:input("depth").value,thickness:input("thickness").value,
    hole:input("has-hole").checked?{x:input("hole-x").value,y:input("hole-y").value,width:input("hole-width").value,depth:input("hole-depth").value}:null};
}
function setParameters(p:PlateParameters){
  input("width").value=p.width;input("depth").value=p.depth;input("thickness").value=p.thickness;
  input("has-hole").checked=p.hole!==null;
  const h=p.hole??defaultParameters.hole!;
  input("hole-x").value=h.x;input("hole-y").value=h.y;input("hole-width").value=h.width;input("hole-depth").value=h.depth;
  holeFields.disabled=p.hole===null;
}
function apply(next:PlateModel,text:string){
  viewer?.update(next.mesh);model=next;save.disabled=false;
  element("area").textContent=next.mesh.baseTwiceArea.div(new Rational(2n)).toString();
  element("height").textContent=next.document.parameters.thickness;
  element("volume").textContent=next.mesh.volume.toString();
  state.textContent=viewer?"形状は有効です":"3D表示は利用できません";
  showMessage(viewer?text:`${text} このブラウザーでは3D表示を利用できません。`,!viewer);
}
function recalculate(){
  clearTimeout(timer);holeFields.disabled=!input("has-hole").checked;
  try{apply(buildPlate(readParameters()),"寸法を反映しました。JSONで保存できます。");}
  catch(error){
    save.disabled=true;state.textContent="寸法を確認してください";
    showMessage(`${error instanceof Error?error.message:String(error)}。表示は直前の有効な形状です。`,true);
  }
}
element<HTMLFormElement>("dimensions").addEventListener("input",()=>{
  revision++;clearTimeout(timer);save.disabled=true;holeFields.disabled=!input("has-hole").checked;
  state.textContent="再計算中";timer=setTimeout(recalculate,120);
});
element<HTMLFormElement>("dimensions").addEventListener("submit",e=>{e.preventDefault();recalculate();});
element("reset").addEventListener("click",()=>viewer?.reset());
save.addEventListener("click",()=>{
  if(save.disabled||!model)return;
  const url=URL.createObjectURL(new Blob([serializePlate(model)],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download="cadloom-plate.json";
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  showMessage("現在の寸法と形状をJSONに保存しました。");
});
element("load").addEventListener("click",()=>input("file").click());
input("file").addEventListener("change",async()=>{
  const file=input("file").files?.[0];if(!file)return;
  const current=++revision;clearTimeout(timer);
  try{
    if(file.size>1024*1024)throw new Error("1MB以下のJSONファイルを選んでください");
    const text=await file.text();if(current!==revision)return;
    const restored=restorePlate(text);setParameters(restored.document.parameters);
    apply(restored,"JSONから寸法と形状を復元しました。");
  }catch(error){
    if(current!==revision)return;
    // A pending edit must not become saveable when file loading fails.
    recalculate();
    showMessage(`読み込みに失敗しました：${error instanceof Error?error.message:String(error)}`,true);
  }finally{input("file").value="";}
});
setParameters(defaultParameters);recalculate();
