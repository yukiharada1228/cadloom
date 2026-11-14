import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
for(const args of [[],['-p','examples/editor/tsconfig.json']]){
  const result=spawnSync(process.execPath,['node_modules/typescript/bin/tsc',...args],{cwd:root,stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
const routes=new Map([
  ['/',[join(root,'examples/editor/index.html'),'text/html; charset=utf-8']],
  ...['editor','model','viewer'].map(name=>[`/${name}.js`,[join(root,`artifacts/editor/${name}.js`),'text/javascript; charset=utf-8']]),
]);
const server=createServer(async(request,response)=>{
  if(request.method!=='GET'){response.writeHead(405,{Allow:'GET'});response.end();return;}
  const pathname=new URL(request.url??'/', 'http://127.0.0.1').pathname;
  let route=routes.get(pathname);
  if(/^\/dist\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.js$/.test(pathname))route=[join(root,pathname.slice(1)),'text/javascript; charset=utf-8'];
  if(!route){response.writeHead(404);response.end('Not found');return;}
  try{
    const data=await readFile(route[0]);
    response.writeHead(200,{'Content-Type':route[1],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(data);
  }catch{response.writeHead(404);response.end('Not found');}
});
const port=Number(process.env.CADLOOM_EDITOR_PORT??4180);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid CADLOOM_EDITOR_PORT');
server.listen(port,'127.0.0.1',()=>console.log(`cadloom editor: http://127.0.0.1:${port} (Ctrl+C to stop)`));
