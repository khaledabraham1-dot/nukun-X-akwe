import { useEffect, useState } from "react";
import { fmt, load } from "./lib.js";
import { fonHealth } from "./fonapi.js";
import QuickEntry from "./QuickEntry.jsx";
import { downloadReport } from "./report.js";

const LABEL = {
  sent: (e) => `Envoi de ${fmt(e.amount)} à ${e.to}`,
  sent_despite_alert: (e) => `Envoi malgré l'alerte : ${fmt(e.amount)} à ${e.to}`,
  blocked: (e) => `Arnaque évitée : ${fmt(e.amount)} vers ${e.to}`,
  message: (e) => (e.level === "low" ? "Message vérifié : rien de suspect" : `Message suspect : ${e.why}`),
  ledger: (e) => `Cahier : ${e.kind} de ${fmt(e.amount)}`,
  translation: (e) => `Traduction ${e.dir}`,
  loan: (e) => `Demande de prêt de ${fmt(e.amount)} envoyée`,
  loan_granted: (e) => `Prêt de ${fmt(e.amount)} accordé par ${e.by}`,
};
const DOT = { blocked: "bg-safe", sent: "bg-sky-400", sent_despite_alert: "bg-danger", message: "bg-warn", ledger: "bg-gold-400", translation: "bg-violet-400", loan: "bg-gold-500" };

export default function Dashboard({ go, user }) {
  const [api, setApi] = useState(null);
  const [fon, setFon] = useState(undefined);
  const [, setTick] = useState(0);
  const events = load("nukun.events", []);
  const balance = load("nukun.balance", 100000);
  const entries = (load("akwe.entries2", [])).filter((e) => e.status === "confirmée");
  const week = Date.now() - 7 * 86400e3;
  const sales = entries.filter((e) => e.type === "vente" && e.at >= week).reduce((s, e) => s + e.amount, 0);
  const blocked = events.filter((e) => e.type === "blocked");
  const saved = blocked.reduce((s, e) => s + (e.amount || 0), 0);
  const msgs = events.filter((e) => e.type === "message");
  const flagged = msgs.filter((e) => e.level !== "low").length;

  useEffect(() => {
    const t0 = performance.now();
    fetch("/api/health").then((r) => (r.ok ? r.json() : null)).then((j) => setApi(j ? { ...j, ms: performance.now() - t0 } : false)).catch(() => setApi(false));
    fonHealth().then(setFon);
  }, []);

  const Tile = ({ label, value, sub, tone = "", onClick }) => (
    <button onClick={onClick} className="card p-5 text-left transition hover:-translate-y-0.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-display text-3xl font-extrabold tracking-tight ${tone}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-subtle">{sub}</div>}
    </button>
  );

  return (
    <div className="space-y-6">
      <QuickEntry onSaved={() => setTick((x) => x + 1)} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Solde du portefeuille" value={fmt(balance)} sub="Disponible" onClick={() => go("wallet")} />
        <Tile label="Arnaques évitées" value={blocked.length} tone="text-good" sub={saved ? `${fmt(saved)} protégés` : "Aucune pour l'instant"} onClick={() => go("wallet")} />
        <Tile label="Messages vérifiés" value={msgs.length} sub={`${flagged} suspect${flagged > 1 ? "s" : ""}`} tone={flagged ? "text-caution" : ""} onClick={() => go("scam")} />
        <Tile label="Ventes de la semaine" value={fmt(sales)} tone="text-accent" sub="Mon cahier Akwɛ" onClick={() => go("akwe")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between"><div className="font-semibold">Activité récente</div><span className="text-xs text-subtle">{events.length} événements</span></div>
          {events.length === 0 ? (
            <p className="mt-6 text-sm text-muted">Rien encore. Essayez un transfert, un message suspect ou une dictée dans le cahier.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {events.slice(0, 9).map((e) => (
                <li key={e.id} className="flex items-start gap-3 text-sm">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[e.type] || "bg-subtle"}`} />
                  <span className="flex-1">{(LABEL[e.type] || (() => e.type))(e)}</span>
                  <span className="shrink-0 text-xs text-subtle">{new Date(e.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-6">
          <div className="card p-6">
            <div className="font-semibold">Actions rapides</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[["wallet", "Envoyer de l'argent"], ["loan", "Demander un prêt"], ["akwe", "Noter une vente"], ["scam", "Vérifier un message"]].map(([k, l]) => <button key={k} onClick={() => go(k)} className="btn-ghost justify-start rounded-2xl py-3">{l}</button>)}
              <button onClick={() => downloadReport(user)} className="btn-gold col-span-2 rounded-2xl py-3">📄 Rapport de chiffre d'affaires (PDF)</button>
            </div>
          </div>
          <div className="card flex items-center gap-4 p-6">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-safe/15 text-2xl">🛡️</span>
            <div><div className="font-semibold">Protection active</div><div className="text-sm text-muted">Chaque envoi est vérifié avant de partir.</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Status({ ok, label, detail }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`h-2.5 w-2.5 rounded-full ${ok === null ? "bg-subtle" : ok ? "bg-safe shadow-[0_0_8px_#22c55e]" : "bg-warn"}`} />
      <span className="flex-1">{label}</span><span className="text-xs text-subtle">{detail}</span>
    </li>
  );
}
