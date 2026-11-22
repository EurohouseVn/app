# Giọng đọc: VieNeu (v3 Turbo) nhân bản từ mẫu giọng Hải Đăng, mỗi cảnh một tệp wav 48 kHz.
import json, sys, os, subprocess
import soundfile as sf
from vieneu import Vieneu
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lines = json.load(open(os.path.join(root, 'script.json'), encoding='utf8'))
only = sys.argv[1:]
t = Vieneu()
ref = os.path.join(root, 'assets', 'ref', 'hai-dang-ref.wav')
for l in lines:
    if only and not any(l['id'].startswith(o) for o in only): continue
    raw = os.path.join(root, 'assets', 'voice', l['id'] + '.raw.wav'); out = os.path.join(root, 'assets', 'voice', l['id'] + '.wav')
    audio = t.infer(l['text'], ref_audio=ref)
    t.save(audio, raw)
    # làm chậm nhẹ ~6% như bản quảng cáo trước để dễ nghe
    subprocess.run(['C:/ffmpeg/ffmpeg.exe', '-y', '-v', 'error', '-i', raw, '-filter:a', 'atempo=0.94,highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=9', '-ar', '48000', out], check=True)
    os.remove(raw)
    print('OK', l['id'], flush=True)
