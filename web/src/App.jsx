import { useCallback, useEffect, useState } from "react";
import Landing from "./Landing.jsx";
import Wallet from "./Wallet.jsx";
import Scam from "./Scam.jsx";
import Akwe from "./Akwe.jsx";
import Fon from "./Fon.jsx";
import Dashboard from "./Dashboard.jsx";
import Loan from "./Loan.jsx";
import Auth from "./Auth.jsx";
import InstDashboard from "./InstDashboard.jsx";
import { getUser, logout } from "./auth.js";
import { Background, Eye, Intro, ThemeToggle, useTheme } from "./ui.jsx";

const INST = [
  { id: "home", label: "Demandes de prêt", icon: "M12 1 3 5v2h18V5l-9-4ZM5 9v8H3v4h18v-4h-2V9h-3v8h-2V9h-4v8H8V9H5Z", el: (go, u) => <InstDashboard user={u} />, title: (u) => u?.name || "Établissement", sub: "Demandes de prêt reçues, passeports Akwɛ et protection NUKÚN." },
  { id: "fon", label: "Traducteur fon", icon: "M12.9 15.1 10.4 12.6l.03-.03A17.5 17.5 0 0 0 14.1 6H17V4h-7V2H8v2H1v2h11.2A15.7 15.7 0 0 1 9 11.4 15.6 15.6 0 0 1 6.7 8H4.7a17.6 17.6 0 0 0 3 4.6l-5.1 5 1.4 1.4L9 14l3.1 3.1.8-2ZM18.5 10h-2L12 22h2l1.1-3h4.8l1.1 3h2l-4.5-12Zm-2.6 7 1.6-4.3 1.6 4.3h-3.2Z", el: () => <Fon />, title: () => "Traducteur fon ↔ français", sub: "Comprendre vos clients dans leur langue." },
];

const SECTIONS = [
  { id: "home", label: "Tableau de bord", icon: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z", el: (go, u) => <Dashboard go={go} user={u} />, title: (u) => `Bonjour ${u?.name?.split(" ")[0] || ""} 👋`, sub: "Votre argent, vos alertes et votre activité." },
  { id: "wallet", label: "Portefeuille", icon: "M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2h1a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm13 6a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z", el: () => <Wallet />, title: () => "Portefeuille", sub: "Envoyer de l'argent : NUKÚN vérifie le destinataire avant chaque envoi." },
  { id: "scam", label: "Messages", icon: "M12 2 3 6v6c0 5 3.8 9.7 9 10 5.2-.3 9-5 9-10V6l-9-4Zm-1 6h2v6h-2V8Zm0 8h2v2h-2v-2Z", el: () => <Scam />, title: () => "Message suspect", sub: "SMS, WhatsApp ou message dicté : repérer l'arnaque avant d'agir." },
  { id: "akwe", label: "Cahier Akwɛ", icon: "M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm2 9v2h8v-2H8Zm0 4v2h6v-2H8Z", el: () => <Akwe />, title: () => "Cahier Akwɛ", sub: "Dictez vos ventes : le cahier devient un passeport de crédit." },
  { id: "loan", label: "Prêt", icon: "M12 1 3 5v2h18V5l-9-4ZM5 9v8H3v4h18v-4h-2V9h-3v8h-2V9h-4v8H8V9H5Z", el: () => <Loan />, title: () => "Prêt en 48 h", sub: "Demandez un microcrédit à la voix : votre cahier Akwɛ sert de dossier." },
  { id: "fon", label: "Traducteur fon", icon: "M12.9 15.1 10.4 12.6l.03-.03A17.5 17.5 0 0 0 14.1 6H17V4h-7V2H8v2H1v2h11.2A15.7 15.7 0 0 1 9 11.4 15.6 15.6 0 0 1 6.7 8H4.7a17.6 17.6 0 0 0 3 4.6l-5.1 5 1.4 1.4L9 14l3.1 3.1.8-2ZM18.5 10h-2L12 22h2l1.1-3h4.8l1.1 3h2l-4.5-12Zm-2.6 7 1.6-4.3 1.6 4.3h-3.2Z", el: () => <Fon />, title: () => "Traducteur fon ↔ français", sub: "Parler ou écrire en fon, comprendre en français, et l'inverse." },
];

function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  if (!h.startsWith("app")) return { app: false };
  return { app: true, sec: h.split("/")[1] || "home" };
}

