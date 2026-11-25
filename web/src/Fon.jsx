import { useEffect, useRef, useState } from "react";
import { FON_BASE, fonHealth, speechToFrench, translate, tts } from "./fonapi.js";
import { logEvent, speak } from "./lib.js";

const PHRASES = [
  "Attention, ce compte présente des signes d'arnaque. Ne renvoyez pas l'argent.",
  "Personne de MTN ne vous demandera votre code secret.",
  "J'ai vendu trois pagnes à vingt-cinq mille francs.",
  "Votre solde est de cent mille francs.",
];

export default function Fon() {
  const [health, setHealth] = useState(undefined);
  const [src, setSrc] = useState("fr");
  const [text, setText] = useState(PHRASES[0]);
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [rec, setRec] = useState(false);
  const mr = useRef(null); const chunks = useRef([]);

  const refresh = () => fonHealth().then(setHealth);
  useEffect(() => { refresh(); const t = setInterval(refresh, 8000); return () => clearInterval(t); }, []);
  const online = !!health?.ok;
  const tgt = src === "fr" ? "fon" : "fr";

  async function doTranslate() {
    setErr(""); setBusy("translate"); setOut(null);
    try {
      const r = await translate(text, src, tgt);
      setOut({ src, input: text, text: r.text, ms: r.ms });
      logEvent("translation", { dir: `${src}→${tgt}` });
      if (tgt === "fr") speak(r.text);
    } catch (e) { setErr("Traduction impossible : " + (e.message || e)); }
    setBusy("");
  }
  async function listen(fonText) {
    setErr(""); setBusy("tts");
    try { await new Audio(await tts(fonText)).play(); } catch (e) { setErr("Voix fon indisponible : " + (e.message || e)); }
    setBusy("");
  }
  async function startRec() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const m = new MediaRecorder(stream); chunks.current = [];
      m.ondataavailable = (e) => chunks.current.push(e.data);
      m.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setBusy("asr");
        try {
          const r = await speechToFrench(new Blob(chunks.current, { type: m.mimeType || "audio/webm" }));
          setOut({ src: "fon", input: r.fon, text: r.fr, ms: r.ms, spoken: true }); speak(r.fr);
          logEvent("translation", { dir: "voix fon→fr" });
        } catch (e) { const m = String(e.message || e); setErr(/RAM|indisponible|503/i.test(m) ? "La reconnaissance du fon parlé demande plus de mémoire que cet ordinateur n'en a (modèle de 4 Go). Elle tournera sur nos serveurs GPU. En attendant, écrivez votre phrase en fon à droite." : "Reconnaissance du fon impossible pour le moment. Réessayez ou écrivez votre phrase."); }
        setBusy("");
      };
      mr.current = m; m.start(); setRec(true);
    } catch { setErr("Micro refusé ou indisponible."); }
  }
  function stopRec() { mr.current?.stop(); setRec(false); }

  return (
    <div className="space-y-6">
      <div className={`card flex flex-wrap items-center justify-between gap-3 p-5 ${online ? "" : "ring-1 ring-caution/40"}`}>
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${health === undefined ? "bg-subtle" : online ? "bg-safe shadow-[0_0_10px_#22c55e]" : "bg-warn"}`} />
          <div>
            <div className="font-semibold">{health === undefined ? "Connexion…" : online ? "Traduction en fon prête" : "Traduction en fon indisponible pour le moment"}</div>
            <div className="text-xs text-muted">{online ? "Parlez ou écrivez en fon ou en français" : "Si Chrome demande l'accès aux appareils de votre réseau local, cliquez sur « Autoriser », puis sur « Vérifier »."}</div>
          </div>
        </div>
        <button onClick={refresh} className="btn-ghost rounded-full">Vérifier</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4 p-6">
          <div className="kicker">Parler en fon</div>
          {true ? (
            <>
              <p className="text-sm text-muted">Appuyez, parlez en fon, puis appuyez à nouveau. NUKÚN transcrit le fon et le traduit en français.</p>
              <button disabled={!online || !!busy} onClick={rec ? stopRec : startRec} className={`relative mx-auto grid h-28 w-28 place-items-center rounded-full ${rec ? "bg-danger text-white" : "bg-gradient-to-b from-[#ffd76a] to-[#f2b52c] text-ink-950"} shadow-[0_20px_50px_-15px_rgba(232,163,23,.8)] disabled:opacity-40`}>
                {rec && <span className="pulse-ring absolute inset-0 rounded-full bg-danger" />}
                <svg viewBox="0 0 24 24" className="relative h-10 w-10" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" /></svg>
              </button>
              <div className="text-center text-sm text-muted">{rec ? "J'écoute… appuyez pour arrêter" : busy === "asr" ? "Reconnaissance du fon en cours…" : "Fon → français"}</div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="relative grid h-24 w-24 place-items-center rounded-full bg-fg/5 text-muted">
                <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" /></svg>
                <span className="absolute -right-1 -top-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-ink-950">BIENTÔT</span>
              </div>
              <div className="font-semibold">Comprendre le fon parlé</div>
              <p className="max-w-sm text-sm text-muted">Le modèle de reconnaissance du fon demande plus de puissance que ce téléphone ou cet ordinateur. Il tournera sur nos serveurs GPU. En attendant, écrivez votre phrase à droite.</p>
            </div>
          )}
        </div>

        <div className="card space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div className="kicker">Écrire</div>
            <div className="glass flex rounded-full p-1 text-sm">
              {[["fr", "Français → Fon"], ["fon", "Fon → Français"]].map(([k, l]) => <button key={k} onClick={() => { setSrc(k); setOut(null); }} className={`rounded-full px-3 py-1 ${src === k ? "bg-fg/10 font-semibold" : "text-muted"}`}>{l}</button>)}
            </div>
          </div>
          <textarea className="input min-h-[110px]" value={text} onChange={(e) => setText(e.target.value)} placeholder={src === "fr" ? "Phrase en français…" : "Gbè ɖé ɖò fɔngbè mɛ…"} />
          {src === "fr" && <div className="flex flex-wrap gap-2">{PHRASES.map((p) => <button key={p} onClick={() => setText(p)} className="chip text-left hover:border-accent/50">{p.length > 46 ? p.slice(0, 46) + "…" : p}</button>)}</div>}
          <button disabled={!online || !text.trim() || !!busy} onClick={doTranslate} className="btn-gold w-full">{busy === "translate" ? "Traduction…" : "Traduire"}</button>
        </div>
      </div>

      {err && <div className="card p-4 text-sm text-bad">{err}</div>}
      {out && (
        <div className="card fadein grid gap-4 p-6 md:grid-cols-2">
          <div><div className="text-xs text-muted">{out.src === "fon" ? (out.spoken ? "Fon entendu" : "Fon") : "Français"}</div><div className="mt-1 text-lg">{out.input}</div></div>
          <div>
            <div className="text-xs text-muted">{out.src === "fon" ? "Français" : "Fon"} · {Math.round(out.ms || 0)} ms</div>
            <div className="mt-1 text-lg font-semibold text-accent">{out.text}</div>
            <div className="mt-3 flex gap-2">
              {out.src === "fr" && <button disabled={!!busy} onClick={() => listen(out.text)} className="btn-gold rounded-full">{busy === "tts" ? "Génération…" : "🔊 Écouter en fon"}</button>}
              {out.src === "fon" && <button onClick={() => speak(out.text)} className="btn-ghost rounded-full">🔊 Écouter en français</button>}
              {out.src === "fon" && out.input && <button disabled={!!busy} onClick={() => listen(out.input)} className="btn-ghost rounded-full">🔊 Réécouter le fon</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
