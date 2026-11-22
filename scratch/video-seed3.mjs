const API='http://127.0.0.1:3011/api'; let token='';
async function call(m,p,b){const r=await fetch(API+p,{method:m,headers:{'content-type':'application/json',authorization:'Bearer '+token},body:b?JSON.stringify(b):undefined});const t=await r.text();if(!r.ok){console.log('FAIL',m,p,r.status,t.slice(0,160));return null}return JSON.parse(t)}
token=(await (await fetch(API+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'tho@eurohouse.vn',password:'Eurohouse@2026'})})).json()).user.token;
const wos=await call('GET','/workshop/v2/work-orders');
for(const o of wos){ const acts=o.title.startsWith('Cắt')?['ready','start']:o.title.startsWith('Lắp ráp')||o.title.startsWith('Kiểm')?['ready']:[]; for(const a of acts) await call('PATCH',`/workshop/v2/work-orders/${o.id}/actions/${a}`,{}); }
console.log((await call('GET','/workshop/v2/work-orders')).map(o=>o.status+':'+o.title).join(' | '));
