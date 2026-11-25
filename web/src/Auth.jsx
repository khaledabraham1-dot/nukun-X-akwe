import { useState } from "react";
import { Eye } from "./ui.jsx";
import { setUser } from "./auth.js";
import { MicButton, useVoice } from "./Wallet.jsx";
import { speak } from "./lib.js";

const ACTIVITIES = ["Vendeuse de pagnes", "Vivres et légumes", "Restauration", "Artisan", "Boutique", "Autre"];
const INSTITUTIONS = ["Microfinance (SFD)", "Banque", "Opérateur mobile money", "Programme public"];

export default function Auth({ onDone }) {
  const [role, setRole] = useState(null);
  const [f, setF] = useState({ name: "", phone: "", activity: ACTIVITIES[0], market: "Dantokpa", org: "", kind: INSTITUTIONS[0], email: "" });
  const voice = useVoice((t) => setF((x) => ({ ...x, name: t.replace(/^(je m'appelle|moi c'est|mon nom est)\s*/i, "").replace(/\.$/, "") })));
  const up = (k) => (e) => setF({ ...f, [k]: e.target.value });

  function enter(e) {
    e.preventDefault();
    const u = role === "merchant"
      ? { role, name: f.name.trim() || "Commerçante", phone: f.phone, activity: f.activity, market: f.market }
      : { role, name: f.org.trim() || "Établissement", kind: f.kind, email: f.email };
    setUser(u);
    speak(role === "merchant" ? `Bienvenue ${u.name}.` : `Bienvenue, ${u.name}.`);
    onDone(u);
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-4xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <Eye className="h-14 w-14" />
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight">Bienvenue sur NUKÚN <span className="text-accent">×</span> Akwɛ</h1>
          <p className="mt-2 text-muted">{role ? "Encore quelques informations." : "Qui êtes-vous ?"}</p>
        </div>

        {!role && (
          <div className="grid gap-6 md:grid-cols-2">
            <button onClick={() => { setRole("merchant"); speak("Comment vous appelez-vous ?"); }} className="card group p-8 text-left transition hover:-translate-y-1">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-b from-[#ffd76a] to-[#f2b52c] text-3xl">🧺</div>
              <div className="mt-5 font-display text-2xl font-bold">Je suis commerçant(e)</div>
              <p className="mt-2 text-muted">Vendeuse, artisan, boutique, restauratrice… Je protège mon argent, je tiens mon cahier à la voix et je demande un prêt.</p>
              <div className="mt-6 font-semibold text-accent">Continuer →</div>
            </button>
            <button onClick={() => setRole("institution")} className="card group p-8 text-left transition hover:-translate-y-1">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-fg/10 text-3xl">🏦</div>
              <div className="mt-5 font-display text-2xl font-bold">Je suis un établissement</div>
              <p className="mt-2 text-muted">Microfinance, banque, opérateur mobile money ou programme public. Je reçois les demandes de prêt et les passeports Akwɛ.</p>
              <div className="mt-6 font-semibold text-accent">Continuer →</div>
            </button>
          </div>
        )}

        {role && (
          <form onSubmit={enter} className="card fadein mx-auto max-w-xl space-y-4 p-8">
            {role === "merchant" ? (
              <>
                <label className="block text-sm font-semibold">Votre nom
                  <div className="mt-1 flex items-center gap-2"><MicButton voice={voice} /><input className="input" value={voice.listening ? voice.interim : f.name} onChange={up("name")} placeholder="Ex. Adjoa Houngbo" autoFocus /></div>
                </label>
                <label className="block text-sm font-semibold">Numéro Mobile Money<input className="input mt-1" value={f.phone} onChange={up("phone")} inputMode="tel" placeholder="01 97 00 00 00" /></label>
                <div className="text-sm font-semibold">Votre activité</div>
                <div className="flex flex-wrap gap-2">{ACTIVITIES.map((a) => <button type="button" key={a} onClick={() => setF({ ...f, activity: a })} className={`chip px-4 py-2 text-sm ${f.activity === a ? "border-accent bg-accent/10 font-semibold text-accent" : ""}`}>{a}</button>)}</div>
                <label className="block text-sm font-semibold">Marché ou quartier<input className="input mt-1" value={f.market} onChange={up("market")} /></label>
              </>
            ) : (
              <>
                <label className="block text-sm font-semibold">Nom de l'établissement<input className="input mt-1" value={f.org} onChange={up("org")} placeholder="Ex. Caisse de microfinance" autoFocus /></label>
                <div className="text-sm font-semibold">Type</div>
                <div className="flex flex-wrap gap-2">{INSTITUTIONS.map((a) => <button type="button" key={a} onClick={() => setF({ ...f, kind: a })} className={`chip px-4 py-2 text-sm ${f.kind === a ? "border-accent bg-accent/10 font-semibold text-accent" : ""}`}>{a}</button>)}</div>
                <label className="block text-sm font-semibold">E-mail professionnel<input className="input mt-1" type="email" value={f.email} onChange={up("email")} placeholder="credit@institution.bj" /></label>
              </>
            )}
            <div className="flex gap-2 pt-2"><button type="button" onClick={() => setRole(null)} className="btn-ghost flex-1">← Retour</button><button className="btn-gold flex-1">Entrer</button></div>
            <p className="text-center text-xs text-subtle">Vos données restent sur cet appareil.</p>
          </form>
        )}
      </div>
    </div>
  );
}
