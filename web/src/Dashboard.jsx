import { useEffect, useState } from "react";
import { fmt, load } from "./lib.js";
import { fonHealth } from "./fonapi.js";
import { LEVELS } from "./callguard.js";

const LABEL = {
  call_blocked: (e) => `Appel suspect interrompu : ${e.number}`,
  call: (e) => `Appel analysé : ${e.number}`,
  blocked: (e) => `Transfert bloqué : ${fmt(e.amount)} vers ${e.to}`,
  sent: (e) => `Transfert vérifié : ${fmt(e.amount)} à ${e.to}`,
  sent_despite_alert: (e) => `Envoi malgré l'alerte : ${fmt(e.amount)} à ${e.to}`,
  message: (e) => (e.level === "low" ? "Message vérifié : rien de suspect" : `Message suspect : ${e.why}`),
  translation: (e) => `Traduction ${e.dir}`,
};
const DOT = { call_blocked: "bg-danger", call: "bg-sky-400", blocked: "bg-safe", sent: "bg-sky-400", sent_despite_alert: "bg-danger", message: "bg-warn", translation: "bg-violet-400" };

export default function Dashboard({ go }) {
  const [fon, setFon] = useState(undefined);
  const events = load("nukun.events", []);
  const incidents = load("nukun.incidents", []);
  const blocked = events.filter((e) => e.type === "blocked");
  const saved = blocked.reduce((s, e) => s + (e.amount || 0), 0);
  const calls = incidents.filter((i) => i.level >= 2);
  const msgs = events.filter((e) => e.type === "message" && e.level !== "low");
  useEffect(() => { fonHealth().then(setFon); }, []);

  const Tile = ({ label, value, sub, tone = "", onClick }) => (
    <button onClick={onClick} className="card p-5 text-left transition hover:-translate-y-0.5">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-display text-3xl font-extrabold tracking-tight ${tone}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-subtle">{sub}</div>}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden p-0">
        <div className="relative grid items-center gap-6 bg-gradient-to-br from-[#0b1f3a] via-[#13284d] to-[#1d1446] p-8 text-white md:grid-cols-[1fr_auto]">
          <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full bg-[#f7c548]/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-green-300"><span className="h-2 w-2 rounded-full bg-safe shadow-[0_0_10px_#22c55e]" />Protection active</div>
            <div className="mt-2 font-display text-3xl font-extrabold">Vos appels et vos transferts sont surveillés.</div>
            <p className="mt-2 max-w-xl text-slate-300">NUKÚN vous prévient pendant un appel suspect, avant un transfert risqué, et dans votre langue.</p>
          </div>
          <button onClick={() => go("call")} className="btn-gold relative rounded-full px-6 py-3 text-base">📞 Tester Call Guard</button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Appels suspects interrompus" value={calls.length} tone={calls.length ? "text-good" : ""} sub="Call Guard" onClick={() => go("call")} />
        <Tile label="Transferts bloqués" value={blocked.length} tone={blocked.length ? "text-good" : ""} sub={saved ? `${fmt(saved)} protégés` : "Aucun pour l'instant"} onClick={() => go("wallet")} />
        <Tile label="Messages suspects repérés" value={msgs.length} tone={msgs.length ? "text-caution" : ""} sub="SMS, WhatsApp" onClick={() => go("scam")} />
        <Tile label="Langue de protection" value={fon?.ok ? "FR + Fɔn" : "Français"} tone="text-accent" sub={fon?.ok ? "Alertes traduites en fɔngbè" : "Service fon non démarré"} onClick={() => go("fon")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between"><div className="font-semibold">Activité de protection</div><span className="text-xs text-subtle">{events.length} événements</span></div>
          {events.length === 0 ? <p className="mt-6 text-sm text-muted">Rien encore. Simulez un appel suspect, un transfert ou un message.</p> : (
            <ul className="mt-4 space-y-3">{events.slice(0, 9).map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[e.type] || "bg-subtle"}`} />
                <span className="flex-1">{(LABEL[e.type] || (() => e.type))(e)}</span>
                <span className="shrink-0 text-xs text-subtle">{new Date(e.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            ))}</ul>
          )}
        </div>
        <div className="space-y-6">
          <div className="card p-6">
            <div className="font-semibold">Actions rapides</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[["call", "Simuler un appel"], ["wallet", "Envoyer de l'argent"], ["scam", "Vérifier un message"], ["fon", "Traduire le fon"]].map(([k, l]) => <button key={k} onClick={() => go(k)} className="btn-ghost justify-start rounded-2xl py-3">{l}</button>)}
            </div>
          </div>
          <div className="card p-6">
            <div className="font-semibold">Derniers incidents d'appel</div>
            {incidents.length === 0 ? <p className="mt-3 text-sm text-muted">Aucun incident.</p> : (
              <ul className="mt-3 space-y-2 text-sm">{incidents.slice(0, 4).map((i) => <li key={i.id} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: LEVELS[i.level].color }} /><span className="font-semibold">{i.number}</span><span className="ml-auto text-xs text-muted">{LEVELS[i.level].name}</span></li>)}</ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
