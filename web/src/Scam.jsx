import { useState } from "react";
import { MicButton, useVoice } from "./Wallet.jsx";
import { logEvent, speak } from "./lib.js";
import { analyzeMessage } from "./nlp.js";

// Analyseur de messages suspects : règles transparentes (prototype), chaque indice est expliqué.
const EXAMPLES = [
  "Bonjour, c'est le service client MTN. Un dépôt de 25 000 F a été fait par erreur sur votre compte, renvoyez-le vite au 0197XXXXXX sinon votre compte sera bloqué.",
  "INVEST PLUS : investissez 15 000 F aujourd'hui et récupérez 60 000 F en 48h, rendement garanti. Rejoignez notre groupe WhatsApp.",
  "Prêt immédiat sans garantie jusqu'à 500 000 F. Payez seulement 5 000 F de frais de déblocage par MoMo pour recevoir votre crédit.",
  "Bonjour maman, je passe récupérer les pagnes demain matin, je t'envoie l'argent ce soir.",
];

export default function Scam() {
  const [text, setText] = useState("");
  const [res, setRes] = useState(null);
  const voice = useVoice((t) => { setText(t); run(t); });

  function run(t = text) {
    const { hits, level } = analyzeMessage(t);
    setRes({ hits, level });
    logEvent("message", { level, why: hits[0]?.why || "" });
    if (level === "high") speak("Attention, ce message ressemble fortement à une arnaque. " + hits[0].tip);
    else if (level === "mid") speak("Prudence. Ce message contient des signes suspects.");
    else speak("Je ne vois pas de signe d'arnaque connu dans ce message. Restez prudent.");
  }

  const box = { high: "border-danger/50 bg-danger/15 text-bad", mid: "border-warn/50 bg-warn/10 text-caution", low: "border-safe/40 bg-safe/10 text-good" };
  const title = { high: "Arnaque très probable", mid: "Message suspect : prudence", low: "Aucun signe d'arnaque connu" };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card space-y-4 p-6">
        <p className="text-fg/80">Collez un SMS, un message WhatsApp, ou dictez le contenu d'une note vocale reçue. NUKÚN repère les indices d'arnaque et explique quoi faire.</p>
        <div className="flex items-start gap-3">
          <MicButton voice={voice} />
          <textarea className="input min-h-[140px]" value={voice.listening ? voice.interim : text} onChange={(e) => setText(e.target.value)} placeholder="Collez ici le message suspect…" />
        </div>
        <button onClick={() => run()} disabled={!text.trim()} className="btn-gold w-full">Analyser le message</button>
        <div>
          <div className="mb-2 text-xs text-muted">Exemples à tester</div>
          <div className="space-y-2">
            {EXAMPLES.map((e, i) => <button key={i} onClick={() => { setText(e); run(e); }} className="block w-full rounded-2xl bg-fg/5 p-2.5 text-left text-xs text-fg/80 hover:bg-fg/10">{e}</button>)}
          </div>
        </div>
      </div>
      <div className="card p-6">
        <div className="kicker">Analyse</div>
        {!res ? <p className="mt-4 text-muted">Le résultat s'affichera ici.</p> : (
          <div className="fadein mt-4 space-y-4">
            <div className={`rounded-2xl border p-4 ${box[res.level]}`}><div className="font-display text-xl font-bold">{title[res.level]}</div><div className="text-sm opacity-90">{res.hits.length} indice{res.hits.length > 1 ? "s" : ""} repéré{res.hits.length > 1 ? "s" : ""}</div></div>
            {res.hits.map((h, i) => (
              <div key={i} className="rounded-2xl bg-fg/5 p-4">
                <div className="font-semibold text-fg">🔎 {h.why}</div>
                <div className="mt-1 text-sm text-fg/80">👉 {h.tip}</div>
              </div>
            ))}
            {res.level !== "low" && <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm text-accent">Si un transfert vous est demandé, NUKÚN vérifiera aussi le compte destinataire avant que l'argent parte .</div>}
          </div>
        )}
      </div>
    </div>
  );
}
