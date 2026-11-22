const API='http://127.0.0.1:3061/api';
const t=(await (await fetch(API+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'tho@eurohouse.vn',password:'Eurohouse@2026'})})).json()).user.token;
const post=async(b)=>{const r=await fetch(API+'/inventory/items/adjust',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+t},body:JSON.stringify(b)}); if(!r.ok) console.log('FAIL',b.materialCode,r.status,(await r.text()).slice(0,100));};
const bars=[['E70D110',24],['E70D150',18],['E701A',12],['E702',30],['E705',9],['E706',14],['C3304',16],['C3300',22],['DAK55',11],['E70KD',8],['E70KT',6]];
for(const [c,q] of bars) await post({materialCode:c,lengthMm:6000,quantity:q,type:'FULL_BAR'});
const rem=[['E70D110',2350,3],['E70D110',1800,2],['E70D150',2680,2],['E701A',1450,4],['E705',3120,2],['E702',1100,5],['C3304',2200,2],['C3300',1650,3],['DAK55',1900,2],['E70KD',2740,1]];
for(const [c,l,q] of rem) await post({materialCode:c,lengthMm:l,quantity:q,type:'DE_XE'});
const inv=await (await fetch(API+'/inventory',{headers:{authorization:'Bearer '+t}})).json(); console.log(inv.items.length, inv.scrapKg);
