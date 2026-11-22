# Giọng đọc v2: VieNeu (v3 Turbo) nhân bản từ mẫu giọng Hải Đăng; nhịp nhanh, nhấn mạnh hơn.
# Dùng: python tts.py [script.json|script-teaser.json] [tiền tố id ...]
import json, sys, os, subprocess
from vieneu import Vieneu
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
sfile = args[0] if args and args[0].endswith('.json') else 'script.json'
only = [a for a in args if not a.endswith('.json')]
lines = json.load(open(os.path.join(root, sfile), encoding='utf8'))
t = Vieneu()
ref = os.path.join(root, 'assets', 'ref', 'hai-dang-ref.wav')
os.makedirs(os.path.join(root, 'assets', 'voice2'), exist_ok=True)
TEMPO = float(os.environ.get('EH_TEMPO', '1.12'))
for l in lines:
    if only and not any(l['id'].startswith(o) for o in only): continue
    raw = os.path.join(root, 'assets', 'voice2', l['id'] + '.raw.wav'); out = os.path.join(root, 'assets', 'voice2', l['id'] + '.wav')
    audio = t.infer(l['text'], ref_audio=ref, temperature=float(os.environ.get('EH_TEMP', '1.0')))
    t.save(audio, raw)
    # nhanh hơn, nén động để giọng "dày" và dồn dập, nhấn dải 2-4 kHz cho rõ chữ
    af = f"atempo={TEMPO},highpass=f=80,acompressor=threshold=-20dB:ratio=3.5:attack=5:release=80:makeup=4,equalizer=f=3000:t=q:w=1.2:g=3,loudnorm=I=-15:TP=-1.5:LRA=7"
    subprocess.run(['C:/ffmpeg/ffmpeg.exe', '-y', '-v', 'error', '-i', raw, '-filter:a', af, '-ar', '48000', out], check=True)
    os.remove(raw)
    print('OK', l['id'], flush=True)
