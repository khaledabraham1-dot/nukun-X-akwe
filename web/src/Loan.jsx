import { useEffect, useMemo, useState } from "react";
import { MicButton, useVoice } from "./Wallet.jsx";
import { parseAmount } from "./nlp.js";
import { fmt, load, logEvent, pct, save, speak } from "./lib.js";
import { fonHealth, sayInFon } from "./fonapi.js";
import { getUser, upsertLoan } from "./auth.js";
import { downloadReport } from "./report.js";

const MAX = 200000; // plafond aligné sur les montants du microcrédit public

function passport() {
  const e = load("akwe.entries2", []).filter((x) => x.status === "confirmée");
  const week = Date.now() - 7 * 86400e3;
  const w = e.filter((x) => x.at >= week);
  const sales = w.filter((x) => x.type === "vente");
  const total = sales.reduce((s, x) => s + x.amount, 0);
  const momo = sales.filter((x) => x.channel === "mobile money").length;
  const days = new Set(sales.map((x) => new Date(x.at).toDateString())).size;
  const traceable = sales.length ? momo / sales.length : 0;
  const monthly = total * (30 / 7);
  const indicative = Math.min(MAX, Math.floor((monthly * 0.25 * (0.5 + 0.5 * traceable)) / 5000) * 5000);
  return { count: e.length, total, monthly, days, traceable, indicative };
}

const STEPS = [
  { id: "amount", q: (p) => `Combien voulez-vous emprunter ? ${p.indicative ? `Selon votre cahier, nous conseillons jusqu'à ${new Intl.NumberFormat("fr-FR").format(p.indicative)} francs.` : ""}`, chips: (p) => [p.indicative && `${p.indicative}`, "25000", "50000", "100000"].filter(Boolean) },
  { id: "purpose", q: () => "Pour quoi faire ?", chips: () => ["Acheter du stock", "Acheter un équipement", "Payer le transport", "Agrandir mon étal"] },
  { id: "weeks", q: () => "En combien de temps voulez-vous rembourser ?", chips: () => ["4 semaines", "8 semaines", "12 semaines", "6 mois"] },
  { id: "guarantee", q: () => "Qui se porte garant ? Un groupe de caution solidaire, ou deux garants ?", chips: () => ["Groupe de caution solidaire", "Deux garants"] },
  { id: "cip", q: () => "Enfin, quel est le numéro de votre carte CIP ?", chips: () => [] },
];

function parseWeeks(t) {
  const n = parseAmount(t.replace(/\b(semaines?|mois)\b/i, " $1")) || parseInt((t.match(/\d+/) || [])[0], 10);
  const words = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, huit: 8, dix: 10, douze: 12 };
  const w = Object.keys(words).find((k) => new RegExp(`\\b${k}\\b`, "i").test(t));
  const v = n || (w ? words[w] : null);
  if (!v) return null;
  return /mois/i.test(t) ? v * 4 : v;
}

