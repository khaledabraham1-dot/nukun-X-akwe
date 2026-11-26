import { useCallback, useEffect, useState } from "react";
import Landing from "./Landing.jsx";
import Wallet from "./Wallet.jsx";
import Scam from "./Scam.jsx";
import Fon from "./Fon.jsx";
import Dashboard from "./Dashboard.jsx";
import CallGuard from "./CallGuard.jsx";
import { Background, Eye, Intro, ThemeToggle, useTheme } from "./ui.jsx";

const SECTIONS = [
  { id: "home", label: "Tableau de bord", icon: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z", el: (go) => <Dashboard go={go} />, title: "Votre protection", sub: "Appels, transferts et messages : tout ce que NUKÚN surveille pour vous." },
  { id: "call", label: "Call Guard", icon: "M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8Z", el: () => <CallGuard />, title: "NUKÚN Call Guard", sub: "Détecter. Vérifier. Protéger. Pendant l'appel, avant que le code ou l'argent ne parte." },
  { id: "wallet", label: "Transferts", icon: "M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2h1a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm13 6a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z", el: () => <Wallet />, title: "Transferts protégés", sub: "Avant chaque envoi, NUKÚN vérifie le compte qui va recevoir votre argent." },
  { id: "scam", label: "Messages", icon: "M12 2 3 6v6c0 5 3.8 9.7 9 10 5.2-.3 9-5 9-10V6l-9-4Zm-1 6h2v6h-2V8Zm0 8h2v2h-2v-2Z", el: () => <Scam />, title: "Message suspect", sub: "SMS, WhatsApp ou message dicté : repérer l'arnaque avant d'agir." },
  { id: "fon", label: "Traducteur fon", icon: "M12.9 15.1 10.4 12.6l.03-.03A17.5 17.5 0 0 0 14.1 6H17V4h-7V2H8v2H1v2h11.2A15.7 15.7 0 0 1 9 11.4 15.6 15.6 0 0 1 6.7 8H4.7a17.6 17.6 0 0 0 3 4.6l-5.1 5 1.4 1.4L9 14l3.1 3.1.8-2ZM18.5 10h-2L12 22h2l1.1-3h4.8l1.1 3h2l-4.5-12Zm-2.6 7 1.6-4.3 1.6 4.3h-3.2Z", el: () => <Fon />, title: "Traducteur fon ↔ français", sub: "Comprendre et être prévenu dans sa langue." },
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
  const go = (id) => { location.hash = `#/app/${id}`; scrollTo(0, 0); };
  const cur = SECTIONS.find((s) => s.id === sec) || SECTIONS[0];
  return (
    <div className="relative min-h-screen">
      <Background />
      <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-64 flex-col rounded-3xl p-4 lg:flex">
        <a href="#/" className="flex items-center gap-2 px-2 py-2"><Eye /><span className="font-display text-lg font-bold">NUKÚN</span><span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">CALL GUARD</span></a>
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => go(s.id)} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${cur.id === s.id ? "bg-gradient-to-b from-[#ffd76a] to-[#f2b52c] text-ink-950 shadow-[0_8px_24px_-10px_rgba(232,163,23,.9)]" : "text-muted hover:bg-fg/5 hover:text-fg"}`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d={s.icon} /></svg>{s.label}
            </button>
          ))}
        </nav>
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-2xl bg-safe/10 p-3 text-xs text-good"><span className="h-2 w-2 rounded-full bg-safe shadow-[0_0_8px_#22c55e]" />Protection active</div>
          <div className="flex items-center justify-between px-1"><span className="text-xs text-muted">Thème</span><ThemeToggle dark={dark} setDark={setDark} /></div>
          <a href="#/" className="btn-ghost w-full rounded-2xl">← Quitter l'appli</a>
        </div>
      </aside>

      <header className="glass sticky top-3 z-30 mx-3 mt-3 flex items-center justify-between rounded-full py-2 pl-4 pr-2 lg:hidden">
        <a href="#/" className="flex items-center gap-2"><Eye className="h-7 w-7" /><span className="font-display font-bold">NUKÚN</span></a>
        <ThemeToggle dark={dark} setDark={setDark} />
      </header>

      <main className="px-4 pb-28 pt-6 lg:ml-[17.5rem] lg:pb-10 lg:pr-6 lg:pt-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6"><h1 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">{cur.title}</h1><p className="mt-1 text-muted">{cur.sub}</p></div>
          <div key={cur.id} className="fadein">{cur.el(go)}</div>
        </div>
      </main>

      <nav className="glass fixed inset-x-3 bottom-3 z-30 flex justify-between rounded-3xl p-1.5 lg:hidden">
        {SECTIONS.map((s) => (
          <button key={s.id} onClick={() => go(s.id)} className={`flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[10px] font-semibold ${cur.id === s.id ? "bg-gradient-to-b from-[#ffd76a] to-[#f2b52c] text-ink-950" : "text-muted"}`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d={s.icon} /></svg>{s.label.split(" ")[0]}
          </button>
        ))}
      </nav>
    </div>
  );
}
