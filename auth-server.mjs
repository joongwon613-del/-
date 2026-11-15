import {scrypt as scryptCallback,randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
const COOKIE='__Host-jwadmin';
export async function hashPassword(password,salt=randomBytes(24).toString('hex')){const key=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return `scrypt$32768$${salt}$${key.toString('hex')}`;}
export async function verifyPassword(password,record){if(typeof password!=='string'||password.length>256||!/^scrypt\$32768\$[a-f0-9]{48}\$[a-f0-9]{128}$/.test(record||''))return false;const [, ,salt,expected]=record.split('$');const actual=(await hashPassword(password,salt)).split('$')[3];return timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex'));}
const digest=value=>createHash('sha256').update(value).digest('hex');
export function createAuth({store,env,now=()=>Date.now()}){
 env={...env};
 const ready=(async()=>{if(!env.ADMIN_PASSWORD_HASH&&typeof env.ADMIN_PASSWORD==='string'&&env.ADMIN_PASSWORD.length>=6){const salt=digest('joongwonsusan-password-salt:'+String(env.SITE_ID||'local')).slice(0,48);env.ADMIN_PASSWORD_HASH=await hashPassword(env.ADMIN_PASSWORD,salt);}if(!env.SESSION_SECRET&&env.ADMIN_PASSWORD_HASH)env.SESSION_SECRET=digest('session-version:'+env.ADMIN_PASSWORD_HASH);})();
 const configured=()=>!!env.ADMIN_USERNAME&&/^scrypt\$32768\$[a-f0-9]{48}\$[a-f0-9]{128}$/.test(env.ADMIN_PASSWORD_HASH||'')&&env.SESSION_SECRET?.length>=32;
 const cookie=(value,age=28800)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
 async function reserveAttempt(ip){const bucket=Math.floor(now()/900000),who=createHmac('sha256',env.SESSION_SECRET).update(ip||'unknown').digest('hex');for(let slot=0;slot<8;slot++){const key=`auth/attempts/${bucket}/${who}/${slot}`;if((await store.setJSON(key,{expires:now()+900000},{onlyIfNew:true})).modified)return true;}return false;}
 async function login(username,password,ip){if(!configured())return {status:503,error:'관리자 계정의 서버 설정이 아직 완료되지 않았습니다.'};if(!await reserveAttempt(ip))return {status:429,error:'로그인 시도가 많습니다. 15분 뒤 다시 시도해 주세요.'};const match=await verifyPassword(password,env.ADMIN_PASSWORD_HASH);if(username!==env.ADMIN_USERNAME||!match)return {status:401,error:'아이디 또는 비밀번호를 확인해 주세요.'};const token=randomBytes(32).toString('base64url');await store.setJSON('auth/sessions/'+digest(token),{username:env.ADMIN_USERNAME,expires:now()+28800000,credential:digest(env.ADMIN_PASSWORD_HASH+env.SESSION_SECRET)});return {status:200,cookie:cookie(token)};}
 function tokenFrom(req){return req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);}
 async function authenticated(req){if(!configured())return false;const token=tokenFrom(req);if(!/^[A-Za-z0-9_-]{43}$/.test(token||''))return false;const session=await store.get('auth/sessions/'+digest(token),{type:'json'});return !!session&&session.expires>now()&&session.username===env.ADMIN_USERNAME&&session.credential===digest(env.ADMIN_PASSWORD_HASH+env.SESSION_SECRET);}
 async function logout(req){const token=tokenFrom(req);if(token)await store.delete('auth/sessions/'+digest(token));return cookie('',0);}
 return {configured,login,authenticated,logout,ready};
}
