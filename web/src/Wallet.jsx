import { useEffect, useRef, useState } from "react";
import { CONTACTS, TH, engine, logEvent, explainFacts, fmt, getRecognizer, load, pct, save, scoreFor, speak } from "./lib.js";
import GraphView from "./GraphView.jsx";
import { fetchScore } from "./api.js";
import { parseTransfer } from "./nlp.js";
import { fonHealth, sayInFon } from "./fonapi.js";

const FEES = (a) => (a <= 5000 ? 50 : a <= 50000 ? Math.round(a * 0.01) : Math.round(a * 0.008));

function useVoice(onFinal) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef(null);
  const supported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const start = () => {
    const r = getRecognizer("fr-FR");
    if (!r) return;
    recRef.current = r;
    r.onresult = (e) => {
      let txt = "";
      for (const res of e.results) txt += res[0].transcript;
      setInterim(txt);
      if (e.results[e.results.length - 1].isFinal) onFinal(txt);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    setInterim(""); setListening(true); r.start();
  };
  const stop = () => recRef.current?.stop();
  return { listening, interim, start, stop, supported };
}

export function MicButton({ voice }) {
  if (!voice.supported) return <span className="chip">Micro non pris en charge : utilisez Chrome ou Edge</span>;
  return (
    <button onClick={voice.listening ? voice.stop : voice.start} className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-full ${voice.listening ? "bg-danger" : "bg-gold-400"} text-ink-950`} aria-label="Parler">
      {voice.listening && <span className="pulse-ring absolute inset-0 rounded-full bg-danger" />}
      <svg viewBox="0 0 24 24" className="relative h-5 w-5" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" /></svg>
    </button>
  );
}

export { useVoice };

export default function Wallet() {
  const [balance, setBalance] = useState(() => load("nukun.balance", 100000));
  const [history, setHistory] = useState(() => load("nukun.history", []));
  const [text, setText] = useState("");
  const [draft, setDraft] = useState(null); // {contact, amount}
  const [analysis, setAnalysis] = useState(null);
  const [ack, setAck] = useState(false);
  const [msg, setMsg] = useState(null);
  const [fonAudio, setFonAudio] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fonLive, setFonLive] = useState(false);
  const [fonText, setFonText] = useState("");
  const voice = useVoice((t) => { setText(t); interpret(t); });

  useEffect(() => save("nukun.balance", balance), [balance]);
  useEffect(() => { fonHealth().then((h) => setFonLive(!!h?.ok)); }, []);
  useEffect(() => save("nukun.history", history), [history]);
  // Alerte en fon : déposer l'enregistrement dans public/audio/alerte_fon.mp3 et lister le fichier dans public/audio/index.json
  useEffect(() => { fetch("/audio/index.json").then((r) => (r.ok ? r.json() : [])).then((l) => setFonAudio(Array.isArray(l) && l.includes("alerte_fon.mp3"))).catch(() => {}); }, []);

  function interpret(t) {
    setMsg(null); setAnalysis(null); setAck(false);
    const parsed = parseTransfer(t, CONTACTS);
    if (parsed.intent === "balance") { const m = `Votre solde est de ${fmt(balance)}.`; setMsg({ kind: "info", text: m }); speak(m); setDraft(null); return; }
    if (parsed.intent === "fees") {
      const last = history[0];
      const m = parsed.amount ? `Pour envoyer ${fmt(parsed.amount)}, les frais sont de ${fmt(FEES(parsed.amount))}.`
        : last ? `Pour votre dernier envoi de ${fmt(last.amount)}, les frais étaient de ${fmt(last.fee)}. Les frais sont de 50 F jusqu'à 5 000 F, puis 1 % jusqu'à 50 000 F.` : "Les frais sont de 50 F jusqu'à 5 000 F, puis 1 % jusqu'à 50 000 F, puis 0,8 %.";
      setMsg({ kind: "info", text: m }); speak(m); setDraft(null); return;
    }
    const amount = parsed.amount;
    const contact = parsed.contact;
    if (!amount || !contact) {
      setDraft({ contact, amount });
      setMsg({ kind: "warn", text: !amount && !contact ? "Je n'ai compris ni le montant ni le destinataire. Exemple : « Envoie 12 000 à Maman Adjoa »." : !amount ? "Quel montant voulez-vous envoyer ?" : "À qui voulez-vous envoyer cet argent ? Choisissez un contact." });
      return;
    }
    setDraft({ contact, amount });
  }

  async function analyse() {
    const { contact, amount } = draft;
    setBusy(true);
    const t0 = performance.now();
    const api = await fetchScore(contact.id, amount);
    let res;
    if (api) {
      const acc = { ...engine.accounts[contact.id], id: contact.id, facts: api.facts, in: api.neighborhood?.in || [], out: api.neighborhood?.out || [] };
      res = { acc, bucket: amount, s: api.scores, ms: api.ms, live: true, roundtrip: performance.now() - t0 };
    } else {
      const r = scoreFor(contact.id, amount);
      res = { ...r, ms: performance.now() - t0, live: false };
    }
    const risky = res.s.sage >= TH.sage_history;
    setAnalysis({ ...res, risky, simpleRisky: res.s.logistic >= TH.logistic_history });
    setBusy(false);
    if (risky) speak(`Attention. Le compte de ${contact.name} présente des signes d'arnaque. Si quelqu'un vous a appelé pour vous demander cet envoi, raccrochez. Personne de MTN ne vous demandera de renvoyer de l'argent ou votre code.`);
  }

  function confirm() {
    const { contact, amount } = draft;
    const fee = FEES(amount);
    if (amount + fee > balance) { setMsg({ kind: "warn", text: "Solde insuffisant pour cet envoi." }); return; }
    setBalance((b) => b - amount - fee);
    setHistory((h) => [{ id: Date.now(), to: contact.name, account: contact.id, amount, fee, risky: analysis.risky, at: new Date().toISOString() }, ...h].slice(0, 20));
    logEvent(analysis.risky ? "sent_despite_alert" : "sent", { to: contact.name, amount });
    const m = `C'est fait : ${fmt(amount)} envoyés à ${contact.name}. Frais : ${fmt(fee)}.`;
    setMsg({ kind: "ok", text: m }); speak(m);
    setDraft(null); setAnalysis(null); setAck(false); setText("");
  }
  function cancel(reason) { if (reason === "blocked" && draft?.contact) logEvent("blocked", { to: draft.contact.name, amount: draft.amount }); setMsg({ kind: reason === "blocked" ? "ok" : "info", text: reason === "blocked" ? "Envoi annulé. Votre argent est resté sur votre compte." : "Envoi annulé." }); setDraft(null); setAnalysis(null); setAck(false); }
  function reset() { setBalance(100000); setHistory([]); setDraft(null); setAnalysis(null); setMsg(null); setText(""); }

  const facts = analysis ? explainFacts(analysis.acc.facts) : [];

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      {/* Téléphone */}
      <div className="card relative mx-auto w-full max-w-[380px] overflow-hidden p-0">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#f2b52c] via-[#ffd76a] to-[#ffe9a8] p-6 text-ink-950"><div className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/40 blur-2xl" />
          <div className="flex items-center justify-between text-xs font-semibold"><span>Mon portefeuille</span><button onClick={reset} className="underline">Réinitialiser</button></div>
          <div className="mt-3 text-xs opacity-80">Solde disponible</div>
          <div className="font-display text-3xl font-extrabold">{fmt(balance)}</div>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <MicButton voice={voice} />
            <div className="text-sm text-fg/80">{voice.listening ? <span className="text-accent">J'écoute… {voice.interim}</span> : "Parlez ou écrivez : « Envoie 12 000 à Maman Adjoa », « Quel est mon solde ? », « Pourquoi ces frais ? »"}</div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); interpret(text); }} className="flex gap-2">
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Envoie 12 000 au service client MTN" />
            <button className="btn-gold">OK</button>
          </form>
          <div>
            <div className="mb-2 text-xs text-muted">Contacts</div>
            <div className="flex flex-wrap gap-2">
              {CONTACTS.map((c) => (
                <button key={c.id} onClick={() => { setDraft({ contact: c, amount: draft?.amount || 12000 }); setAnalysis(null); setAck(false); setMsg(null); }} className={`chip hover:border-accent/60 ${draft?.contact?.id === c.id ? "border-accent text-accent" : ""}`}>{c.name}</button>
              ))}
            </div>
          </div>
          {msg && <div className={`fadein rounded-2xl p-3 text-sm ${msg.kind === "ok" ? "bg-safe/15 text-good" : msg.kind === "warn" ? "bg-warn/15 text-caution" : "bg-fg/5 text-fg/80"}`}>{msg.text}</div>}
          {draft && (
            <div className="fadein rounded-2xl border border-fg/10 bg-fg/[0.04] p-4">
              <div className="text-xs text-muted">Transfert préparé, rien n'est encore envoyé</div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-fg">{draft.contact ? draft.contact.name : "Destinataire ?"}</div>
                  <div className="text-xs text-muted">{draft.contact?.role}</div>
                </div>
                <input type="number" min="100" step="100" value={draft.amount || ""} onChange={(e) => { setDraft({ ...draft, amount: +e.target.value || null }); setAnalysis(null); setAck(false); }} className="input !w-28 shrink-0 text-right" placeholder="Montant" />
              </div>
              {draft.amount > 0 && <div className="mt-2 text-xs text-muted">Frais : {fmt(FEES(draft.amount))}</div>}
              {!analysis && <button disabled={!draft.contact || !draft.amount || busy} onClick={analyse} className="btn-gold mt-3 w-full">{busy ? "Vérification…" : "Vérifier et envoyer"}</button>}
              {analysis && !analysis.risky && (
                <div className="mt-3 space-y-2">
                  <div className="rounded-2xl bg-safe/15 p-3 text-sm text-good">Aucun signe d'arnaque détecté sur ce compte.</div>
                  <div className="flex gap-2"><button onClick={() => cancel()} className="btn-ghost flex-1">Annuler</button><button onClick={confirm} className="btn-gold flex-1">Confirmer l'envoi</button></div>
                </div>
              )}
              {analysis && analysis.risky && (
                <div className="mt-3 space-y-3">
                  <div className="rounded-2xl border border-danger/50 bg-danger/15 p-3 text-sm text-bad">
                    <div className="font-bold text-bad">⚠ Envoi mis en pause</div>
                    Ce compte présente des signes d'arnaque. Si quelqu'un vous a appelé pour vous demander cet envoi, raccrochez : personne de MTN ne vous demandera de renvoyer de l'argent ou votre code.
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button onClick={() => speak("Attention. Ce compte présente des signes d'arnaque. Si quelqu'un vous a appelé pour vous demander cet envoi, raccrochez.")} className="chip">🔊 Réécouter en français</button>
                      {fonAudio && <button onClick={() => new Audio("/audio/alerte_fon.mp3").play()} className="chip">🔊 Écouter en fon</button>}
                      {fonLive && <button onClick={() => sayInFon("Attention, ce compte présente des signes d'arnaque. Ne renvoyez pas l'argent.").then(setFonText).catch(() => setFonText("Voix fon indisponible"))} className="chip border-accent/50 text-accent">🔊 Alerte en fon (IA)</button>}
                    </div>
                  </div>
                  {fonText && <div className="text-xs italic text-muted">Fon : {fonText}</div>}
                  <label className="flex items-start gap-2 text-xs text-fg/80"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />J'ai compris l'avertissement et je veux quand même envoyer.</label>
                  <div className="flex gap-2"><button onClick={() => cancel("blocked")} className="btn-gold flex-1">Ne pas envoyer</button><button disabled={!ack} onClick={confirm} className="btn-danger flex-1">Envoyer quand même</button></div>
                </div>
              )}
            </div>
          )}
          {history.length > 0 && (
            <div>
              <div className="mb-2 text-xs text-muted">Derniers envois</div>
              <ul className="space-y-1 text-sm">{history.slice(0, 4).map((h) => <li key={h.id} className="flex justify-between"><span>{h.to}{h.risky && <span className="ml-1 text-bad">⚠</span>}</span><span className="text-muted">−{fmt(h.amount + h.fee)}</span></li>)}</ul>
            </div>
          )}
        </div>
      </div>

      {/* Vérification, en mots simples */}
      <div className="card p-6">
        {!analysis ? (
          <div className="flex h-full flex-col justify-center gap-4 text-center">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent/10"><svg viewBox="0 0 24 24" className="h-10 w-10 text-accent" fill="currentColor"><path d="M12 2 3 6v6c0 5 3.8 9.7 9 10 5.2-.3 9-5 9-10V6l-9-4Zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.9-4.9 1.4 1.4-6.3 6.3Z" /></svg></div>
            <div className="font-display text-2xl font-bold">Vous êtes protégée</div>
            <p className="mx-auto max-w-md text-muted">Avant chaque envoi, NUKÚN vérifie la personne qui va recevoir votre argent. Si quelque chose ne va pas, on vous prévient avant que l'argent parte.</p>
          </div>
        ) : (
          <div className="fadein space-y-5">
            <div className={`rounded-3xl p-6 text-center ${analysis.risky ? "bg-danger/15" : "bg-safe/15"}`}>
              <div className="text-5xl">{analysis.risky ? "⚠️" : "✅"}</div>
              <div className={`mt-2 font-display text-2xl font-extrabold ${analysis.risky ? "text-bad" : "text-good"}`}>{analysis.risky ? "Attention : arnaque probable" : "Ce compte paraît sûr"}</div>
              <div className="mt-1 text-sm text-muted">{draft?.contact?.name}</div>
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold">{analysis.risky ? "Pourquoi on vous prévient" : "Ce que nous avons vérifié"}</div>
              <ul className="space-y-2 text-sm">
                {facts.filter((f) => (analysis.risky ? f.level !== "ok" : true)).slice(0, 4).map((f) => <li key={f.k} className="flex gap-2"><span className={f.level === "bad" ? "text-bad" : f.level === "watch" ? "text-caution" : "text-good"}>●</span>{f.txt}</li>)}
              </ul>
            </div>
            {analysis.risky && <div className="rounded-2xl bg-fg/5 p-4 text-sm"><b>Le bon réflexe :</b> raccrochez, et appelez vous-même le service client officiel de votre opérateur. Personne ne vous demandera de renvoyer de l'argent ou de donner votre code.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ title, sub, score, th, main }) {
  const risky = score >= th;
  return (
    <div className={`rounded-2xl border p-4 ${main ? "border-accent/40 bg-accent/5" : "border-fg/10 bg-fg/5"}`}>
      <div className="text-sm font-semibold text-fg">{title}</div>
      <div className="text-xs text-muted">{sub}</div>
      <div className="mt-3 flex items-end justify-between">
        <div className={`font-display text-3xl font-extrabold ${risky ? "text-bad" : "text-good"}`}>{pct(score)}</div>
        <span className={`chip ${risky ? "border-danger/50 text-bad" : "border-safe/50 text-good"}`}>{risky ? "Alerte" : "Pas d'alerte"}</span>
      </div>
      <div className="relative mt-3 h-2 rounded-full bg-fg/10">
        <div className={`h-2 rounded-full ${risky ? "bg-danger" : "bg-safe"}`} style={{ width: `${Math.max(3, score * 100)}%` }} />
        <div className="absolute -top-1 h-4 w-0.5 bg-white" style={{ left: `${th * 100}%` }} title="Seuil" />
      </div>
      <div className="mt-1 text-[11px] text-subtle">Seuil fixé sur la validation : {pct(th)}</div>
    </div>
  );
}