export default function Loan() {
  const p = useMemo(passport, []);
  const [voiceLang, setVoiceLang] = useState("fr");
  const [fonOk, setFonOk] = useState(false);
  const [step, setStep] = useState(-1);
  const [ans, setAns] = useState({});
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [consent, setConsent] = useState(false);
  const [req, setReq] = useState(() => load("nukun.loan", null));
  useEffect(() => { const t = setInterval(() => setReq(load("nukun.loan", null)), 3000); return () => clearInterval(t); }, []);
  const [fonQ, setFonQ] = useState("");
  const voice = useVoice((t) => { setText(t); answer(t); });
  useEffect(() => { fonHealth().then((h) => setFonOk(!!h?.ok)); }, []);
  useEffect(() => { if (step >= 0 && step < STEPS.length) ask(step); }, [step]); // eslint-disable-line

  function ask(i) {
    const q = STEPS[i].q(p);
    setFonQ("");
    if (voiceLang === "fon" && fonOk) sayInFon(q).then(setFonQ).catch(() => speak(q)); else speak(q);
  }
  function answer(raw) {
    const t = (raw ?? text).trim(); if (!t) return;
    const s = STEPS[step]; setErr("");
    let v = t;
    if (s.id === "amount") {
      v = parseAmount(t);
      if (!v || v < 5000) { setErr("Je n'ai pas compris le montant. Dites par exemple « cinquante mille »."); speak("Je n'ai pas compris le montant."); return; }
      if (v > MAX) { setErr(`Le plafond est de ${fmt(MAX)}.`); speak(`Le plafond est de ${MAX} francs.`); return; }
    }
    if (s.id === "weeks") { v = parseWeeks(t); if (!v) { setErr("Dites par exemple « huit semaines » ou « trois mois »."); return; } }
    if (s.id === "guarantee") v = /garant/i.test(t) && /deux|2/i.test(t) ? "Deux garants" : "Groupe de caution solidaire";
    setAns((a) => ({ ...a, [s.id]: v })); setText("");
    setStep(step + 1);
    if (step + 1 === STEPS.length) speak("Merci. Vérifiez votre demande, puis envoyez-la.");
  }
  function submit() {
    const u = getUser() || {};
    const r = { ...ans, at: Date.now(), id: "PR-" + String(Date.now()).slice(-6), passport: p, status: "en_attente", merchant: { name: u.name, activity: u.activity, market: u.market, phone: u.phone } };
    save("nukun.loan", r); upsertLoan(r); setReq(r); logEvent("loan", { amount: r.amount });
    speak(`Votre demande de ${new Intl.NumberFormat("fr-FR").format(r.amount)} francs est envoyée. Vous aurez une réponse sous quarante-huit heures.`);
  }
  function restart() { save("nukun.loan", null); setReq(null); setAns({}); setStep(-1); setConsent(false); }

  const weekly = ans.amount && ans.weeks ? Math.ceil(ans.amount / ans.weeks / 50) * 50 : 0;

  if (req) {
    const elapsed = (Date.now() - req.at) / 3600e3;
    const decided = req.status && req.status !== "en_attente";
    const left = Math.max(0, 48 - elapsed);
    return (
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="card p-8">
          <div className="kicker">Demande {req.id}</div>
          <div className="mt-2 font-display text-4xl font-extrabold">{fmt(req.amount)}</div>
          <div className="text-muted">{req.purpose} · remboursement en {req.weeks} semaines · {req.guarantee}</div>
          <div className="mt-8 space-y-5">
            {[["Demande reçue", true, new Date(req.at).toLocaleString("fr-FR")], ["Passeport Akwɛ partagé", true, "Ventes, régularité, ventes traçables"], ["Vérification NUKÚN", true, "Aucune alerte sur votre compte"], ["Décision de l'institution", req.status && req.status !== "en_attente", req.status === "accordé" ? `Accordé par ${req.decidedBy || "l'institution"}` : req.status === "refusé" ? "Demande refusée" : "Réponse sous 48 h"], ["Versement sur votre MoMo", req.status === "accordé", req.status === "accordé" ? `${fmt(req.amount)} ajoutés à votre solde` : "Dès l'accord"]].map(([l, done, d], i) => (
              <div key={i} className="flex items-start gap-4">
                <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${done ? "bg-safe text-white" : "border-2 border-dashed border-fg/20 text-muted"}`}>{done ? "✓" : i + 1}</span>
                <div><div className="font-semibold">{l}</div><div className="text-sm text-muted">{d}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="card p-8 text-center">
            <div className="text-sm text-muted">{decided ? "Décision" : "Réponse attendue dans"}</div>
            <div className={`mt-2 font-display text-5xl font-extrabold ${req.status === "accordé" ? "text-good" : req.status === "refusé" ? "text-bad" : "text-accent"}`}>{req.status === "accordé" ? "Prêt accordé 🎉" : req.status === "refusé" ? "Refusé" : `${Math.floor(left)} h`}</div>
            <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-fg/10"><div className="h-full bg-gradient-to-r from-[#e8a317] to-[#ffd76a]" style={{ width: `${Math.min(100, (elapsed / 48) * 100)}%` }} /></div>
            <button onClick={() => speak(`Votre demande de ${new Intl.NumberFormat("fr-FR").format(req.amount)} francs est en cours d'étude. Réponse sous quarante-huit heures.`)} className="btn-ghost mt-6 rounded-full">🔊 Écouter où en est ma demande</button>
          </div>
          <button onClick={() => downloadReport(getUser())} className="btn-ghost w-full">📄 Télécharger mon rapport de chiffre d'affaires (PDF)</button>
          <button onClick={restart} className="btn-ghost w-full">Faire une nouvelle demande</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden p-0">
        <div className="relative bg-gradient-to-br from-[#f2b52c] via-[#ffd76a] to-[#ffe9a8] p-8 text-ink-950">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/40 blur-2xl" />
          <div className="relative grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] opacity-70">Prêt en 48 h · sur votre MoMo</div>
              <div className="mt-2 font-display text-4xl font-extrabold">Votre cahier parle pour vous.</div>
              <p className="mt-2 max-w-lg opacity-80">Demandez un microcrédit à la voix. Votre passeport Akwɛ remplace la paperasse : l'institution voit vos ventes, vous recevez une réponse sous 48 h.</p>
            </div>
            <div className="rounded-3xl bg-white/50 p-5 backdrop-blur">
              <div className="text-xs font-semibold opacity-70">Montant conseillé</div>
              <div className="font-display text-4xl font-extrabold">{p.indicative ? fmt(p.indicative) : "—"}</div>
              <div className="mt-1 text-xs opacity-70">{p.count ? `D'après ${p.count} écritures de votre cahier` : "Remplissez d'abord votre cahier Akwɛ"}</div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-3">
          <Mini label="Ventes estimées sur un mois" value={fmt(p.monthly)} />
          <Mini label="Jours de vente cette semaine" value={`${p.days} / 7`} />
          <Mini label="Ventes payées par MoMo" value={pct(p.traceable)} />
        </div>
      </div>

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-display text-xl font-bold">Faire ma demande avec l'assistant</div>
          <div className="glass flex rounded-full p-1 text-sm">
            {[["fr", "🔊 Français"], ["fon", "🔊 Fɔngbè"]].map(([k, l]) => <button key={k} disabled={k === "fon" && !fonOk} onClick={() => setVoiceLang(k)} className={`rounded-full px-4 py-1.5 disabled:opacity-40 ${voiceLang === k ? "bg-gradient-to-b from-[#ffd76a] to-[#f2b52c] font-semibold text-ink-950" : "text-muted"}`}>{l}</button>)}
          </div>
        </div>

        {step < 0 && (
          <div className="mt-6 flex flex-col items-center gap-4 py-6 text-center">
            <p className="max-w-md text-muted">L'assistant vous pose 5 questions, à l'oral. Répondez en parlant ou en touchant une réponse.</p>
            <button onClick={() => setStep(0)} disabled={!p.indicative} className="btn-gold rounded-full px-8 py-4 text-base">🎙️ Commencer ma demande</button>
            {!p.indicative && <p className="text-sm text-caution">Notez d'abord quelques ventes dans votre cahier : c'est lui qui prouve votre activité.</p>}
          </div>
        )}

        {step >= 0 && step < STEPS.length && (
          <div className="mt-6 space-y-5">
            <div className="flex gap-1.5">{STEPS.map((s, i) => <div key={s.id} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-fg/10"}`} />)}</div>
            <div className="flex items-start gap-4">
              <button onClick={() => ask(step)} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent/15 text-2xl" title="Réécouter">🔊</button>
              <div>
                <div className="font-display text-2xl font-bold">{STEPS[step].q(p)}</div>
                {voiceLang === "fon" && fonQ && <div className="mt-1 text-sm italic text-muted">Fɔngbè (traduction automatique) : {fonQ}</div>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">{STEPS[step].chips(p).map((c) => <button key={c} onClick={() => answer(c)} className="chip px-4 py-2 text-sm hover:border-accent/60">{/^\d+$/.test(c) ? fmt(+c) : c}</button>)}</div>
            <div className="flex items-center gap-3">
              <MicButton voice={voice} />
              <form onSubmit={(e) => { e.preventDefault(); answer(); }} className="flex flex-1 gap-2">
                <input className="input" value={voice.listening ? voice.interim : text} onChange={(e) => setText(e.target.value)} placeholder="Votre réponse…" />
                <button className="btn-gold shrink-0">OK</button>
              </form>
            </div>
            {err && <div className="text-sm text-caution">{err}</div>}
          </div>
        )}

        {step >= STEPS.length && (
          <div className="fadein mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Mini label="Montant demandé" value={fmt(ans.amount)} big />
              <Mini label="Pour" value={ans.purpose} />
              <Mini label="Durée" value={`${ans.weeks} semaines`} />
              <Mini label="Chaque semaine (hors frais)" value={fmt(weekly)} />
            </div>
            <div className="text-sm text-muted">Garantie : {ans.guarantee} · Carte CIP : {ans.cip} · Les frais et le taux sont fixés par l'institution qui accorde le prêt.</div>
            <label className="flex items-start gap-3 rounded-2xl bg-fg/5 p-4 text-sm"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />J'accepte de partager mon passeport Akwɛ (ventes et régularité) avec l'institution, uniquement pour cette demande.</label>
            <div className="flex gap-2"><button onClick={() => { setStep(0); setAns({}); }} className="btn-ghost flex-1">Recommencer</button><button disabled={!consent} onClick={submit} className="btn-gold flex-1">Envoyer ma demande</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

function Mini({ label, value, big }) {
  return <div className="rounded-2xl bg-fg/5 p-4"><div className="text-xs text-muted">{label}</div><div className={`font-display font-bold ${big ? "text-2xl text-accent" : "text-lg"}`}>{value}</div></div>;
}
