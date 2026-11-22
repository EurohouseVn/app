const API='http://127.0.0.1:3061/api';
const t=(await (await fetch(API+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'tho@eurohouse.vn',password:'Eurohouse@2026'})})).json()).user.token;
const post=async(b)=>{const r=await fetch(API+'/inventory/items/adjust',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+t},body:JSON.stringify(b)}); if(!r.ok) console.log('FAIL',b.materialCode,r.status,(await r.text()).slice(0,100));};
for (const c of ['KH-K9809','KH-T9801','KH-T9802','KH-T9803','KH-T9807','KH-T9808','KH-T9814']) {
  await post({materialCode:c,lengthMm:6000,quantity:6,type:'FULL_BAR'});
  await post({materialCode:c,lengthMm:3400,quantity:3,type:'DE_XE'});
  await post({materialCode:c,lengthMm:2300,quantity:2,type:'DE_XE'});
}
const inv=await (await fetch(API+'/inventory',{headers:{authorization:'Bearer '+t}})).json(); console.log(inv.items.length);
