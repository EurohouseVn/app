const API='http://127.0.0.1:3011/api';
const t=(await (await fetch(API+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'tho@eurohouse.vn',password:'Eurohouse@2026'})})).json()).user.token; const H={authorization:'Bearer '+t};
const g=async p=>(await fetch(API+p,{headers:H})).json(); const del=p=>fetch(API+p,{method:'DELETE',headers:H});
const rem=await g('/workforce/reminders?includeCompleted=true'); const seen=new Set();
for(const r of rem){ if(seen.has(r.title)){ await del('/workforce/reminders/'+r.id);} else seen.add(r.title);} 
const pj=await g('/workforce/piece-jobs?month=2026-11'); const w=new Set((await g('/workforce/workers')).map(x=>x.id));
const seenP=new Set(); for(const j of pj){ const key=j.title; const orphan=j.shares.some(s=>!w.has(s.workerId)); if(orphan||seenP.has(key)){await del('/workforce/piece-jobs/'+j.id);} else seenP.add(key);} 
const ad=await g('/workforce/adjustments?month=2026-11'); const seenA=new Set();
for(const a of ad){ const key=a.note+a.amount; if(!w.has(a.workerId)||seenA.has(key)){await del('/workforce/adjustments/'+a.id);} else seenA.add(key);} 
console.log('rem',(await g('/workforce/reminders?includeCompleted=true')).length,'pj',(await g('/workforce/piece-jobs?month=2026-11')).length,'adj',(await g('/workforce/adjustments?month=2026-11')).length);
