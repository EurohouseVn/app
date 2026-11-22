const API='http://127.0.0.1:3011/api';
const r=await fetch(API+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'tho@eurohouse.vn',password:'Eurohouse@2026'})});
const t=(await r.json()).user.token; const h={authorization:'Bearer '+t};
const W=['cmwrdfyfo0002momcjuxpjfjk','cmwrdfyfv0004momcvicscagp','cmwrdfyg00006momc86tlm43o','cmwrdfyg40008momci3qsl2ls','cmwrdfyg8000amomc7frmhdat'];
const P=['cmwrdfyzs005kmomcjkrieiut','cmwrdfz0d005mmomc76cuz1ww','cmwrdfz0u005omomcqqywrfvh','cmwrdfz1a005qmomcv6xgo8ef'];
for(const id of W){const x=await fetch(API+'/workforce/workers/'+id,{method:'DELETE',headers:h});console.log('w',x.status);}
for(const id of P){const x=await fetch(API+'/projects/'+id,{method:'DELETE',headers:h});console.log('p',x.status);}
const w=await (await fetch(API+'/workforce/workers',{headers:h})).json();console.log('workers now',w.length, w.map(a=>a.name).join('|'));
const p=await (await fetch(API+'/workshop/v2/projects',{headers:h})).json();console.log('projects now',p.length);
