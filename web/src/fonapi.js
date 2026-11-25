// Client du service fon local (nukun-fon, http://127.0.0.1:8765) : reconnaissance, traduction, voix.
export const FON_BASE = (() => { try { return localStorage.getItem("fon.base") || "http://127.0.0.1:8765"; } catch { return "http://127.0.0.1:8765"; } })();

async function call(path, opts = {}, timeout = 60000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), timeout);
  try { const r = await fetch(FON_BASE + path, { ...opts, signal: c.signal }); if (!r.ok) throw new Error((await r.text()) || r.statusText); return r; }
  finally { clearTimeout(t); }
}

export async function fonHealth() {
  try { const r = await call("/health", {}, 2500); return await r.json(); } catch { return null; }
}
export async function translate(text, src, tgt) {
  const r = await call("/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, src, tgt }) });
  return r.json();
}
export async function tts(text) {
  const r = await call("/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, lang: "fon" }) });
  return URL.createObjectURL(await r.blob());
}
export async function speechToFrench(blob) {
  const fd = new FormData(); fd.append("audio", blob, "voix.webm");
  const r = await call("/speech", { method: "POST", body: fd }, 120000);
  return r.json();
}
// Dit une phrase française en fon : traduction puis synthèse vocale.
const cache = new Map();
export async function sayInFon(frText) {
  if (!cache.has(frText)) {
    const { text } = await translate(frText, "fr", "fon");
    cache.set(frText, { fon: text, url: await tts(text) });
  }
  const v = cache.get(frText); await new Audio(v.url).play(); return v.fon;
}
