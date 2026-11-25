import { useEffect, useMemo, useState } from "react";
import { MicButton, useVoice } from "./Wallet.jsx";
import { fmt, load, logEvent, pct, save, speak } from "./lib.js";
import { parseLedgerEntry } from "./nlp.js";
import { downloadReport } from "./report.js";
import { getUser } from "./auth.js";
const label = (e) => [e.quantity, e.item].filter(Boolean).join(" ") || e.who || "";

export default function Akwe() {
  const [entries, setEntries] = useState(() => load("akwe.entries2", []));
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState(null);
  const [note, setNote] = useState(null);
  const voice = useVoice((t) => { setText(t); prepare(t); });
  useEffect(() => save("akwe.entries2", entries), [entries]);

  function prepare(t = text) {
    setNote(null);
    const p = parseLedgerEntry(t);
    if (!p.amount || !p.type) { setProposal(null); setNote(!p.amount ? "Je n'ai pas compris le montant. Exemple : « J'ai vendu 3 pagnes à 25 000 par MoMo »." : "Est-ce une vente, une dépense, une dette ou un remboursement ?"); return; }
    setProposal({ ...p, raw: t });
    speak(`J'ai noté : ${p.type}${label(p) ? ", " + label(p) : ""}${p.who && p.item ? ", " + p.who : ""}, ${new Intl.NumberFormat("fr-FR").format(p.amount)} francs, en ${p.channel}. C'est bon ?`);
  }
  function confirmEntry() {
    const id = "e" + Date.now();
    const e = { id, ...proposal, status: "confirmée", at: Date.now(), matched: null };
    // Rapprochement : une vente en mobile money attend un paiement du même montant (simulé à la réception)
    setEntries((x) => [e, ...x]);
    logEvent("ledger", { kind: e.type, amount: e.amount });
    setProposal(null); setText("");
    setNote("C'est noté dans votre cahier.");
  }
  function cancelEntry(id) { setEntries((x) => x.map((e) => (e.id === id ? { ...e, status: "annulée" } : e))); }
  function reset() { setEntries([]); setProposal(null); setNote(null); }

  const stats = useMemo(() => {
    const active = entries.filter((e) => e.status === "confirmée");
    const week = Date.now() - 7 * 86400e3;
    const w = active.filter((e) => e.at >= week);
    const sales = w.filter((e) => e.type === "vente").reduce((s, e) => s + e.amount, 0);
    const spend = w.filter((e) => e.type === "dépense").reduce((s, e) => s + e.amount, 0);
    const debts = Math.max(0, active.filter((e) => e.type === "dette").reduce((s, e) => s + e.amount, 0) - active.filter((e) => e.type === "remboursement").reduce((s, e) => s + e.amount, 0));
    const momo = w.filter((e) => e.type === "vente" && e.channel === "mobile money");
    const sold = w.filter((e) => e.type === "vente");
    const days = new Set(w.filter((e) => e.type === "vente").map((e) => new Date(e.at).toDateString())).size;
    const reliability = sold.length ? momo.length / sold.length : 0;
    // Règle transparente : 25 % des ventes mensuelles estimées, pondérées par la fiabilité, plafonnée
    const monthly = sales * (30 / 7);
    const indicative = Math.min(500000, Math.floor((monthly * 0.25 * (0.5 + 0.5 * reliability)) / 5000) * 5000);
    return { sales, spend, debts, profit: sales - spend, reliability, days, indicative, count: w.length };
  }, [entries]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="card space-y-4 p-6">
        <div className="flex items-center justify-between"><div><div className="kicker">Mon cahier</div><div className="text-xs text-muted">Dites ce que vous avez vendu, acheté ou prêté</div></div><button onClick={reset} className="text-xs text-muted underline">Tout effacer</button></div>
        <div className="flex items-center gap-3">
          <MicButton voice={voice} />
          <div className="text-sm text-fg/80">{voice.listening ? <span className="text-accent">J'écoute… {voice.interim}</span> : "Dictez : « J'ai vendu 3 pagnes à 25 000 par MoMo », « J'ai acheté du tissu pour 40 000 », « Afi me doit 7 000 », « Koffi m'a remboursé 5 000 »."}</div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); prepare(); }} className="flex gap-2"><input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="J'ai vendu 2 pagnes à 18 000 par MoMo" /><button className="btn-gold">Noter</button></form>
        {note && <div className="fadein rounded-2xl bg-fg/5 p-3 text-sm text-fg/80">{note}</div>}
        {proposal && (
          <div className="fadein rounded-2xl border border-accent/40 bg-accent/5 p-4">
            <div className="text-xs text-accent">Akwɛ relit l'écriture avant de l'enregistrer</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted">Type</span><br /><b className="capitalize text-fg">{proposal.type}</b></div>
              <div><span className="text-muted">Montant</span><br /><b className="text-fg">{fmt(proposal.amount)}</b></div>
              <div><span className="text-muted">Détail</span><br /><b className="text-fg">{[label(proposal), proposal.item && proposal.who].filter(Boolean).join(" · ") || "-"}</b></div>
              <div><span className="text-muted">Moyen</span><br /><b className="text-fg">{proposal.channel}</b></div>
            </div>
            <div className="mt-3 flex gap-2"><button onClick={() => setProposal(null)} className="btn-ghost flex-1">Corriger</button><button onClick={confirmEntry} className="btn-gold flex-1">C'est bon, j'enregistre</button></div>
          </div>
        )}
        <div className="max-h-[320px] overflow-auto rounded-2xl border border-fg/10">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-xs text-muted"><tr><th className="p-2 text-left">Opération</th><th className="p-2 text-right">Montant</th><th className="p-2 text-left">Payé par</th><th /></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className={`border-t border-fg/5 ${e.status === "annulée" ? "opacity-40 line-through" : ""}`}>
                  <td className="p-2"><span className="capitalize">{e.type}</span> <span className="text-subtle">{label(e)}{e.who && e.item ? " · " + e.who : ""}</span><div className="text-[11px] text-subtle">{new Date(e.at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · {e.channel}</div></td>
                  <td className={`p-2 text-right font-semibold ${e.type === "vente" ? "text-good" : e.type === "dépense" ? "text-bad" : e.type === "remboursement" ? "text-good" : "text-caution"}`}>{fmt(e.amount)}</td>
                  <td className="p-2 text-xs">{e.channel === "mobile money" ? <span className="text-good">MoMo</span> : <span className="text-subtle">espèces</span>}</td>
                  <td className="p-2 text-right">{e.status === "confirmée" && <button onClick={() => cancelEntry(e.id)} className="text-xs text-subtle hover:text-bad">annuler</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-6">
        <div className="card p-6">
          <div className="kicker">Synthèse des 7 derniers jours</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Ventes" value={fmt(stats.sales)} tone="text-good" />
            <Stat label="Dépenses" value={fmt(stats.spend)} tone="text-bad" />
            <Stat label="Bénéfice" value={fmt(stats.profit)} tone="text-fg" />
            <Stat label="On vous doit" value={fmt(stats.debts)} tone="text-caution" />
          </div>
          <button onClick={() => downloadReport(getUser())} className="btn-gold mt-4 w-full">📄 Rapport de chiffre d'affaires (PDF)</button>
          <button onClick={() => speak(`Cette semaine, vous avez vendu pour ${new Intl.NumberFormat("fr-FR").format(stats.sales)} francs et dépensé ${new Intl.NumberFormat("fr-FR").format(stats.spend)} francs. Votre bénéfice est de ${new Intl.NumberFormat("fr-FR").format(stats.profit)} francs.`)} className="btn-ghost mt-4 w-full">🔊 Écouter mon bilan</button>
        </div>
        <div className="card p-6 ring-1 ring-accent/30">
          <div className="kicker">Passeport de crédit</div>
          <p className="mt-1 text-xs text-muted">Vous le partagez seulement si vous le voulez. C'est la microfinance qui décide du prêt.</p>
          <div className="mt-4 flex items-end justify-between">
            <div><div className="text-xs text-muted">Montant indicatif</div><div className="font-display text-4xl font-extrabold text-accent">{fmt(stats.indicative)}</div></div>
            <div className="text-right text-xs text-muted">Remboursement conseillé<br /><b className="text-fg">les jours de marché</b></div>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm">
            <li className="flex justify-between"><span className="text-muted">Ventes estimées sur un mois</span><b>{fmt(stats.sales * 30 / 7)}</b></li>
            <li className="flex justify-between"><span className="text-muted">Jours de vente cette semaine</span><b>{stats.days} / 7</b></li>
            <li className="flex justify-between"><span className="text-muted">Ventes payées par MoMo (traçables)</span><b>{pct(stats.reliability)}</b></li>
            <li className="flex justify-between"><span className="text-muted">Signal NUKÚN du compte</span><b className="text-good">aucune alerte</b></li>
          </ul>
          <p className="mt-4 text-[11px] text-subtle">Comment c'est calculé : un quart de vos ventes du mois, plus élevé quand vos ventes sont payées par MoMo, jusqu'à 500 000 F.</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }) {
  return <div className="rounded-2xl bg-fg/5 p-3"><div className="text-xs text-muted">{label}</div><div className={`font-display text-xl font-bold ${tone}`}>{value}</div></div>;
}