export default function App() {
  const [route, setRoute] = useState(parseHash);
  const [intro, setIntro] = useState(false);
  useEffect(() => { const f = () => setRoute(parseHash()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  const launch = () => { setIntro(true); location.hash = "#/app"; scrollTo(0, 0); };
  const endIntro = useCallback(() => setIntro(false), []);
  return (
    <>
      {intro && <Intro onDone={endIntro} />}
      {route.app ? <Shell sec={route.sec} /> : <Landing launch={launch} />}
    </>
  );
}

function Shell({ sec }) {
  const [dark, setDark] = useTheme();
  const [user, setU] = useState(getUser);
  const go = (id) => { location.hash = `#/app/${id}`; scrollTo(0, 0); };
  if (!user) return (<div className="relative min-h-screen"><Background /><div className="absolute right-4 top-4"><ThemeToggle dark={dark} setDark={setDark} /></div><Auth onDone={(u) => { setU(u); go("home"); }} /></div>);
  const LIST = user.role === "institution" ? INST : SECTIONS;
  const cur = LIST.find((s) => s.id === sec) || LIST[0];
  const out = () => { logout(); setU(null); location.hash = "#/app"; };
  return (
    <div className="relative min-h-screen">
      <Background />
      <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-64 flex-col rounded-3xl p-4 lg:flex">
        <a href="#/" className="flex items-center gap-2 px-2 py-2"><Eye /><span className="font-display text-lg font-bold">NUKÚN <span className="text-accent">×</span> Akwɛ</span></a>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {LIST.map((s) => (
            <button key={s.id} onClick={() => go(s.id)} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${cur.id === s.id ? "bg-gradient-to-b from-[#ffd76a] to-[#f2b52c] text-ink-950 shadow-[0_8px_24px_-10px_rgba(232,163,23,.9)]" : "text-muted hover:bg-fg/5 hover:text-fg"}`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d={s.icon} /></svg>{s.label}
            </button>
          ))}
        </nav>
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1"><span className="text-xs text-muted">Thème</span><ThemeToggle dark={dark} setDark={setDark} /></div>
          <div className="rounded-2xl bg-fg/5 p-3"><div className="truncate text-sm font-semibold">{user.name}</div><div className="truncate text-xs text-muted">{user.role === "institution" ? user.kind : user.activity}</div></div>
          <button onClick={out} className="btn-ghost w-full rounded-2xl">Se déconnecter</button>
        </div>
      </aside>

      <header className="glass sticky top-3 z-30 mx-3 mt-3 flex items-center justify-between rounded-full py-2 pl-4 pr-2 lg:hidden">
        <a href="#/" className="flex items-center gap-2"><Eye className="h-7 w-7" /><span className="font-display font-bold">NUKÚN</span></a>
        <div className="flex items-center gap-2"><button onClick={out} className="text-xs text-muted">Sortir</button><ThemeToggle dark={dark} setDark={setDark} /></div>
      </header>

      <main className="px-4 pb-28 pt-6 lg:ml-[17.5rem] lg:pb-10 lg:pr-6 lg:pt-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6"><h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{cur.title(user)}</h1><p className="mt-1 text-muted">{cur.sub}</p></div>
          <div key={cur.id} className="fadein">{cur.el(go, user)}</div>
        </div>
      </main>

      <nav className="glass fixed inset-x-3 bottom-3 z-30 flex justify-between rounded-3xl p-1.5 lg:hidden">
        {LIST.map((s) => (
          <button key={s.id} onClick={() => go(s.id)} className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[10px] font-semibold ${cur.id === s.id ? "bg-gradient-to-b from-[#ffd76a] to-[#f2b52c] text-ink-950" : "text-muted"}`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d={s.icon} /></svg>{s.label.split(" ")[0]}
          </button>
        ))}
      </nav>
    </div>
  );
}
