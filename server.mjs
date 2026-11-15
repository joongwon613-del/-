import {randomUUID} from 'node:crypto';
import {createAuth} from './auth-server.mjs';
import {validateContent,pageNames} from './content-schema.mjs';
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'};
const json=(v,status=200,extra={})=>Response.json(v,{status,headers:{...headers,...extra}});
const fail=(status,error)=>json({error},status);
const dateKST=ms=>new Date(ms+9*3600000).toISOString().slice(0,10);
export async function readBody(req,max=256000){if(Number(req.headers.get('content-length'))>max)throw new RangeError();const reader=req.body?.getReader();let size=0,chunks=[];if(!reader)return new Uint8Array();for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new RangeError();}chunks.push(value);}return Buffer.concat(chunks);}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(html,c,slug){const page=c.pages[slug];html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>'+esc(page.title)+'</title>').replace(/(<meta name="description" content=")[^"]*/,'$1'+esc(page.description));return html.replace('</head>','<script id="site-content" type="application/json">'+JSON.stringify(c).replace(/</g,'\\u003c')+'</script></head>');}
async function listAll(store,prefix,max=50000){const result=[];for await(const batch of store.list({prefix,paginate:true})){result.push(...batch.blobs);if(result.length>max)throw new Error('목록이 너무 큽니다.');}return result;}
export function createHandler({store,assets,defaults,env,now=()=>Date.now()}){
 const auth=createAuth({store,env,now});
 const content=async()=>{const item=await store.getWithMetadata('cms/content.json',{type:'json'});return {content:item?{...defaults,...item.data}:defaults,revision:item?.etag||'initial'};};
 const asset=(key,status=200)=>{const a=assets[key];return a?new Response(Buffer.from(a.data,'base64'),{status,headers:{...headers,'Content-Type':a.type,'X-Frame-Options':'DENY',...(key.startsWith('/admin')||key==='/login.html'?{'X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; frame-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"}:{})}}):fail(404,'페이지를 찾을 수 없습니다.');};
 return async(req,context={})=>{try{
  await auth.ready;
  const u=new URL(req.url),p=u.pathname;
  if(req.method!=='GET'&&req.method!=='HEAD'&&req.headers.get('origin')!==u.origin)return fail(403,'요청 출처를 확인할 수 없습니다.');
  if(p==='/admin/login'||p==='/admin/login/'){if(req.method!=='GET')return fail(405,'허용되지 않은 요청입니다.');return asset('/login.html');}
  if(p==='/api/auth/login'){if(req.method!=='POST')return fail(405,'허용되지 않은 요청입니다.');const body=JSON.parse((await readBody(req,2000)).toString());const r=await auth.login(body.username,body.password,context.ip);return json(r.error?{error:r.error}:{ok:true},r.status,r.cookie?{'Set-Cookie':r.cookie}:{});}
  if(p==='/api/auth/logout'){if(req.method!=='POST')return fail(405,'허용되지 않은 요청입니다.');return json({ok:true},200,{'Set-Cookie':await auth.logout(req)});}
  const admin=p==='/admin'||p.startsWith('/admin/')||p.startsWith('/api/admin/');
  if(admin&&!await auth.authenticated(req)){if(p.startsWith('/api/'))return fail(401,'관리자 로그인이 필요합니다.');return new Response(null,{status:302,headers:{...headers,Location:'/admin/login'}});}
  if(p==='/admin'||p==='/admin/')return asset('/admin/index.html');
  if(p.startsWith('/admin/'))return asset(p);
  if(p==='/api/content'||p==='/api/admin/content'||p==='/api/admin/backup'){
   if(req.method==='GET'){const data=await content();return json(data,200,p.endsWith('/backup')?{'Content-Disposition':'attachment; filename="joongwonsusan-content-backup.json"'}:{});}
   if(p!=='/api/admin/content'||req.method!=='PUT')return fail(405,'허용되지 않은 요청입니다.');
   const body=JSON.parse((await readBody(req)).toString());let next;try{next=validateContent(body.content,defaults);}catch(e){return fail(400,e.message);}
   const old=await content();if(old.revision!==body.revision)return fail(409,'다른 창에서 먼저 수정했습니다. 현재 내용을 다시 불러와 주세요.');
   const key='cms/history/'+now()+'-'+randomUUID();await store.setJSON(key,old.content);
   const result=await store.setJSON('cms/content.json',next,old.revision==='initial'?{onlyIfNew:true}:{onlyIfMatch:old.revision});if(!result.modified)return fail(409,'동시 수정이 감지되었습니다. 현재 내용을 다시 불러와 주세요.');
   return json({content:next,revision:result.etag,savedAt:new Date(now()).toISOString()});
  }
  if(p==='/api/admin/upload'){
   if(req.method!=='POST')return fail(405,'허용되지 않은 요청입니다.');const b=await readBody(req,4*1024*1024);let type,ext;if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){type='image/png';ext='png';}else if(b[0]===255&&b[1]===216&&b[2]===255){type='image/jpeg';ext='jpg';}else if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'){type='image/webp';ext='webp';}if(!type||req.headers.get('content-type')!==type)return fail(415,'4MB 이하의 PNG, JPG, WEBP 사진을 선택해 주세요.');const key='uploads/'+randomUUID()+'.'+ext;await store.set(key,b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),{metadata:{type}});return json({url:'/'+key});
  }
  if(/^\/uploads\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(p)){if(!['GET','HEAD'].includes(req.method))return fail(405,'허용되지 않은 요청입니다.');const data=await store.getWithMetadata(p.slice(1),{type:'arrayBuffer'});if(!data)return fail(404,'사진을 찾을 수 없습니다.');return new Response(req.method==='HEAD'?null:data.data,{headers:{...headers,'Content-Type':data.metadata.type,'Cache-Control':'public, max-age=31536000, immutable'}});}
  if(p==='/api/pageview'){
   if(req.method!=='POST')return fail(405,'허용되지 않은 요청입니다.');if(/bot|crawler|spider|headless/i.test(req.headers.get('user-agent')||'')||await auth.authenticated(req))return json({counted:false});const b=JSON.parse((await readBody(req,1000)).toString());if(!(b.page in pageNames)||!/^[a-f0-9-]{36}$/.test(b.id))return fail(400,'올바르지 않은 조회 기록입니다.');await store.setJSON(`pv/${dateKST(now())}/${b.page}/${b.id}`,{at:now()},{onlyIfNew:true});return json({counted:true});
  }
  if(p==='/api/admin/stats'){
   if(req.method!=='GET')return fail(405,'허용되지 않은 요청입니다.');const days=[];for(let i=29;i>=0;i--){const date=dateKST(now()-i*86400000),entries=await listAll(store,'pv/'+date+'/');const pages={};for(const e of entries){const slug=e.key.split('/')[2];pages[slug]=(pages[slug]||0)+1;}days.push({date,views:entries.length,pages});}return json({timezone:'Asia/Seoul',metric:'페이지 조회수',days,today:days.at(-1).views,yesterday:days.at(-2).views,total30:days.reduce((a,d)=>a+d.views,0)});
  }
  if(p.startsWith('/api/'))return fail(404,'요청한 기능이 없습니다.');
  const slug=p==='/'?'index':p.match(/^\/([a-z]+)\.html$/)?.[1];if(slug in pageNames){if(!['GET','HEAD'].includes(req.method))return fail(405,'허용되지 않은 요청입니다.');const a=assets['/'+slug+'.html'];let c=defaults;try{c=(await content()).content;}catch{}const html=render(Buffer.from(a.data,'base64').toString(),c,slug);return new Response(req.method==='HEAD'?null:html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});}
  return fail(404,'페이지를 찾을 수 없습니다.');
 }catch(e){return fail(e instanceof RangeError?413:e instanceof SyntaxError?400:503,e instanceof RangeError?'파일 또는 입력 내용이 너무 큽니다.':e instanceof SyntaxError?'입력 형식을 확인해 주세요.':'저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');}};
}
