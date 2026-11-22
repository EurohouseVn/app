// Dựng dự án HyperFrames từ script.json + clip màn hình + giọng đọc. Dùng: node build.mjs p|l
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawnSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const O = process.argv[2] === 'l' ? 'l' : 'p';
const PORT = O === 'p';
const W = PORT ? 1080 : 1920, H = PORT ? 1920 : 1080;
const OUTDIR = path.join(ROOT, PORT ? 'hf-portrait' : 'hf-landscape');
const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'script.json'), 'utf8'));
const probe = (f) => parseFloat(spawnSync('C:/ffmpeg/ffprobe.exe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout);
const r2 = (n) => Math.round(n * 1000) / 1000;

// ---- chuẩn bị tài sản (clip 30 fps, giọng, sfx, nhạc, ảnh thương hiệu)
fs.mkdirSync(path.join(ROOT, 'assets', 'clips30'), { recursive: true });
for (const s of script) {
  if (!s.clip) continue;
  const out = path.join(ROOT, 'assets', 'clips30', s.clip + '.mp4');
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(path.join(ROOT, 'assets', 'clips', s.clip + '.mp4')).mtimeMs) {
    const r = spawnSync('C:/ffmpeg/ffmpeg.exe', ['-y', '-v', 'error', '-i', path.join(ROOT, 'assets', 'clips', s.clip + '.mp4'), '-vf', 'framerate=fps=30:interp_start=0:interp_end=255:scene=100', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-an', out], { encoding: 'utf8' });
    if (r.status) throw new Error(r.stderr);
  }
  s.clipDur = probe(out);
}
for (const s of script) s.voiceDur = probe(path.join(ROOT, 'assets', 'voice', s.id + '.wav'));

// ---- thời lượng từng cảnh
const LEAD = 0.45; // giọng vào sau khi cảnh vào
const RATE_MAX = 1.7;
let T = 0; const scenes = [];
for (const [i, s] of script.entries()) {
  const base = s.voiceDur + LEAD + 0.55;
  let D = base;
  if (s.clip) D = Math.max(base, (s.clipDur - 0.4) / RATE_MAX + 0.2, 5.2);
  if (s.id === 's00-intro') D = Math.max(base + 0.6, 6.4);
  if (s.id === 's20-outro') D = Math.max(base + 2.4, 7);
  if (s.id === 's19-pwa') D = Math.max(base + 1.2, 8.2);
  const sc = { ...s, i, T: r2(T), D: r2(D) }; scenes.push(sc); T += D;
}
const TOTAL = r2(T);

const escapeHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const words = (t) => escapeHtml(t).split(' ').map((w) => `<span class="w"><span class="wi">${w}</span></span>`).join(' ');
const CHIPS = { 's00-intro': [], 's19-pwa': ['Mở bằng trình duyệt', 'Chọn Cài đặt ứng dụng', 'Dùng như app thật'], 's20-outro': [] };

// ---- phone
const PH = PORT ? { ow: 704, bz: 14, top: 505 } : { ow: 459, bz: 11, top: 60 };
const SW = PH.ow - PH.bz * 2, SH = Math.round(SW * 844 / 390), OH = SH + PH.bz * 2;
const PHX = PORT ? Math.round((W - PH.ow) / 2) : 1290;
const PHY = PORT ? PH.top : Math.round((H - OH) / 2);

let html = '';
let audio = '';
let js = '';
let track = 2;
const whoosh = ['whoosh-a', 'whoosh-b', 'whoosh-c'];
const pops = ['pop-a', 'pop-b'];
let sfxN = 0;
const sfx = (name, at, vol = 0.9, dur) => { const d = dur ?? probe(path.join(ROOT, 'assets', 'sfx', name + '.wav')); audio += `<audio id="sfx${sfxN++}" class="clip" src="assets/sfx/${name}.wav" data-start="${r2(at)}" data-duration="${r2(d)}" data-track-index="${track++}" data-volume="${vol}"></audio>\n`; };

for (const s of scenes) {
  const id = `s${s.i}`;
  const isIntro = s.id === 's00-intro', isOutro = s.id === 's20-outro', isPwa = s.id === 's19-pwa';
  const chips = (CHIPS[s.id] ?? s.sub.split(' · ')).map((c) => c.charAt(0).toUpperCase() + c.slice(1));
  const tsize = PORT ? Math.max(64, Math.min(104, Math.floor(930 / (s.title.length * 0.56)))) : 112;
  let inner = '';
  if (isIntro) {
    inner = PORT
      ? `<div class="hero"><img id="${id}-hero" src="assets/brand/hero-ecento-70.jpg"></div>
<div class="panel intro-panel"><img class="logo" id="${id}-logo" src="assets/brand/logo-landscape.png"><div class="tag" id="${id}-tag">${escapeHtml(s.tag)}</div><h1 class="title" id="${id}-title" style="font-size:80px;white-space:normal">${words(s.title)}</h1><p class="sub" id="${id}-sub">${escapeHtml(s.sub)}</p></div>`
      : `<div class="hero l"><img id="${id}-hero" src="assets/brand/hero-ecento-70.jpg"></div>
<div class="textcol"><img class="logo" id="${id}-logo" src="assets/brand/logo-landscape.png"><div class="tag" id="${id}-tag">${escapeHtml(s.tag)}</div><h1 class="title" id="${id}-title" style="font-size:118px">${words(s.title)}</h1><p class="sub" id="${id}-sub">${escapeHtml(s.sub)}</p></div>`;
  } else if (isOutro) {
    inner = `<div class="outro ${O}"><div class="logoblock" id="${id}-logo"><img src="assets/brand/logo-landscape.png"></div>
<h1 class="title big" id="${id}-title">${words(s.sub)}</h1>
<div class="cta" id="${id}-cta">Dùng thử ngay · ${escapeHtml(s.tag)}</div>
<div class="prods" id="${id}-prods"><img src="assets/brand/product-ecento-70.jpg"><img src="assets/brand/product-ecento-plus.jpg"><img src="assets/brand/product-he-55-vat-canh.jpg"><img src="assets/brand/product-preco.jpg"></div>
<p class="note" id="${id}-note">Hình ảnh và số liệu trong video là dữ liệu minh hoạ.</p></div>`;
  } else {
    const head = `<div class="head"><div class="tag" id="${id}-tag">${escapeHtml(s.tag)}</div><h1 class="title" id="${id}-title" style="font-size:${tsize}px">${words(s.title)}</h1><p class="sub" id="${id}-sub">${escapeHtml(s.sub)}</p>${PORT ? '' : `<ul class="chips">${chips.map((c, k) => `<li id="${id}-chip${k}"><i></i>${escapeHtml(c)}</li>`).join('')}</ul>`}</div>`;
    const screen = isPwa
      ? `<div class="pwa" id="${id}-pwa"><div class="bar"><span>🔒</span> app.nhomeurohouse.com</div><div class="site"><img src="assets/brand/hero-ecento-70.jpg"><div class="siteh"><img src="assets/brand/logo-landscape.png"></div></div>
<div class="sheet" id="${id}-sheet"><img class="ico" src="assets/brand/logo-mark.png"><b>Eurohouse Workshop OS</b><small>app.nhomeurohouse.com</small><div class="btn" id="${id}-btn">Cài đặt</div></div>
<div class="homescr" id="${id}-home"><div class="grid"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><u id="${id}-app"><img src="assets/brand/logo-mark.png"><em>Eurohouse</em></u></div></div></div>`
      : `<video id="${id}-v" class="clip scr" src="assets/clips30/${s.clip}.mp4" data-start="${r2(s.T + 0.12)}" data-duration="${r2(s.D - 0.12)}" data-media-start="0.35" data-playback-rate="${r2(Math.min(RATE_MAX, Math.max(0.8, (s.clipDur - 0.35) / (s.D - 0.12))))}" data-track-index="${track++}" muted playsinline></video>`;
    inner = `<div class="orb" id="${id}-orb"></div>${head}<div class="phone" id="${id}-phone" style="left:${PHX}px;top:${PHY}px;width:${PH.ow}px;height:${OH}px"><div class="screen" style="inset:${PH.bz}px;border-radius:${PORT ? 50 : 38}px">${screen}</div><div class="notch"></div></div>
${PORT ? '' : `<div class="prog" id="${id}-prog">${scenes.slice(1, -1).map((q, k) => `<b class="${q.i === s.i ? 'on' : q.i < s.i ? 'done' : ''}"></b>`).join('')}</div>`}`;
  }
  html += `<div id="${id}" class="clip scene ${O}${isIntro || isOutro ? '' : ' fx'}" data-start="${s.T}" data-duration="${s.D}" data-track-index="1">${inner}</div>\n`;
  audio += `<audio id="voice${s.i}" class="clip" src="assets/voice/${s.id}.wav" data-start="${r2(s.T + LEAD)}" data-duration="${r2(s.voiceDur)}" data-track-index="${track++}" data-volume="1"></audio>\n`;

  // ---- hoạt cảnh
  const T0 = s.T, D = s.D;
  if (isIntro) {
    js += `tl.fromTo('#${id}-hero',{scale:1.18},{scale:1.02,duration:${D},ease:'power1.out'},${T0});
tl.fromTo('#${id}-logo',{y:60,opacity:0,scale:.9},{y:0,opacity:1,scale:1,duration:.7,ease:'back.out(1.6)'},${T0 + 0.25});
tl.fromTo('#${id}-tag',{opacity:0,y:20},{opacity:1,y:0,duration:.4,ease:'power3.out'},${T0 + 0.7});
tl.fromTo('#${id}-title .wi',{yPercent:115},{yPercent:0,duration:.6,stagger:.09,ease:'power4.out'},${T0 + 0.8});
tl.fromTo('#${id}-sub',{opacity:0,y:24},{opacity:1,y:0,duration:.55,ease:'power3.out'},${T0 + 1.5});\n`;
    sfx('riser', T0 - 0.0, 0.5, 2.0); sfx('impact', T0 + 0.8, 0.55, 2.6);
  } else if (isOutro) {
    js += `tl.fromTo('#${id}-logo',{scale:.6,opacity:0,rotate:-4},{scale:1,opacity:1,rotate:0,duration:.8,ease:'back.out(1.8)'},${T0 + 0.1});
tl.fromTo('#${id}-title .wi',{yPercent:115},{yPercent:0,duration:.6,stagger:.08,ease:'power4.out'},${T0 + 0.5});
tl.fromTo('#${id}-prods img',{y:140,opacity:0,rotate:6},{y:0,opacity:1,rotate:0,duration:.7,stagger:.12,ease:'power3.out'},${T0 + 0.9});
tl.fromTo('#${id}-cta',{scale:.7,opacity:0},{scale:1,opacity:1,duration:.5,ease:'back.out(2)'},${T0 + 1.5});
tl.to('#${id}-cta',{y:-8,duration:.5,ease:'sine.inOut'},${T0 + 2.0});
tl.to('#${id}-cta',{y:0,duration:.5,ease:'sine.inOut'},${T0 + 2.5});
tl.fromTo('#${id}-note',{opacity:0},{opacity:.8,duration:.6},${T0 + 2.0});\n`;
    sfx('jingle', T0 + 0.1, 0.6, 5.5); sfx('sparkle', T0 + 1.5, 0.6);
  } else {
    js += `tl.fromTo('#${id}-orb',{xPercent:-8,scale:.92},{xPercent:8,scale:1.06,duration:${D},ease:'none'},${T0});
tl.fromTo('#${id}-tag',{opacity:0,y:26},{opacity:1,y:0,duration:.4,ease:'power3.out'},${T0 + 0.1});
tl.fromTo('#${id}-title .wi',{yPercent:115},{yPercent:0,duration:.55,stagger:.07,ease:'power4.out'},${T0 + 0.2});
tl.fromTo('#${id}-sub',{opacity:0,y:22},{opacity:1,y:0,duration:.5,ease:'power3.out'},${T0 + 0.55});
tl.fromTo('#${id}-phone',{y:${PORT ? 420 : 300},rotate:${PORT ? 2.5 : 3},opacity:0},{y:0,rotate:0,opacity:1,duration:.8,ease:'power4.out'},${T0 + 0.05});
tl.to('#${id}-phone',{y:-12,duration:${r2(D - 1.0)},ease:'sine.inOut'},${T0 + 0.9});\n`;
    if (!PORT) {
      chips.forEach((c, k) => { const at = T0 + 1.0 + k * 0.5; js += `tl.fromTo('#${id}-chip${k}',{x:-50,opacity:0},{x:0,opacity:1,duration:.45,ease:'back.out(1.7)'},${r2(at)});\n`; sfx(pops[(s.i + k) % 2], at + 0.02, 0.45, 0.4); });
      js += `tl.fromTo('#${id}-prog',{opacity:0},{opacity:1,duration:.4},${T0 + 0.3});\n`;
    } else sfx(pops[s.i % 2], T0 + 0.35, 0.5, 0.4);
    if (isPwa) {
      const a = T0 + 1.4;
      js += `tl.fromTo('#${id}-sheet',{yPercent:100},{yPercent:0,duration:.6,ease:'power3.out'},${r2(a)});
tl.fromTo('#${id}-btn',{scale:1},{scale:.92,duration:.15,ease:'power1.in'},${r2(a + 1.6)});
tl.to('#${id}-btn',{scale:1,duration:.2,ease:'back.out(3)'},${r2(a + 1.75)});
tl.to('#${id}-sheet',{yPercent:100,duration:.45,ease:'power3.in'},${r2(a + 2.1)});
tl.fromTo('#${id}-home',{opacity:0},{opacity:1,duration:.4,ease:'power2.out'},${r2(a + 2.3)});
tl.fromTo('#${id}-app',{scale:0,rotate:-20},{scale:1,rotate:0,duration:.6,ease:'back.out(2.4)'},${r2(a + 2.7)});
tl.to('#${id}-app',{y:-14,duration:.3,ease:'power2.out'},${r2(a + 3.4)});
tl.to('#${id}-app',{y:0,duration:.4,ease:'bounce.out'},${r2(a + 3.7)});\n`;
      sfx('click-a', a + 1.65, 0.8); sfx('sparkle', a + 2.7, 0.55);
    }
    if (s.id === 's08-debts' || s.id === 's09-invoices') sfx('coin', T0 + 1.2, 0.35);
  }
  // quét cam chuyển cảnh trước mỗi cảnh (trừ cảnh đầu)
  if (s.i > 0) {
    const a = T0 - 0.3;
    html += `<div id="sw${s.i}" class="clip swipe" data-start="${r2(a)}" data-duration="0.75" data-track-index="90"><div class="swi" id="sw${s.i}-i"></div></div>\n`;
    js += `tl.fromTo('#sw${s.i}-i',{xPercent:-104},{xPercent:0,duration:.3,ease:'power3.in'},${r2(a)});
tl.to('#sw${s.i}-i',{xPercent:104,duration:.38,ease:'power3.out'},${r2(a + 0.32)});\n`;
    sfx(whoosh[s.i % 3], a + 0.02, 0.85);
  }
}

// ---- nhạc nền (519 rồi 520 nếu video dài hơn) + fade
const m1 = probe(path.join(ROOT, 'assets', 'music', 'bgm-519.wav'));
audio += `<audio id="bgm1" class="clip" src="assets/music/bgm-519.wav" data-start="0" data-duration="${r2(Math.min(m1, TOTAL))}" data-track-index="${track++}" data-volume="0.2" data-fade-out="${TOTAL <= m1 ? 3 : 1.5}"></audio>\n`;
if (TOTAL > m1) audio += `<audio id="bgm2" class="clip" src="assets/music/bgm-520.wav" data-start="${r2(m1 - 1)}" data-duration="${r2(TOTAL - m1 + 1)}" data-track-index="${track++}" data-volume="0.2" data-fade-in="1" data-fade-out="3"></audio>\n`;

const css = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#F5F6F7;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#151A22}
#root{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#F5F6F7}
.scene{position:absolute;inset:0;overflow:hidden;background:#F5F6F7;
  background-image:linear-gradient(#DFE3E8 1px,transparent 1px),linear-gradient(90deg,#DFE3E8 1px,transparent 1px);background-size:${PORT ? 90 : 120}px ${PORT ? 90 : 120}px;background-position:center}
.scene.fx::after{content:'';position:absolute;inset:0;background:radial-gradient(120% 80% at 50% 0%,rgba(245,246,247,.0),rgba(245,246,247,.55));pointer-events:none;z-index:1}
.orb{position:absolute;border-radius:50%;background:#F47C20;${PORT ? 'width:1100px;height:1100px;left:-10px;top:620px' : 'width:1060px;height:1060px;left:1000px;top:-120px'};opacity:.96}
.head{position:absolute;z-index:3;${PORT ? 'left:70px;right:70px;top:188px;text-align:center' : 'left:110px;top:150px;width:1000px'}}
.tag{display:inline-block;padding:10px 22px;border-radius:8px;background:#FFF1E6;color:#C65309;font-weight:800;letter-spacing:.14em;font-size:${PORT ? 26 : 24}px;text-transform:uppercase;margin-bottom:${PORT ? 18 : 26}px}
.title{font-weight:800;line-height:1.12;letter-spacing:-.02em;color:#151A22;white-space:${PORT ? 'nowrap' : 'normal'}}
.title .w{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.12em}.title .wi{display:inline-block}
.sub{margin-top:${PORT ? 14 : 22}px;font-size:${PORT ? 36 : 36}px;font-weight:500;color:#475467;line-height:1.35}
.chips{list-style:none;margin-top:44px;display:flex;flex-direction:column;gap:18px}
.chips li{display:flex;align-items:center;gap:18px;font-size:34px;font-weight:700;background:#fff;border:2px solid #DFE3E8;border-radius:8px;padding:18px 26px;width:max-content;box-shadow:0 8px 24px rgba(21,26,34,.06)}
.chips i{width:34px;height:34px;border-radius:50%;background:#F47C20;display:inline-block;position:relative}
.chips i::after{content:'';position:absolute;left:11px;top:6px;width:9px;height:17px;border:solid #fff;border-width:0 4px 4px 0;transform:rotate(45deg)}
.phone{position:absolute;z-index:4;background:#151A22;border-radius:${PORT ? 64 : 48}px;box-shadow:0 40px 90px rgba(21,26,34,.35)}
.screen{position:absolute;overflow:hidden;background:#fff}
.screen video{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
.notch{position:absolute;left:50%;top:${PORT ? 22 : 16}px;width:${PORT ? 150 : 100}px;height:${PORT ? 34 : 24}px;margin-left:${PORT ? -75 : -50}px;background:#151A22;border-radius:20px;z-index:2}
.prog{position:absolute;left:110px;bottom:70px;display:flex;gap:8px;z-index:3}
.prog b{width:34px;height:8px;border-radius:4px;background:#DFE3E8}.prog b.done{background:#F9A82F}.prog b.on{background:#F47C20;width:70px}
.swipe{position:absolute;inset:0;overflow:hidden;z-index:50}
.swi{position:absolute;inset:0;background:#F47C20;box-shadow:-60px 0 0 #F9A82F inset}
.hero{position:absolute;inset:0;overflow:hidden}.hero img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover}
.hero.l{left:${W - 920}px;width:920px}
.intro-panel{position:absolute;left:50px;right:50px;bottom:130px;background:rgba(255,255,255,.92);border-radius:8px;padding:52px 50px 56px;text-align:center;box-shadow:0 30px 80px rgba(21,26,34,.25)}
.intro-panel .logo{width:420px;border-radius:8px;margin-bottom:36px}
.textcol{position:absolute;left:110px;top:210px;width:860px}.textcol .logo{width:430px;border-radius:8px;margin-bottom:46px}
.scene.l .textcol .title{line-height:1.05}
.outro{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${PORT ? 44 : 30}px;text-align:center;z-index:3}
.logoblock{background:#F9A82F;border-radius:8px;padding:14px;box-shadow:0 20px 60px rgba(244,124,32,.35)}.logoblock img{width:${PORT ? 640 : 520}px;display:block;border-radius:6px}
.title.big{font-size:${PORT ? 92 : 100}px;white-space:normal}
.cta{background:#F47C20;color:#fff;font-weight:800;font-size:${PORT ? 44 : 40}px;padding:26px 48px;border-radius:8px;box-shadow:0 18px 40px rgba(244,124,32,.4)}
.prods{display:flex;gap:22px}.prods img{width:${PORT ? 200 : 210}px;height:${PORT ? 266 : 280}px;object-fit:cover;border-radius:8px;border:2px solid #DFE3E8;background:#fff}
.note{font-size:26px;color:#475467;font-weight:500}
.pwa{position:absolute;inset:0;background:#fff;font-family:Inter,sans-serif}
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
for (const d of ['clips30', 'voice', 'sfx', 'music', 'brand']) { fs.rmSync(path.join(OUTDIR, 'assets', d), { recursive: true, force: true }); fs.cpSync(path.join(ROOT, 'assets', d), path.join(OUTDIR, 'assets', d), { recursive: true }); }
fs.writeFileSync(path.join(OUTDIR, 'index.html'), index);
fs.writeFileSync(path.join(OUTDIR, 'meta.json'), JSON.stringify({ id: 'eurohouse-gioi-thieu-' + O, name: 'Eurohouse Workshop OS ' + O }, null, 2));
if (!fs.existsSync(path.join(OUTDIR, 'hyperframes.json'))) fs.writeFileSync(path.join(OUTDIR, 'hyperframes.json'), JSON.stringify({ "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json", registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" } }, null, 2));
console.log('OK', O, 'tổng', TOTAL, 's', scenes.length, 'cảnh');
console.log(scenes.map((s) => `${s.id} T=${s.T} D=${s.D} voice=${r2(s.voiceDur)}`).join('\n'));
