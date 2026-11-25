import { useState } from "react";
import { fmt, load, logEvent, pct, save, speak } from "./lib.js";
import { getLoans, upsertLoan } from "./auth.js";

const BADGE = { en_attente: ["En attente", "bg-warn/15 text-caution"], accordé: ["Accordé", "bg-safe/15 text-good"], refusé: ["Refusé", "bg-danger/15 text-bad"] };

export default function InstDashboard({ user }) {
  const [loans, setLoans] = useState(getLoans);
  const [open, setOpen] = useState(loans[0]?.id || null);
  const events = load("nukun.events", []);
  const blocked = events.filter((e) => e.type === "blocked");
  const pending = loans.filter((l) => (l.status || "en_attente") === "en_attente");
  const granted = loans.filter((l) => l.status === "accordé");

  function decide(l, status) {
    const n = { ...l, status, decidedAt: Date.now(), decidedBy: user.name };
    upsertLoan(n);
    if (status === "accordé") {
      save("nukun.balance", load("nukun.balance", 100000) + l.amount);
      logEvent("loan_granted", { amount: l.amount, by: user.name });
    }
    setLoans(getLoans());
    speak(status === "accordé" ? `Prêt de ${new Intl.NumberFormat("fr-FR").format(l.amount)} francs accordé.` : "Demande refusée.");
  }

  const Tile = ({ label, value, tone = "" }) => <div className="card p-5"><div className="text-xs text-muted">{label}</div><div className={`mt-1 font-display text-3xl font-extrabold ${tone}`}>{value}</div></div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Demandes reçues" value={loans.length} />
        <Tile label="À traiter" value={pending.length} tone={pending.length ? "text-caution" : ""} />
        <Tile label="Montant accordé" value={fmt(granted.reduce((s, l) => s + l.amount, 0))} tone="text-good" />
        <Tile label="Arnaques bloquées par NUKÚN" value={blocked.length} tone="text-accent" />
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between"><div className="font-display text-xl font-bold">Demandes de prêt</div><button onClick={() => setLoans(getLoans())} className="btn-ghost rounded-full">Actualiser</button></div>
        {loans.length === 0 ? (
          <p className="mt-6 text-muted">Aucune demande pour l'instant. Elles arrivent ici dès qu'une commerçante envoie sa demande depuis son espace.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {loans.map((l) => {
              const st = l.status || "en_attente"; const ps = l.passport || {};
              return (
                <div key={l.id} className="rounded-3xl border border-fg/10 bg-fg/[0.03]">
                  <button onClick={() => setOpen(open === l.id ? null : l.id)} className="flex w-full flex-wrap items-center gap-4 p-4 text-left">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-accent/15 font-bold text-accent">{(l.merchant?.name || "?").slice(0, 1)}</div>
                    <div className="min-w-0 flex-1"><div className="font-semibold">{l.merchant?.name || "Commerçante"} <span className="font-normal text-muted">· {l.merchant?.activity || ""}{l.merchant?.market ? ", " + l.merchant.market : ""}</span></div><div className="text-sm text-muted">{l.purpose} · {l.weeks} semaines · {new Date(l.at).toLocaleString("fr-FR")}</div></div>
                    <div className="font-display text-xl font-bold">{fmt(l.amount)}</div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${BADGE[st][1]}`}>{BADGE[st][0]}</span>
                  </button>
                  {open === l.id && (
                    <div className="fadein grid gap-4 border-t border-fg/10 p-5 md:grid-cols-[1.3fr_1fr]">
                      <div>
                        <div className="text-sm font-semibold">Passeport Akwɛ (partagé avec accord)</div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <Info k="Ventes estimées / mois" v={fmt(ps.monthly || 0)} />
                          <Info k="Montant conseillé" v={fmt(ps.indicative || 0)} />
                          <Info k="Jours de vente / semaine" v={`${ps.days || 0} / 7`} />
                          <Info k="Ventes payées par MoMo" v={pct(ps.traceable || 0)} />
                          <Info k="Écritures au cahier" v={ps.count || 0} />
                          <Info k="Échéance / semaine" v={fmt(Math.ceil(l.amount / l.weeks / 50) * 50)} />
                        </div>
                        <div className="mt-3 text-sm text-muted">Garantie : {l.guarantee} · CIP : {l.cip} · Tél. : {l.merchant?.phone || "-"}</div>
                        {l.amount > (ps.indicative || 0) && <div className="mt-2 text-sm text-caution">Montant supérieur au montant conseillé par le cahier.</div>}
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 rounded-2xl bg-safe/10 p-4 text-sm"><span className="text-xl">🛡️</span><div><b>Vérification NUKÚN</b><br /><span className="text-muted">Aucun signe de compte mule</span></div></div>
                        {st === "en_attente" ? (
                          <div className="flex gap-2"><button onClick={() => decide(l, "refusé")} className="btn-ghost flex-1">Refuser</button><button onClick={() => decide(l, "accordé")} className="btn-gold flex-1">Accorder le prêt</button></div>
                        ) : <div className="text-sm text-muted">Décision : <b className={st === "accordé" ? "text-good" : "text-bad"}>{BADGE[st][0]}</b> le {new Date(l.decidedAt).toLocaleString("fr-FR")}</div>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ k, v }) { return <div className="rounded-2xl bg-fg/5 p-3"><div className="text-xs text-muted">{k}</div><div className="font-semibold">{v}</div></div>; }
