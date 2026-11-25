import { useState } from "react";
import { MicButton, useVoice } from "./Wallet.jsx";
import { parseLedgerEntry, parseAmount } from "./nlp.js";
import { fmt, load, logEvent, save, speak } from "./lib.js";
import { translate } from "./fonapi.js";

// « Racontez votre journée » : la commerçante parle (français) ou écrit (fon),
// l'écriture est relue, puis ajoutée au cahier et au solde.
const EFFECT = { vente: 1, remboursement: 1, "dépense": -1, dette: 0 };

function profitOf(text) {
  const m = text.match(/b[ée]n[ée]fice[^0-9a-z]{0,6}(?:de\s+)?([0-9][0-9\s.]*\s*(?:f|fcfa|francs?)?|[a-zé\s-]+mille)/i)
    || text.match(/([0-9][0-9\s.]*)\s*(?:f|fcfa|francs?)?\s*de\s+b[ée]n[ée]fice/i);
  return m ? parseAmount(m[1]) : null;
}

export default function QuickEntry({ onSaved }) {
  const [lang, setLang] = useState("fr");
  const [text, setText] = useState("");
  const [prop, setProp] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const voice = useVoice((t) => { setText(t); understand(t); });

  async function understand(raw = text) {
    setMsg(null); setProp(null);
    if (!raw.trim()) return;
    let fr = raw;
    if (lang === "fon") {
      setBusy(true);
      try { fr = (await translate(raw, "fon", "fr")).text; }
      catch { setBusy(false); setMsg({ kind: "warn", text: "La traduction du fon n'est pas disponible pour le moment. Dites-le en français." }); return; }
      setBusy(false);
    }
    const e = parseLedgerEntry(fr);
    if (!e.type || !e.amount) {
      const heard = lang === "fon" ? `J'ai compris : « ${fr} ». ` : "";
      setMsg({ kind: "warn", text: heard + (e.type && !e.amount ? "Il manque le montant : à combien ?" : lang === "fon" ? "Je n'ai pas trouvé de vente ni d'achat." : "Je n'ai pas compris. Exemple : « Aujourd'hui j'ai vendu 10 tomates à 1 000 F, j'ai 500 de bénéfice ».") });
      return;
    }
    const p = { ...e, raw, fr, profit: profitOf(fr) };
    setProp(p);
    const what = [p.quantity, p.item].filter(Boolean).join(" ");
    speak(`J'ai compris : ${p.type}${what ? " de " + what : ""}, ${new Intl.NumberFormat("fr-FR").format(p.amount)} francs${p.profit ? ", bénéfice " + new Intl.NumberFormat("fr-FR").format(p.profit) + " francs" : ""}. C'est bon ?`);
  }

  function confirm() {
    const entries = load("akwe.entries2", []);
    entries.unshift({ id: "q" + Date.now(), type: prop.type, amount: prop.amount, channel: prop.channel, item: prop.item, quantity: prop.quantity, who: prop.who, profit: prop.profit, status: "confirmée", at: Date.now() });
    save("akwe.entries2", entries);
    const delta = (EFFECT[prop.type] ?? 0) * prop.amount;
    const bal = load("nukun.balance", 100000) + delta;
    save("nukun.balance", bal);
    logEvent("ledger", { kind: prop.type, amount: prop.amount });
    const m = `C'est noté.${delta ? ` Votre solde passe à ${fmt(bal)}.` : ""}`;
    setMsg({ kind: "ok", text: m }); speak(m);
    setProp(null); setText(""); onSaved?.();
  }

  const label = prop ? [prop.quantity, prop.item].filter(Boolean).join(" ") || prop.who || "-" : "";
  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><div className="font-display text-xl font-bold">Racontez votre journée</div><div className="text-sm text-muted">Vos ventes et vos achats s'ajoutent à votre cahier et à votre solde.</div></div>
        <div className="glass flex rounded-full p-1 text-sm">
          {[["fr", "Français"], ["fon", "Fɔngbè"]].map(([k, l]) => <button key={k} onClick={() => { setLang(k); setProp(null); setMsg(null); }} className={`rounded-full px-4 py-1.5 ${lang === k ? "bg-gradient-to-b from-[#ffd76a] to-[#f2b52c] font-semibold text-ink-950" : "text-muted"}`}>{l}</button>)}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        {lang === "fr" && <MicButton voice={voice} />}
        <form onSubmit={(e) => { e.preventDefault(); understand(); }} className="flex flex-1 gap-2">
          <input className="input" value={voice.listening ? voice.interim : text} onChange={(e) => setText(e.target.value)} placeholder={lang === "fr" ? "Aujourd'hui j'ai vendu 10 tomates à 1 000 F, j'ai 500 de bénéfice" : "Écrivez en fɔngbè : ce que vous avez vendu ou acheté"} />
          <button disabled={busy} className="btn-gold shrink-0">{busy ? "Traduction…" : "Noter"}</button>
        </form>
      </div>
      {voice.listening && <div className="mt-2 text-sm text-accent">J'écoute… parlez en français</div>}
      {msg && <div className={`fadein mt-4 rounded-2xl p-3 text-sm ${msg.kind === "ok" ? "bg-safe/15 text-good" : "bg-warn/15 text-caution"}`}>{msg.text}</div>}
      {prop && (
        <div className="fadein mt-4 rounded-2xl border border-accent/40 bg-accent/5 p-4">
          {lang === "fon" && <div className="mb-2 text-xs text-muted">Traduit du fɔngbè : « {prop.fr} »</div>}
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><span className="text-muted">Opération</span><br /><b className="capitalize">{prop.type}</b></div>
            <div><span className="text-muted">Détail</span><br /><b>{label}</b></div>
            <div><span className="text-muted">Montant</span><br /><b>{fmt(prop.amount)}</b></div>
            <div><span className="text-muted">{prop.profit ? "Bénéfice" : "Solde"}</span><br /><b className={prop.profit ? "text-good" : ""}>{prop.profit ? fmt(prop.profit) : (EFFECT[prop.type] > 0 ? "+" : EFFECT[prop.type] < 0 ? "−" : "") + (EFFECT[prop.type] ? fmt(prop.amount) : "inchangé")}</b></div>
          </div>
          <div className="mt-3 flex gap-2"><button onClick={() => setProp(null)} className="btn-ghost flex-1">Corriger</button><button onClick={confirm} className="btn-gold flex-1">C'est bon, j'enregistre</button></div>
        </div>
      )}
    </div>
  );
}
