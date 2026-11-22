import { record } from './rec.mjs';
const clip = async (page, h) => { await h.wait(1200); await h.scroll(520, 1400); await h.wait(700); await h.scroll(560, 1400); await h.wait(700); await h.scroll(600, 1400); await h.wait(900); };
clip.warm = async (page, h) => { await h.go('/'); await h.wait(5000); };
await record('c01-home', clip);
