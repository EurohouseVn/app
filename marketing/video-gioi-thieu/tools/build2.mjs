// Dựng v2 (mở bằng nỗi đau, nhạc build-up, "ting" mỗi dấu tick). Dùng: node build2.mjs <p|l> [script.json] [hậu tố thư mục]
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const O = process.argv[2] === 'l' ? 'l' : 'p'; const PORT = O === 'p';
const SFILE = process.argv[3] || 'script.json'; const SUF = process.argv[4] || 'v2';
const W = PORT ? 1080 : 1920, H = PORT ? 1920 : 1080;
const OUTDIR = path.join(ROOT, `hf-${SUF}-${PORT ? 'doc' : 'ngang'}`);
const script = JSON.parse(fs.readFileSync(path.join(ROOT, SFILE), 'utf8'));
const probe = (f) => parseFloat(spawnSync('C:/ffmpeg/ffprobe.exe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout);
const r2 = (n) => Math.round(n * 1000) / 1000;
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cap = (c) => c.charAt(0).toUpperCase() + c.slice(1);

// ---- clip 30 fps + thời lượng giọng
fs.mkdirSync(path.join(ROOT, 'assets', 'clips30'), { recursive: true });
for (const s of script) {
  if (s.clip) {
    const src = path.join(ROOT, 'assets', 'clips', s.clip + '.mp4'); const out = path.join(ROOT, 'assets', 'clips30', s.clip + '.mp4');
    if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs) {
      const r = spawnSync('C:/ffmpeg/ffmpeg.exe', ['-y', '-v', 'error', '-i', src, '-vf', 'framerate=fps=30:interp_start=0:interp_end=255:scene=100', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-an', out], { encoding: 'utf8' });
      if (r.status) throw new Error(r.stderr);
    }
    s.clipDur = probe(out);
  }
  s.voiceDur = probe(path.join(ROOT, 'assets', 'voice2', s.id + '.wav'));
}

// ---- thời lượng cảnh
const RATE_MAX = 2.0;
let T = 0; const scenes = [];
for (const [i, s] of script.entries()) {
  const lead = s.kind === 'pain' ? 0.25 : s.short ? 0.3 : 0.4;
  let D = s.voiceDur + lead + (s.kind === 'pain' ? 0.5 : s.short ? 0.25 : 0.4);
  if (s.kind === 'feat') D = Math.max(D, (s.clipDur - 0.4) / (s.short ? 4 : RATE_MAX) + 0.2, s.short ? 3.0 : 4.4);
  if (s.kind === 'pain') D = Math.max(D, 3.2);
  if (s.kind === 'turn') D = Math.max(D, 5.6);
  if (s.kind === 'pwa') D = Math.max(D, 7.4);
  if (s.kind === 'outro') D = Math.max(D + 2.2, 6.4);
  scenes.push({ ...s, i, T: r2(T), D: r2(D), lead }); T += D;
}
const TOTAL = r2(T);
const turnScene = scenes.find((s) => s.kind === 'turn');

// ---- phone
const PH = PORT ? { ow: 640, bz: 13, top: 540 } : { ow: 459, bz: 11, top: 60 };
const SW = PH.ow - PH.bz * 2, SH = Math.round(SW * 844 / 390), OH = SH + PH.bz * 2;
const PHX = PORT ? Math.round((W - PH.ow) / 2) : 1290; const PHY = PORT ? PH.top : Math.round((H - OH) / 2);

let html = '', audio = '', js = '', track = 2, sfxN = 0;
const sfx = (name, at, vol = 0.9, dur, extra = '') => { const d = dur ?? probe(path.join(ROOT, 'assets', 'sfx', name + '.wav')); audio += `<audio id="sfx${sfxN++}" class="clip" src="assets/sfx/${name}.wav" data-start="${r2(Math.max(0, at))}" data-duration="${r2(d)}" data-track-index="${track++}" data-volume="${vol}" ${extra}></audio>\n`; };
const whoosh = ['whoosh-a', 'whoosh-b', 'whoosh-c']; const tings = ['ting-a', 'ting-b'];
const ting = (at, k) => { sfx(tings[k % 2], at, 0.95, 1.0); sfx('ting-c', at + 0.14, 0.7, 0.72); }; // "ting ting"
const painScenes = scenes.filter((s) => s.kind === 'pain');

for (const s of scenes) {
  const id = `s${s.i}`; const T0 = s.T, D = s.D;
  const nextKind = scenes[s.i + 1]?.kind;
  let inner = '', cls = s.kind === 'pain' ? 'pain' : s.kind === 'turn' || s.kind === 'outro' ? '' : 'fx';
  if (s.kind === 'pain') {
    const n = s.lines.length; const num = (s.tag.match(/\d/) || [''])[0];
    inner = `<div class="stripes"></div>${num ? `<div class="bignum" id="${id}-num">${num}</div>` : ''}
<div class="ptag" id="${id}-tag">${esc(s.tag)}</div>
<div class="pstack" id="${id}-stack">${s.lines.map(([t, c], k) => { const fs_ = PORT ? Math.min(132, Math.floor(950 / (t.length * 0.64))) : Math.min(150, Math.floor(1600 / (t.length * 0.64))); return `<div class="pl ${c}" id="${id}-l${k}" style="font-size:${fs_}px">${esc(t)}</div>`; }).join('')}</div>`;
  } else if (s.kind === 'turn') {
    inner = PORT
      ? `<div class="hero"><img id="${id}-hero" src="assets/brand/hero-ecento-70.jpg"></div><div class="flash" id="${id}-flash"></div>
<div class="panel intro-panel"><img class="logo" id="${id}-logo" src="assets/brand/logo-landscape.png"><div class="tag" id="${id}-tag">${esc(s.tag)}</div><h1 class="title" id="${id}-title" style="font-size:80px;white-space:normal">${s.title.split(' ').map((w) => `<span class="w"><span class="wi">${w}</span></span>`).join(' ')}</h1><p class="sub" id="${id}-sub">${esc(s.sub)}</p></div>`
      : `<div class="hero l"><img id="${id}-hero" src="assets/brand/hero-ecento-70.jpg"></div><div class="flash" id="${id}-flash"></div>
<div class="textcol"><img class="logo" id="${id}-logo" src="assets/brand/logo-landscape.png"><div class="tag" id="${id}-tag">${esc(s.tag)}</div><h1 class="title" id="${id}-title" style="font-size:118px">${s.title.split(' ').map((w) => `<span class="w"><span class="wi">${w}</span></span>`).join(' ')}</h1><p class="sub" id="${id}-sub">${esc(s.sub)}</p></div>`;
  } else if (s.kind === 'outro') {
    inner = `<div class="outro ${O}"><div class="logoblock" id="${id}-logo"><img src="assets/brand/logo-landscape.png"></div>
<h1 class="title big" id="${id}-title">${s.sub.split(' ').map((w) => `<span class="w"><span class="wi">${w}</span></span>`).join(' ')}</h1>
<div class="stores" id="${id}-stores"><div class="store"><small>CÓ TRÊN</small><b>App Store</b></div><div class="store"><small>CÓ TRÊN</small><b>CH Play</b></div></div>
<div class="cta" id="${id}-cta">Hoặc dùng ngay · ${esc(s.tag)}</div>
<div class="prods" id="${id}-prods"><img src="assets/brand/product-ecento-70.jpg"><img src="assets/brand/product-ecento-plus.jpg"><img src="assets/brand/product-he-55-vat-canh.jpg"><img src="assets/brand/product-preco.jpg"></div>
<p class="note" id="${id}-note">Hình ảnh và số liệu trong video là dữ liệu minh hoạ.</p></div>`;
  } else {
    const chipsArr = (s.kind === 'pwa' ? ['App Store', 'CH Play', 'Cài từ web'] : s.sub.split(' · ')).map(cap);
    s.chips = chipsArr;
    const tsize = PORT ? Math.max(62, Math.min(100, Math.floor(930 / (s.title.length * 0.56)))) : 108;
    const head = `<div class="head"><div class="tag" id="${id}-tag">${esc(s.tag)}</div><h1 class="title" id="${id}-title" style="font-size:${tsize}px">${s.title.split(' ').map((w) => `<span class="w"><span class="wi">${esc(w)}</span></span>`).join(' ')}</h1>
<ul class="chips ${O}">${chipsArr.map((c, k) => `<li id="${id}-chip${k}"><i></i>${esc(c)}</li>`).join('')}</ul></div>`;
    const screen = s.kind === 'pwa'
      ? `<div class="pwa"><div class="bar"><span>🔒</span> app.nhomeurohouse.com</div><div class="site"><img src="assets/brand/hero-ecento-70.jpg"><div class="siteh"><img src="assets/brand/logo-landscape.png"></div></div>
<div class="sheet" id="${id}-sheet"><img class="ico" src="assets/brand/logo-mark.png"><b>Eurohouse Workshop OS</b><small>app.nhomeurohouse.com</small><div class="btn" id="${id}-btn">Cài đặt</div></div>
<div class="homescr" id="${id}-home"><div class="grid"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><u id="${id}-app"><img src="assets/brand/logo-mark.png"><em>Eurohouse</em></u></div></div></div>`
      : `<video id="${id}-v" class="clip scr" src="assets/clips30/${s.clip}.mp4" data-start="${r2(T0 + 0.12)}" data-duration="${r2(D - 0.12)}" data-media-start="0.35" data-playback-rate="${r2(Math.min(s.short ? 4 : RATE_MAX, Math.max(0.8, (s.clipDur - 0.35) / (D - 0.12))))}" data-track-index="${track++}" muted playsinline></video>`;
    const mascot = s.mascot ? `<div class="mascot" id="${id}-mascot"><img src="assets/brand/assistant-avatar.png"><div class="bubble">Xin chào! Mình là Bé Eu</div></div>` : '';
    inner = `<div class="orb" id="${id}-orb"></div>${head}<div class="phone" id="${id}-phone" style="left:${PHX}px;top:${PHY}px;width:${PH.ow}px;height:${OH}px"><div class="screen" style="inset:${PH.bz}px;border-radius:${PORT ? 50 : 38}px">${screen}</div><div class="notch"></div></div>${mascot}
${PORT ? '' : `<div class="prog" id="${id}-prog">${scenes.filter((q) => q.kind === 'feat' || q.kind === 'pwa').map((q) => `<b class="${q.i === s.i ? 'on' : q.i < s.i ? 'done' : ''}"></b>`).join('')}</div>`}`;
  }
  html += `<div id="${id}" class="clip scene ${O} ${cls}" data-start="${s.T}" data-duration="${s.D}" data-track-index="1">${inner}</div>\n`;
  audio += `<audio id="voice${s.i}" class="clip" src="assets/voice2/${s.id}.wav" data-start="${r2(T0 + s.lead)}" data-duration="${r2(s.voiceDur)}" data-track-index="${track++}" data-volume="1"></audio>\n`;

  // ---- hoạt cảnh
  if (s.kind === 'pain') {
    const n = s.lines.length; const span = Math.max(1.2, s.voiceDur * 0.9);
    js += `tl.fromTo('#${id}-tag',{opacity:0,y:-30},{opacity:1,y:0,duration:.3,ease:'power3.out'},${r2(T0 + 0.05)});\n`;
    if (s.tag.match(/\d/)) js += `tl.fromTo('#${id}-num',{scale:.6,opacity:0,rotate:-8},{scale:1,opacity:1,rotate:0,duration:.6,ease:'power4.out'},${r2(T0 + 0.05)});\n`;
    s.lines.forEach((_, k) => {
      const at = r2(T0 + s.lead + (k * span) / n);
      js += `tl.fromTo('#${id}-l${k}',{scale:1.7,opacity:0,filter:'blur(14px)'},{scale:1,opacity:1,filter:'blur(0px)',duration:.28,ease:'power4.out'},${at});
tl.fromTo('#${id}-stack',{x:0,y:0},{x:${k % 2 ? -16 : 16},y:${k % 2 ? 10 : -10},duration:.05,ease:'none'},${at + 0.06});
tl.to('#${id}-stack',{x:${k % 2 ? 10 : -10},y:${k % 2 ? -6 : 6},duration:.05,ease:'none'},${r2(at + 0.11)});
tl.to('#${id}-stack',{x:0,y:0,duration:.1,ease:'power2.out'},${r2(at + 0.16)});\n`;
      sfx('boom', at + 0.02, k === 0 ? 0.85 : 0.65, 1.2);
      if (k === n - 1) sfx('glitch-a', at + 0.25, 0.45, 0.7, 'data-fade-out="0.2"');
    });
    sfx('heart', T0, 0.45, D, 'data-fade-out="0.2"');
  } else if (s.kind === 'turn') {
    js += `tl.fromTo('#${id}-flash',{opacity:1},{opacity:0,duration:.5,ease:'power2.out'},${T0});
tl.fromTo('#${id}-hero',{scale:1.2},{scale:1.02,duration:${D},ease:'power1.out'},${T0});
tl.fromTo('#${id}-logo',{y:60,opacity:0,scale:.9},{y:0,opacity:1,scale:1,duration:.6,ease:'back.out(1.6)'},${r2(T0 + 0.2)});
tl.fromTo('#${id}-tag',{opacity:0,y:20},{opacity:1,y:0,duration:.35,ease:'power3.out'},${r2(T0 + 0.5)});
tl.fromTo('#${id}-title .wi',{yPercent:115},{yPercent:0,duration:.55,stagger:.09,ease:'power4.out'},${r2(T0 + 0.6)});
tl.fromTo('#${id}-sub',{opacity:0,y:24},{opacity:1,y:0,duration:.5,ease:'power3.out'},${r2(T0 + 1.3)});\n`;
    sfx('riser', T0 - 2.3, 0.7, 2.5); sfx('impact', T0, 0.8, 3.0); sfx('sparkle', T0 + 0.5, 0.6);
  } else if (s.kind === 'outro') {
    js += `tl.fromTo('#${id}-logo',{scale:.6,opacity:0,rotate:-4},{scale:1,opacity:1,rotate:0,duration:.7,ease:'back.out(1.8)'},${r2(T0 + 0.1)});
tl.fromTo('#${id}-title .wi',{yPercent:115},{yPercent:0,duration:.55,stagger:.08,ease:'power4.out'},${r2(T0 + 0.45)});
tl.fromTo('#${id}-prods img',{y:140,opacity:0,rotate:6},{y:0,opacity:1,rotate:0,duration:.6,stagger:.1,ease:'power3.out'},${r2(T0 + 0.8)});
tl.fromTo('#${id}-stores .store',{y:60,scale:.7,opacity:0},{y:0,scale:1,opacity:1,duration:.5,stagger:.18,ease:'back.out(2)'},${r2(T0 + 1.0)});
tl.fromTo('#${id}-cta',{scale:.7,opacity:0},{scale:1,opacity:1,duration:.45,ease:'back.out(2)'},${r2(T0 + 1.7)});
tl.to('#${id}-cta',{y:-8,duration:.45,ease:'sine.inOut'},${r2(T0 + 1.8)});
tl.to('#${id}-cta',{y:0,duration:.45,ease:'sine.inOut'},${r2(T0 + 2.25)});
tl.fromTo('#${id}-note',{opacity:0},{opacity:.8,duration:.5},${r2(T0 + 1.8)});\n`;
    sfx('jingle', T0 + 0.1, 0.6, 5.0); ting(T0 + 1.05, 1); ting(T0 + 1.25, 0);
  } else {
    js += `tl.fromTo('#${id}-orb',{xPercent:-8,scale:.92},{xPercent:8,scale:1.06,duration:${D},ease:'none'},${T0});
tl.fromTo('#${id}-tag',{opacity:0,y:26},{opacity:1,y:0,duration:.35,ease:'power3.out'},${r2(T0 + 0.08)});
tl.fromTo('#${id}-title .wi',{yPercent:115},{yPercent:0,duration:.5,stagger:.06,ease:'power4.out'},${r2(T0 + 0.15)});
tl.fromTo('#${id}-phone',{y:${PORT ? 420 : 300},rotate:${PORT ? 2.5 : 3},opacity:0},{y:0,rotate:0,opacity:1,duration:.7,ease:'power4.out'},${r2(T0 + 0.04)});
tl.to('#${id}-phone',{y:-12,duration:${r2(Math.max(0.5, D - 0.9))},ease:'sine.inOut'},${r2(T0 + 0.8)});\n`;
    const gap = s.short ? 0.32 : 0.42; const first = T0 + (s.short ? 0.55 : 0.8);
    s.chips.forEach((c, k) => {
      const at = r2(first + k * gap);
      js += `tl.fromTo('#${id}-chip${k}',{${PORT ? 'y:30,scale:.6' : 'x:-50'},opacity:0},{${PORT ? 'y:0,scale:1' : 'x:0'},opacity:1,duration:.4,ease:'back.out(2)'},${at});\n`;
      ting(at + 0.05, s.i + k); // dấu tick xuất hiện -> "ting ting"
    });
    if (!PORT) js += `tl.fromTo('#${id}-prog',{opacity:0},{opacity:1,duration:.4},${r2(T0 + 0.3)});\n`;
    if (s.mascot) js += `tl.fromTo('#${id}-mascot',{scale:0,rotate:-15,opacity:0},{scale:1,rotate:0,opacity:1,duration:.6,ease:'back.out(2.2)'},${r2(T0 + 1.2)});\n`, sfx('pop-a', T0 + 1.25, 0.6, 0.44);
    if (s.kind === 'pwa') {
      const a = T0 + 1.2;
      js += `tl.fromTo('#${id}-sheet',{yPercent:100},{yPercent:0,duration:.55,ease:'power3.out'},${r2(a)});
tl.fromTo('#${id}-btn',{scale:1},{scale:.92,duration:.15,ease:'power1.in'},${r2(a + 1.5)});
tl.to('#${id}-btn',{scale:1,duration:.2,ease:'back.out(3)'},${r2(a + 1.65)});
tl.to('#${id}-sheet',{yPercent:100,duration:.4,ease:'power3.in'},${r2(a + 1.95)});
tl.fromTo('#${id}-home',{opacity:0},{opacity:1,duration:.35,ease:'power2.out'},${r2(a + 2.15)});
tl.fromTo('#${id}-app',{scale:0,rotate:-20},{scale:1,rotate:0,duration:.55,ease:'back.out(2.4)'},${r2(a + 2.5)});
tl.to('#${id}-app',{y:-14,duration:.28,ease:'power2.out'},${r2(a + 3.1)});
tl.to('#${id}-app',{y:0,duration:.4,ease:'bounce.out'},${r2(a + 3.4)});\n`;
      sfx('click-a', a + 1.55, 0.8); sfx('sparkle', a + 2.5, 0.55);
    }
    if (s.id.includes('debts') || s.id.includes('invoices')) sfx('coin', T0 + 1.5, 0.35);
  }
  // chuyển cảnh
  if (s.i > 0) {
    const prevKind = scenes[s.i - 1].kind;
    if (s.kind === 'pain' || s.kind === 'turn') {
      const a = T0 - 0.06; // chớp trắng + glitch (cắt dồn dập)
      html += `<div id="sw${s.i}" class="clip cut" data-start="${r2(a)}" data-duration="0.3" data-track-index="90"><div class="cuti" id="sw${s.i}-i"></div></div>\n`;
      js += `tl.fromTo('#sw${s.i}-i',{opacity:0},{opacity:1,duration:.06,ease:'none'},${r2(a)});
tl.to('#sw${s.i}-i',{opacity:0,duration:.2,ease:'power2.out'},${r2(a + 0.08)});\n`;
      if (s.kind === 'pain') sfx('glitch-b', a, 0.5, 0.5, 'data-fade-out="0.2"');
    } else {
      const a = T0 - 0.3;
      html += `<div id="sw${s.i}" class="clip swipe" data-start="${r2(a)}" data-duration="0.75" data-track-index="90"><div class="swi" id="sw${s.i}-i"></div></div>\n`;
      js += `tl.fromTo('#sw${s.i}-i',{xPercent:-104},{xPercent:0,duration:.3,ease:'power3.in'},${r2(a)});
tl.to('#sw${s.i}-i',{xPercent:104,duration:.38,ease:'power3.out'},${r2(a + 0.32)});\n`;
      sfx(whoosh[s.i % 3], a + 0.02, 0.85);
    }
  }
}

// ---- nhạc: căng thẳng (459) -> "drop" (526) -> 533 nếu còn dài
const Tt = turnScene ? turnScene.T : 0;
const m459 = probe(path.join(ROOT, 'assets', 'music', 'bgm-459.wav')), m526 = probe(path.join(ROOT, 'assets', 'music', 'bgm-526.wav')), m533 = probe(path.join(ROOT, 'assets', 'music', 'bgm-533.wav'));
if (Tt > 0) audio += `<audio id="bgm0" class="clip" src="assets/music/bgm-459.wav" data-start="0" data-duration="${r2(Math.min(m459, Tt + 0.15))}" data-track-index="${track++}" data-volume="0.32" data-fade-out="0.25"></audio>\n`;
const after = TOTAL - Tt;
// Giữ đúng hai bài nhạc cũ (526 rồi 533). Cắt 526 ở đoạn còn to (trước phần đuôi tắt dần) và nối thẳng vào 533 bằng crossfade,
// để không có đoạn nhạc tụt. 533 có quãng nhẹ ở giây 44-70: căn cho quãng nhẹ nằm dưới lời đọc và cú "drop" thứ hai rơi vào cảnh tải ứng dụng.
if (after <= m526) audio += `<audio id="bgm1" class="clip" src="assets/music/bgm-526.wav" data-start="${r2(Tt)}" data-duration="${r2(after)}" data-track-index="${track++}" data-volume="0.24" data-fade-out="3"></audio>
`;
else {
  const cut = 88, xf = 2.5; const Ts = Tt + cut - xf;
  const store = scenes.find((q) => q.kind === 'pwa'); const dropAt = store ? store.T : TOTAL - 12;
  const mstart = Math.max(8, Math.min(30, 70 - (dropAt - Ts)));
  audio += `<audio id="bgm1" class="clip" src="assets/music/bgm-526.wav" data-start="${r2(Tt)}" data-duration="${r2(cut)}" data-track-index="${track++}" data-volume="0.24" data-fade-out="${xf}"></audio>
`;
  audio += `<audio id="bgm2" class="clip" src="assets/music/bgm-533.wav" data-start="${r2(Ts)}" data-media-start="${r2(mstart)}" data-duration="${r2(TOTAL - Ts)}" data-track-index="${track++}" data-volume="0.24" data-fade-in="${xf}" data-fade-out="3"></audio>
`;
  console.log('nhạc: 526 đến', r2(Tt + cut), '; 533 từ', r2(Ts), 'media-start', r2(mstart), '; drop 2 khoảng', r2(Ts + (70 - mstart)));
}

const css = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#F5F6F7;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#151A22}
#root{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#F5F6F7}
.scene{position:absolute;inset:0;overflow:hidden;background:#F5F6F7}
.scene.fx{background-image:linear-gradient(#DFE3E8 1px,transparent 1px),linear-gradient(90deg,#DFE3E8 1px,transparent 1px);background-size:${PORT ? 90 : 120}px ${PORT ? 90 : 120}px;background-position:center}
.scene.fx::after{content:'';position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 0%,rgba(245,246,247,0),rgba(245,246,247,.55));pointer-events:none;z-index:1}
.scene.pain{background:#F47C20}
.stripes{position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.07) 0 40px,rgba(255,255,255,0) 40px 80px)}
.bignum{position:absolute;${PORT ? 'right:-20px;bottom:120px;font-size:1100px' : 'right:60px;top:-120px;font-size:1250px'};font-weight:900;line-height:1;color:rgba(255,255,255,.22);letter-spacing:-.05em}
.ptag{position:absolute;${PORT ? 'left:70px;top:200px' : 'left:110px;top:90px'};background:#fff;color:#151A22;font-weight:800;letter-spacing:.14em;font-size:${PORT ? 30 : 28}px;padding:12px 24px;border-radius:8px}
.pstack{position:absolute;${PORT ? 'left:60px;right:60px;top:660px' : 'left:110px;right:110px;top:300px'};display:flex;flex-direction:column;gap:${PORT ? 14 : 10}px}
.pl{font-weight:800;line-height:1.12;letter-spacing:0;white-space:nowrap}
.pl.ink{color:#151A22}.pl.white{color:#fff}
.flash{position:absolute;inset:0;background:#fff;z-index:20;opacity:0}
.cut{position:absolute;inset:0;z-index:60}.cuti{position:absolute;inset:0;background:#fff;opacity:0}
.orb{position:absolute;border-radius:50%;background:#F47C20;${PORT ? 'width:1100px;height:1100px;left:-10px;top:680px' : 'width:1060px;height:1060px;left:1000px;top:-120px'};opacity:.96}
.head{position:absolute;z-index:3;${PORT ? 'left:60px;right:60px;top:188px;text-align:center' : 'left:110px;top:130px;width:1000px'}}
.tag{display:inline-block;padding:10px 22px;border-radius:8px;background:#FFF1E6;color:#C65309;font-weight:800;letter-spacing:.14em;font-size:${PORT ? 26 : 24}px;text-transform:uppercase;margin-bottom:${PORT ? 16 : 26}px}
.title{font-weight:800;line-height:1.12;letter-spacing:-.005em;color:#151A22;white-space:${PORT ? 'nowrap' : 'normal'}}
.title .w{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.12em}.title .wi{display:inline-block}
.sub{margin-top:${PORT ? 14 : 22}px;font-size:36px;font-weight:500;color:#475467;line-height:1.35}
.chips{list-style:none;display:flex;gap:16px}
.chips.l{flex-direction:column;margin-top:40px;gap:16px}
.chips.p{flex-wrap:wrap;justify-content:center;margin-top:20px;gap:12px 14px}
.chips li{display:flex;align-items:center;gap:14px;font-weight:700;background:#fff;border:2px solid #DFE3E8;border-radius:8px;box-shadow:0 8px 24px rgba(21,26,34,.08)}
.chips.l li{font-size:34px;padding:18px 26px;width:max-content}
.chips.p li{font-size:29px;padding:12px 20px}
.chips i{width:${PORT ? 30 : 34}px;height:${PORT ? 30 : 34}px;border-radius:50%;background:#F47C20;display:inline-block;position:relative;flex:none}
.chips i::after{content:'';position:absolute;left:${PORT ? 10 : 11}px;top:${PORT ? 5 : 6}px;width:8px;height:16px;border:solid #fff;border-width:0 4px 4px 0;transform:rotate(45deg)}
.phone{position:absolute;z-index:4;background:#151A22;border-radius:${PORT ? 64 : 48}px;box-shadow:0 40px 90px rgba(21,26,34,.35)}
.screen{position:absolute;overflow:hidden;background:#fff}
.screen video{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
.notch{position:absolute;left:50%;top:${PORT ? 22 : 16}px;width:${PORT ? 150 : 100}px;height:${PORT ? 34 : 24}px;margin-left:${PORT ? -75 : -50}px;background:#151A22;border-radius:20px;z-index:2}
.mascot{position:absolute;z-index:6;${PORT ? 'left:40px;top:1240px' : 'left:680px;top:540px'};display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.mascot img{width:${PORT ? 250 : 230}px;filter:drop-shadow(0 18px 30px rgba(21,26,34,.3))}
.bubble{background:#fff;border:3px solid #151A22;border-radius:18px 18px 18px 4px;padding:14px 22px;font-weight:800;font-size:${PORT ? 32 : 30}px;margin-left:30px;box-shadow:0 10px 24px rgba(21,26,34,.15)}
.prog{position:absolute;left:110px;bottom:70px;display:flex;gap:8px;z-index:3}
.prog b{width:30px;height:8px;border-radius:4px;background:#DFE3E8}.prog b.done{background:#F9A82F}.prog b.on{background:#F47C20;width:64px}
.swipe{position:absolute;inset:0;overflow:hidden;z-index:50}
.swi{position:absolute;inset:0;background:#F47C20;box-shadow:-60px 0 0 #F9A82F inset}
.hero{position:absolute;inset:0;overflow:hidden}.hero img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
.hero.l{left:${W - 920}px;width:920px}
.intro-panel{position:absolute;left:50px;right:50px;bottom:130px;background:rgba(255,255,255,.94);border-radius:8px;padding:52px 50px 56px;text-align:center;box-shadow:0 30px 80px rgba(21,26,34,.25)}
.intro-panel .logo{display:block;width:420px;border-radius:8px;margin:0 auto 36px}
.textcol{position:absolute;left:110px;top:210px;width:860px}.textcol .logo{width:430px;border-radius:8px;margin-bottom:46px}
.scene.l .textcol .title{line-height:1.05}
.outro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${PORT ? 44 : 30}px;text-align:center;z-index:3}
.logoblock{background:#F9A82F;border-radius:8px;padding:14px;box-shadow:0 20px 60px rgba(244,124,32,.35)}.logoblock img{width:${PORT ? 640 : 520}px;display:block;border-radius:6px}
.title.big{font-size:${PORT ? 92 : 100}px;white-space:normal}
.stores{display:flex;gap:22px}.store{background:#151A22;color:#fff;border-radius:12px;padding:16px 34px;text-align:left;box-shadow:0 14px 30px rgba(21,26,34,.3)}.store small{display:block;font-size:20px;letter-spacing:.14em;font-weight:700;opacity:.8}.store b{font-size:${PORT ? 46 : 42}px;font-weight:800}
.cta{background:#F47C20;color:#fff;font-weight:800;font-size:${PORT ? 36 : 40}px;padding:24px 40px;border-radius:8px;box-shadow:0 18px 40px rgba(244,124,32,.4)}
.prods{display:flex;gap:22px}.prods img{width:${PORT ? 200 : 210}px;height:${PORT ? 266 : 280}px;object-fit:cover;border-radius:8px;border:2px solid #DFE3E8;background:#fff}
.note{font-size:26px;color:#475467;font-weight:500}
.pwa{position:absolute;inset:0;background:#fff}
.pwa .bar{height:${Math.round(SW * 0.16)}px;margin-top:${Math.round(SW * 0.1)}px;margin-left:${Math.round(SW * 0.05)}px;margin-right:${Math.round(SW * 0.05)}px;background:#F2F4F7;border-radius:999px;display:flex;align-items:center;gap:10px;padding:0 ${Math.round(SW * 0.05)}px;font-size:${Math.round(SW * 0.05)}px;font-weight:600}
.pwa .site{position:absolute;left:0;right:0;top:${Math.round(SW * 0.36)}px;bottom:0;overflow:hidden}.pwa .site>img{width:100%;height:100%;object-fit:cover}
.pwa .siteh{position:absolute;left:8%;right:8%;top:6%}.pwa .siteh img{width:100%;border-radius:8px}
.sheet{position:absolute;left:0;right:0;bottom:0;height:46%;background:#fff;border-radius:28px 28px 0 0;box-shadow:0 -20px 50px rgba(21,26,34,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(SW * 0.03)}px}
.sheet .ico{width:${Math.round(SW * 0.22)}px;border-radius:22px}.sheet b{font-size:${Math.round(SW * 0.058)}px;font-weight:800}.sheet small{font-size:${Math.round(SW * 0.042)}px;color:#667085}
.sheet .btn{margin-top:${Math.round(SW * 0.03)}px;background:#F47C20;color:#fff;font-weight:800;font-size:${Math.round(SW * 0.055)}px;padding:${Math.round(SW * 0.035)}px ${Math.round(SW * 0.16)}px;border-radius:12px}
.homescr{position:absolute;inset:0;background:linear-gradient(180deg,#FFD8B0,#F9A82F 60%,#F47C20);opacity:0}
.homescr .grid{position:absolute;left:8%;right:8%;top:12%;display:grid;grid-template-columns:repeat(4,1fr);gap:${Math.round(SW * 0.07)}px ${Math.round(SW * 0.04)}px}
.homescr i{display:block;aspect-ratio:1;border-radius:22%;background:rgba(255,255,255,.55)}
.homescr u{display:flex;flex-direction:column;align-items:center;gap:6px;text-decoration:none}.homescr u img{width:100%;aspect-ratio:1;border-radius:22%;box-shadow:0 8px 18px rgba(0,0,0,.25)}
.homescr em{font-style:normal;font-size:${Math.round(SW * 0.035)}px;font-weight:700;color:#151A22}
`;
const index = `<!doctype html>
<html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=${W}, height=${H}">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>${css}</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="${W}" data-height="${H}">
${html}${audio}</div>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
${js}
window.__timelines["main"] = tl;
</script></body></html>`;
fs.mkdirSync(OUTDIR, { recursive: true });
for (const d of ['clips30', 'voice2', 'sfx', 'music', 'brand']) { fs.rmSync(path.join(OUTDIR, 'assets', d), { recursive: true, force: true }); fs.cpSync(path.join(ROOT, 'assets', d), path.join(OUTDIR, 'assets', d), { recursive: true }); }
fs.writeFileSync(path.join(OUTDIR, 'index.html'), index);
fs.writeFileSync(path.join(OUTDIR, 'meta.json'), JSON.stringify({ id: `eurohouse-${SUF}-${O}`, name: `Eurohouse ${SUF} ${O}` }, null, 2));
fs.writeFileSync(path.join(OUTDIR, 'hyperframes.json'), JSON.stringify({ "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json", registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" } }, null, 2));
console.log('OK', O, SFILE, 'tổng', TOTAL, 's', scenes.length, 'cảnh; drop tại', Tt);
console.log(scenes.map((s) => `${s.id} T=${s.T} D=${s.D} voice=${r2(s.voiceDur)}`).join('\n'));
