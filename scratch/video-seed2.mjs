const API='http://127.0.0.1:3011/api'; let token='';
async function call(m,p,b){const r=await fetch(API+p,{method:m,headers:{'content-type':'application/json',authorization:'Bearer '+token},body:b?JSON.stringify(b):undefined});const t=await r.text();if(!r.ok){console.log('FAIL',m,p,r.status,t.slice(0,200));return null}return JSON.parse(t)}
token=(await (await fetch(API+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier:'tho@eurohouse.vn',password:'Eurohouse@2026'})})).json()).user.token;
const projects=await call('GET','/workshop/v2/projects'); const workers=await call('GET','/workforce/workers');
const P=Object.fromEntries(projects.map(p=>[p.name.split(' - ')[0],p]));
const p0=projects.find(p=>p.name.startsWith('Biệt thự')), p1=projects.find(p=>p.name.startsWith('Nhà phố'));
const w=Object.fromEntries(workers.map(x=>[x.name,x]));
const in1=(h)=>new Date(Date.now()+h*3600000).toISOString();
const wo=[];
for(const [type,title,pr,asg,st] of [['CUTTING','Cắt nhôm Ecento 70 - 6 bộ cửa đi',p0,'Nguyễn Văn Hùng',-2],['ASSEMBLY','Lắp ráp khung cửa sổ 2 cánh',p0,'Trần Minh Tuấn',2],['GLAZING','Lắp kính hộp 8mm',p1,'Võ Hoàng Nam',20],['QC','Kiểm tra cửa đi chính',p0,'Trần Minh Tuấn',1]]){
  const o=await call('POST','/workshop/v2/work-orders',{type,title,projectId:pr.id,assignedWorkerId:w[asg]?.id,scheduledStart:in1(st),scheduledEnd:in1(st+6),instructions:'Theo bản vẽ đã duyệt, kiểm tra kích thước trước khi chuyển bước.',priority:2});
  if(o)wo.push(o);
}
console.log('wo',wo.length, Object.keys(wo[0]||{}).join(','));
for(const [i,o] of wo.entries()){ for(const a of (i===0?['release','start']:i===1?['release']:i===3?['release']:[])) await call('PATCH',`/workshop/v2/work-orders/${o.id}/actions/${a}`,{}); }
const tpl=await call('POST','/workshop/v2/qc/templates',{name:'QC cửa nhôm kính',appliesTo:'WORK_ORDER',items:[{checkKey:'SIZE',label:'Kích thước đúng bản vẽ',instructions:'Đo chiều rộng, chiều cao, đường chéo'},{checkKey:'CORNER',label:'Góc ráp kín, không hở',instructions:''},{checkKey:'GLASS',label:'Kính sạch, gioăng đều',instructions:''},{checkKey:'HARDWARE',label:'Phụ kiện đóng mở êm',instructions:''}]});
const inst=await call('POST','/workshop/v2/installations',{projectId:p0.id,scheduledStart:in1(26),scheduledEnd:in1(32),customerName:'Anh Nguyễn Văn Thành',vehicleRef:'51C-123.45',requiredPhotoCount:2,note:'Lắp cửa đi chính và 4 cửa sổ tầng 1',materialsChecklist:[{label:'Silicone trung tính'},{label:'Vít inox'}],toolsChecklist:[{label:'Máy khoan'},{label:'Thước thuỷ'}]});
const inst2=await call('POST','/workshop/v2/installations',{projectId:p1.id,scheduledStart:in1(52),scheduledEnd:in1(58),customerName:'Chị Lê Thị Mai',vehicleRef:'51D-678.90',requiredPhotoCount:2,note:'Lắp cửa lùa ban công'});
const done=projects.find(p=>p.name.startsWith('Quán'));
const asset=await call('POST','/workshop/v2/warranty/assets',{projectId:done.id,installedAt:'2026-10-05T08:00:00+07:00',warrantyMonths:60,assetCode:'EH-WA-2026-0042',metadata:{name:'Cửa đi Ecento 70 - mặt tiền',serial:'EH70-0042'}});
if(asset) await call('POST',`/workshop/v2/warranty/assets/${asset.id}/tickets`,{description:'Cửa kẹt nhẹ khi đóng, cần chỉnh bản lề',priority:'NORMAL'});
console.log('tpl',!!tpl,'inst',!!inst,!!inst2,'asset',!!asset);
