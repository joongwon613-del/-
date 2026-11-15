import {getStore} from '@netlify/blobs';
import {createHandler} from '../lib/server.mjs';
import defaults from '../lib/defaults.mjs';
import assets from '../lib/assets.mjs';
export default async(request,context)=>createHandler({store:getStore({name:'joongwonsusan-v2',consistency:'strong'}),assets,defaults,env:process.env})(request,context);
export const config={path:['/','/index.html','/about.html','/farms.html','/products.html','/shipping.html','/contact.html','/faq.html','/privacy.html','/api/*','/admin','/admin/*','/uploads/*'],preferStatic:false};
