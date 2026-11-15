import fs from 'node:fs';
import {pageNames} from './content-schema.mjs';
for(const p of ['public','public/assets','netlify/functions','netlify/lib'])fs.mkdirSync(p,{recursive:true});
const defaults=JSON.parse(fs.readFileSync('content.json','utf8'));
defaults.general={name:'중원수산',englishName:'JOONGWON SUSAN',representative:'김명철',phone:'010-3992-9593',tagline:'제주 산지 활어 도매 전문',footer:'제주 산지 활어 도매 공급 상담 · 당일 시세 유선 안내 · 선결제 확인 후 출고',logo:'/assets/logo.png',accent:'#007f86'};
defaults.navigation=Object.entries(pageNames).map(([page,label])=>({page,label,visible:!['index','privacy'].includes(page)}));
defaults.form={title:'거래문의 작성',button:'문의 내용 만들기 →',intro:'입력 내용으로 문자를 작성합니다. 마지막 전송은 고객님의 문자 앱에서 진행됩니다.',fields:[['company','업체명','text',true,'업체명을 입력해 주세요'],['phone','연락처','tel',true,'010-0000-0000'],['product','품목','products',true,''],['size','사이즈','text',false,'예: 1.5kg급'],['quantity','물량','text',false,'예: 100kg'],['region','도착 지역','text',false,'예: 인천 / 서울 노량진'],['date','납기 요청일','date',false,''],['note','비고','textarea',false,'추가 요청 사항을 남겨 주세요']].map(([id,label,type,required,placeholder])=>({id,label,type,required,placeholder,visible:true,options:[]}))};
defaults.pages={};const assets={};
const strip=s=>s.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
for(const slug of Object.keys(pageNames)){
 let html=fs.readFileSync(slug+'.html','utf8');
 const page={title:strip(html.match(/<title>([\s\S]*?)<\/title>/)?.[1]||pageNames[slug]),description:html.match(/<meta name="description" content="([^"]*)"/)?.[1]||'',texts:{},links:{},images:{},sections:{}};
 let t=0,l=0,i=0,s=0;
 html=html.replace(/(<main\b[^>]*>)([\s\S]*?)(<\/main>)/,(all,start,main,end)=>{
  main=main.replace(/<(h[1-6]|p|summary|li)(\b[^>]*)>([\s\S]*?)<\/\1>/g,(all,tag,attrs,body)=>{if(/<\/?(?!br\b|em\b|strong\b|span\b)[a-z]/i.test(body)||/class="(?:small|status)"/.test(attrs)||!strip(body))return all;const id='t'+(++t);page.texts[id]=strip(body);return '<'+tag+attrs+' data-edit-text="'+id+'">'+body+'</'+tag+'>';});
  main=main.replace(/<a\b([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g,(all,before,href,after,body)=>{if(/<\/?(?!span\b)[a-z]/i.test(body)||/id="sms-link"/.test(after))return all;const id='l'+(++l);page.links[id]={text:strip(body),href};return '<a'+before+'href="'+href+'"'+after+' data-edit-link="'+id+'">'+body+'</a>';});
  main=main.replace(/<img\b([^>]*?)src="([^"]+)"([^>]*)>/g,(all,before,src,after)=>{if(!src.startsWith('/'))src='/'+src;const id='i'+(++i);page.images[id]={src,alt:((before+after).match(/alt="([^"]*)"/)||[])[1]||''};return '<img'+before+'src="'+src+'"'+after+' data-edit-image="'+id+'">';});
  main=main.replace(/<section\b([^>]*)>/g,(all,attrs)=>{if(/id="message-panel"/.test(attrs))return all;const id='s'+(++s);page.sections[id]={label:s+'번째 영역',visible:true};return '<section'+attrs+' data-edit-section="'+id+'">';});
  return start+main+end;
 });
 defaults.pages[slug]=page;assets['/'+slug+'.html']={data:Buffer.from(html).toString('base64'),type:'text/html; charset=utf-8'};
 fs.writeFileSync('public/'+slug+'.html',html);
}
for(const file of ['styles.css','site.js','cms-public.js','robots.txt','sitemap.xml','login.css','auth-client.js'])fs.copyFileSync(file,'public/'+(file==='auth-client.js'?'auth.js':file));
for(const file of ['hero.png','logo.png'])fs.copyFileSync(file,'public/assets/'+file);
for(const [file,key,type]of [['admin-index.html','/admin/index.html','text/html; charset=utf-8'],['admin.js','/admin/admin.js','text/javascript; charset=utf-8'],['admin.css','/admin/admin.css','text/css; charset=utf-8'],['login.html','/login.html','text/html; charset=utf-8']])assets[key]={data:fs.readFileSync(file).toString('base64'),type};
fs.writeFileSync('netlify/lib/assets.mjs','export default '+JSON.stringify(assets)+';');
fs.writeFileSync('netlify/lib/defaults.mjs','export default '+JSON.stringify(defaults)+';');
for(const file of ['server.mjs','auth-server.mjs','content-schema.mjs'])fs.copyFileSync(file,'netlify/lib/'+file);
fs.copyFileSync('site-function.mjs','netlify/functions/site.mjs');
console.log('Built 8 editable pages, administrator login and daily page views.');
