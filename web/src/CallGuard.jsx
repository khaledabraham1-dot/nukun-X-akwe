import { useEffect, useRef, useState } from "react";
import { ALERT_FR, LEVELS, REGISTRY, SCENARIOS, SIGNAL_LABEL, analyzeUtterance, scoreCall, verifyCaller } from "./callguard.js";
import { getRecognizer, load, logEvent, save, speak } from "./lib.js";
import { fonHealth, sayInFon, translate } from "./fonapi.js";

const now = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function callerVoice(text) {
  return new Promise((res) => {
    try {
      const u = new SpeechSynthesisUtterance(text); u.lang = "fr-FR"; u.rate = 1.05; u.pitch = 0.75;
      const vs = speechSynthesis.getVoices().filter((v) => v.lang?.startsWith("fr")); if (vs.length > 1) u.voice = vs[1]; else if (vs[0]) u.voice = vs[0];
      u.onend = res; u.onerror = res; speechSynthesis.cancel(); speechSynthesis.speak(u);
      setTimeout(res, 400 + text.length * 70);
    } catch { res(); }
  });
}

export default function CallGuard() {
  const [call, setCall] = useState(null); // {number, name, verified, registry}
  const [lines, setLines] = useState([]); // {who, text, fr?, signals, t}
  const [events, setEvents] = useState([]);
  const [signals, setSignals] = useState(new Set());
  const [risk, setRisk] = useState({ score: 0, level: 0 });
  const [alert, setAlert] = useState(null);
  const [ended, setEnded] = useState(null);
  const [fonOk, setFonOk] = useState(false);
  const [fonAlerts, setFonAlerts] = useState(true);
  const [fonLine, setFonLine] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [mute, setMute] = useState(false);
  const recRef = useRef(null); const runRef = useRef(0); const sigRef = useRef(new Set()); const callRef = useRef(null); const alertedRef = useRef(-1);
  const [incidents, setIncidents] = useState(() => load("nukun.incidents", []));
  useEffect(() => { fonHealth().then((h) => setFonOk(!!h?.ok)); return () => { runRef.current++; recRef.current?.stop(); speechSynthesis.cancel(); }; }, []);

  const ev = (text, tone = "info") => setEvents((e) => [...e, { t: now(), text, tone }]);

  function start(number, name) {
    runRef.current++; recRef.current?.stop(); setListening(false); speechSynthesis.cancel();
    const reg = verifyCaller(number);
    const c = { number, name: reg ? reg.name : name || "Numéro inconnu", verified: !!reg };
    callRef.current = c; sigRef.current = new Set(); alertedRef.current = -1;
    setCall(c); setLines([]); setSignals(new Set()); setRisk({ score: 0, level: 0 }); setAlert(null); setEnded(null);
    setEvents([{ t: now(), text: `Appel entrant : ${number}`, tone: "info" }, { t: now(), text: reg ? `Numéro retrouvé dans le registre officiel : ${reg.name}` : "Numéro absent du registre officiel : identité non vérifiée", tone: reg ? "ok" : "warn" }]);
    return c;
  }

  async function ingest(text, extra = {}) {
    const c = callRef.current; if (!c) return;
    const sig = analyzeUtterance(extra.fr || text);
    sig.forEach((s) => sigRef.current.add(s));
    const r = scoreCall(sigRef.current, c.verified);
    setLines((l) => [...l, { who: "caller", text, ...extra, signals: sig, t: now() }]);
    setSignals(new Set(sigRef.current)); setRisk(r);
    sig.filter((s) => s !== "prevention").forEach((s) => ev(SIGNAL_LABEL[s], s === "code" || s === "money" ? "bad" : "warn"));
    if (sig.includes("prevention")) ev("Phrase de prévention reconnue : ce n'est pas une demande de code", "ok");
    if (r.level >= 2 && r.level > alertedRef.current) {
      alertedRef.current = r.level;
      ev(`Niveau de risque : ${LEVELS[r.level].name}`, "bad");
      setAlert(r.level);
      const msg = ALERT_FR[r.level];
      if (!mute) {
        speak(msg); await wait(400 + msg.length * 55);
        if (fonAlerts && fonOk) { try { await sayInFon(msg); } catch { /* voix fon indisponible */ } }
      }
    }
  }

  async function playScenario(sc) {
    start(sc.number, sc.name);
    const id = ++runRef.current;
    await wait(1200);
    for (const l of sc.lines) {
      if (runRef.current !== id) return;
      setBusy(true);
      if (!mute) await callerVoice(l); else await wait(1500);
      if (runRef.current !== id) return;
      await ingest(l);
      setBusy(false);
      await wait(alertedRef.current >= 2 ? 2500 : 900);
    }
    setBusy(false);
  }

  function listenLive() {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    if (!callRef.current) start("+229 01 00 00 00 00", "Appel en haut-parleur");
    const r = getRecognizer("fr-FR"); if (!r) { ev("Reconnaissance vocale indisponible : utilisez Chrome ou Edge", "warn"); return; }
    r.continuous = true; r.interimResults = false;
    r.onresult = (e) => { const res = e.results[e.results.length - 1]; if (res.isFinal) ingest(res[0].transcript.trim()); };
    r.onend = () => setListening(false);
    recRef.current = r; r.start(); setListening(true); ev("Écoute de l'appel en haut-parleur (français)", "info");
  }

  async function addFon(e) {
    e.preventDefault(); const t = fonLine.trim(); if (!t) return;
    if (!callRef.current) start("+229 01 00 00 00 00", "Appel en fon");
    setBusy(true);
    try { const { text: fr } = await translate(t, "fon", "fr"); setFonLine(""); await ingest(t, { fr, lang: "fon" }); }
    catch { ev("Traduction du fon indisponible : lancez le service fon", "warn"); }
    setBusy(false);
  }

  function hangup(reason) {
    runRef.current++; recRef.current?.stop(); setListening(false); speechSynthesis.cancel();
    const c = callRef.current; if (!c) return;
    const inc = { id: Date.now(), at: new Date().toISOString(), number: c.number, name: c.name, verified: c.verified, level: risk.level, signals: [...sigRef.current], outcome: reason };
    if (risk.level >= 1 || reason === "raccroché") { const list = [inc, ...incidents].slice(0, 30); setIncidents(list); save("nukun.incidents", list); logEvent(risk.level >= 2 ? "call_blocked" : "call", { number: c.number, level: risk.level }); }
    ev(reason === "raccroché" ? "Appel terminé par l'utilisateur" : "Appel terminé", reason === "raccroché" ? "ok" : "info");
    setEnded(reason); setAlert(null); callRef.current = null;
    if (reason === "raccroché" && risk.level >= 2) speak("Appel terminé. Vous avez gardé votre code et votre argent.");
  }

  const L = LEVELS[risk.level];
  const tone = { info: "text-muted", ok: "text-good", warn: "text-caution", bad: "text-bad" };

  return (
    <div className="space-y-6">
      {/* Choix de l'appel */}
      <div className="grid gap-4 md:grid-cols-3">
        {SCENARIOS.map((sc) => (
          <button key={sc.id} onClick={() => playScenario(sc)} className="card p-5 text-left transition hover:-translate-y-0.5">
            <div className="flex items-center justify-between"><span className="text-2xl">{sc.id === "real" ? "✅" : "📞"}</span><span className={`chip ${sc.id === "real" ? "text-good" : "text-caution"}`}>{sc.sub}</span></div>
            <div className="mt-3 font-display text-lg font-bold">{sc.title}</div>
            <div className="text-sm text-muted">{sc.number}</div>
            <div className="mt-3 text-sm font-semibold text-accent">▶ Simuler l'appel</div>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Téléphone */}
        <div className="card relative mx-auto w-full max-w-[400px] overflow-hidden p-0">
          <div className={`relative p-6 text-center ${call ? (risk.level >= 3 ? "bg-gradient-to-b from-red-600/40 to-transparent" : risk.level >= 2 ? "bg-gradient-to-b from-orange-500/30 to-transparent" : "bg-gradient-to-b from-sky-500/20 to-transparent") : ""}`}>
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted"><span className="h-2 w-2 rounded-full bg-safe shadow-[0_0_8px_#22c55e]" />Protection NUKÚN active</div>
            {call ? (
              <>
                <div className={`relative mx-auto mt-5 grid h-24 w-24 place-items-center rounded-full text-4xl ${ended ? "bg-fg/10" : "bg-fg/10"}`}>
                  {!ended && <span className="pulse-ring absolute inset-0 rounded-full" style={{ background: L.color, opacity: 0.35 }} />}
                  <span className="relative">{call.verified ? "🏢" : "👤"}</span>
                </div>
                <div className="mt-4 font-display text-2xl font-bold">{call.number}</div>
                <div className="text-sm text-muted">{call.name}</div>
                <div className={`mx-auto mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${call.verified ? "bg-safe/15 text-good" : "bg-warn/15 text-caution"}`}>{call.verified ? "✓ Numéro officiel vérifié" : "⚠ Identité non vérifiée"}</div>
                <div className="mt-2 text-xs text-subtle">{ended ? "Appel terminé" : busy ? "L'appelant parle…" : listening ? "Écoute en cours…" : "En communication"}</div>
              </>
            ) : (
              <div className="py-10"><div className="text-5xl">📱</div><div className="mt-4 font-semibold">Aucun appel en cours</div><p className="mt-1 text-sm text-muted">Simulez un appel ci-dessus, ou écoutez un vrai appel en haut-parleur.</p></div>
            )}
          </div>
          <div className="space-y-3 p-5">
            {call && !ended && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => hangup("raccroché")} className="btn-danger rounded-2xl py-3">📵 Raccrocher</button>
                <button onClick={() => hangup("terminé")} className="btn-ghost rounded-2xl py-3">Terminer</button>
              </div>
            )}
            <button onClick={listenLive} className={`btn w-full rounded-2xl py-3 ${listening ? "bg-danger text-white" : "btn-gold"}`}>{listening ? "■ Arrêter l'écoute" : "🎙️ Écouter un vrai appel (haut-parleur)"}</button>
            <form onSubmit={addFon} className="flex gap-2">
              <input className="input" value={fonLine} onChange={(e) => setFonLine(e.target.value)} placeholder="Phrase entendue en fɔngbè…" disabled={!fonOk} />
              <button disabled={!fonOk || busy} className="btn-ghost shrink-0">Analyser</button>
            </form>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <label className="flex items-center gap-2"><input type="checkbox" checked={fonAlerts} onChange={(e) => setFonAlerts(e.target.checked)} disabled={!fonOk} />Alertes aussi en fɔngbè {fonOk ? "" : "(service fon éteint)"}</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} />Sans son</label>
            </div>
          </div>
        </div>

        {/* Analyse */}
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between"><div className="kicker">Niveau de risque</div><div className="text-xs text-muted">{L.action}</div></div>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div className="font-display text-4xl font-extrabold" style={{ color: L.color }}>{call ? L.name : "—"}</div>
              <div className="text-right text-sm text-muted">{call ? L.desc : "En attente d'un appel"}</div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-1.5">{LEVELS.map((lv, i) => <div key={i} className="h-2.5 rounded-full transition-all duration-500" style={{ background: call && i <= risk.level ? lv.color : "rgb(var(--fg) / .1)" }} />)}</div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {[["verified", call?.verified ? "Numéro officiel vérifié" : "Numéro non vérifié", call ? (call.verified ? "ok" : "warn") : "off"], ...["identity", "code", "money", "pressure"].map((k) => [k, k === "identity" && call?.verified && signals.has(k) ? "Opérateur confirmé par le registre" : SIGNAL_LABEL[k], signals.has(k) ? (k === "identity" && call?.verified ? "ok" : k === "code" || k === "money" ? "bad" : "warn") : "off"])].map(([k, l, st]) => (
                <div key={k} className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm ${st === "off" ? "bg-fg/5 text-subtle" : st === "ok" ? "bg-safe/10 text-good" : st === "warn" ? "bg-warn/10 text-caution" : "bg-danger/10 text-bad"}`}>
                  <span>{st === "off" ? "○" : st === "ok" ? "✓" : "●"}</span>{l}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="card p-6">
              <div className="kicker">Ce qui est dit</div>
              <div className="mt-4 max-h-[340px] space-y-3 overflow-auto pr-1">
                {lines.length === 0 && <p className="text-sm text-muted">La transcription de l'appel s'affiche ici.</p>}
                {lines.map((l, i) => (
                  <div key={i} className="fadein rounded-2xl bg-fg/5 p-3">
                    <div className="text-xs text-subtle">{l.t} · appelant{l.lang === "fon" ? " · fɔngbè" : ""}</div>
                    <div className="mt-1 text-sm">« {l.text} »</div>
                    {l.fr && <div className="mt-1 text-xs italic text-muted">Traduit : « {l.fr} »</div>}
                    {l.signals.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{l.signals.map((s) => <span key={s} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s === "prevention" || (s === "identity" && call?.verified) ? "bg-safe/15 text-good" : s === "code" || s === "money" ? "bg-danger/15 text-bad" : "bg-warn/15 text-caution"}`}>{s === "identity" && call?.verified ? "Opérateur confirmé" : SIGNAL_LABEL[s]}</span>)}</div>}
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-6">
              <div className="kicker">Chronologie</div>
              <ul className="mt-4 max-h-[340px] space-y-2 overflow-auto text-sm">
                {events.length === 0 && <li className="text-muted">Les étapes de l'analyse s'affichent ici.</li>}
                {events.map((e, i) => <li key={i} className="fadein flex gap-3"><span className="shrink-0 font-mono text-xs text-subtle">{e.t}</span><span className={tone[e.tone]}>{e.text}</span></li>)}
              </ul>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between"><div className="kicker">Journal des incidents</div><span className="text-xs text-subtle">{incidents.length} incident{incidents.length > 1 ? "s" : ""}</span></div>
            {incidents.length === 0 ? <p className="mt-3 text-sm text-muted">Aucun incident enregistré.</p> : (
              <ul className="mt-3 space-y-2 text-sm">{incidents.slice(0, 5).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3"><span className="h-2.5 w-2.5 rounded-full" style={{ background: LEVELS[i.level].color }} /><span className="font-semibold">{i.number}</span><span className="text-muted">{LEVELS[i.level].name} · {i.outcome}</span><span className="ml-auto text-xs text-subtle">{new Date(i.at).toLocaleString("fr-FR")}</span></li>
              ))}</ul>
            )}
          </div>
        </div>
      </div>

      {/* Alerte */}
      {alert !== null && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setAlert(null)}>
          <div className={`fadein w-full max-w-lg rounded-[32px] border p-8 shadow-2xl ${alert >= 3 ? "border-red-400/60 bg-gradient-to-b from-red-950/95 to-[#1a0b10]/95" : "border-orange-400/60 bg-gradient-to-b from-orange-950/95 to-[#1a120b]/95"} text-white`} onClick={(e) => e.stopPropagation()}>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-red-200">NUKÚN-CALL GUARD · alerte {LEVELS[alert].name.toLowerCase()}</div>
            <div className="mt-3 font-display text-3xl font-extrabold">⚠️ Attention : identité non vérifiée</div>
            <p className="mt-3 text-red-100">Cet interlocuteur {signals.has("identity") ? "prétend représenter un opérateur Mobile Money et " : ""}{signals.has("code") ? "demande un code confidentiel" : signals.has("money") ? "vous demande d'envoyer de l'argent" : "présente des signes d'arnaque"}.</p>
            <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm"><b>Ne communiquez aucun code PIN ou code de validation.</b><br />N'envoyez pas d'argent. Vérifiez en appelant vous-même le service officiel.</div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button onClick={() => hangup("raccroché")} className="btn rounded-2xl bg-white py-3 text-red-700 hover:bg-red-50">📵 Raccrocher</button>
              <button onClick={() => { setAlert(null); ev(`Service officiel proposé : ${REGISTRY[0].name} ${REGISTRY[0].number}`, "ok"); }} className="btn rounded-2xl border border-white/30 py-3 text-white hover:bg-white/10">📞 Service officiel</button>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs">
              <button onClick={() => speak(ALERT_FR[alert])} className="underline opacity-80">🔊 Réécouter en français</button>
              {fonOk && <button onClick={() => sayInFon(ALERT_FR[alert]).catch(() => {})} className="underline opacity-80">🔊 Écouter en fɔngbè</button>}
              <button onClick={() => setAlert(null)} className="underline opacity-60">Continuer l'appel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
