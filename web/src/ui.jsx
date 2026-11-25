import { useEffect, useState } from "react";

export function Eye({ className = "h-8 w-8" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs><linearGradient id="eg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#ffd76a" /><stop offset="1" stopColor="#e8a317" /></linearGradient></defs>
      <ellipse cx="32" cy="32" rx="26" ry="15" fill="none" stroke="url(#eg)" strokeWidth="4.5" />
      <circle cx="32" cy="32" r="8.5" fill="url(#eg)" />
      <circle cx="35" cy="29" r="2.6" fill="#060b16" />
    </svg>
  );
}

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch { /* ignoré */ }
  }, [dark]);
  return [dark, setDark];
}

export function ThemeToggle({ dark, setDark }) {
  return (
    <button onClick={() => setDark(!dark)} className="glass relative flex h-10 w-[76px] shrink-0 items-center rounded-full p-1" aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"} title={dark ? "Mode clair" : "Mode sombre"}>
      <span className={`absolute top-1 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-b from-[#ffd76a] to-[#f2b52c] shadow transition-all duration-300 ${dark ? "left-[40px]" : "left-1"}`}>
        {dark
          ? <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-950" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
          : <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-950" fill="currentColor"><circle cx="12" cy="12" r="4.5" /><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
      </span>
    </button>
  );
}

export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="blob drift1 -left-32 -top-40 h-[520px] w-[520px]" style={{ background: "var(--blob1)" }} />
      <div className="blob drift2 right-[-120px] top-[10%] h-[560px] w-[560px]" style={{ background: "var(--blob2)" }} />
      <div className="blob drift1 bottom-[-200px] left-[30%] h-[520px] w-[620px]" style={{ background: "var(--blob3)" }} />
      <div className="absolute inset-0 opacity-[.35] dark:opacity-[.25]" style={{ backgroundImage: "radial-gradient(rgb(var(--fg) / .08) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
    </div>
  );
}

// Générique d'ouverture de l'application
export function Intro({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3600); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="intro fixed inset-0 z-50 grid place-items-center overflow-hidden bg-[#050914]" onClick={onDone}>
      <div className="blob drift1 left-[10%] top-[15%] h-[420px] w-[420px]" style={{ background: "rgba(247,197,72,.28)" }} />
      <div className="blob drift2 right-[8%] bottom-[10%] h-[460px] w-[460px]" style={{ background: "rgba(59,130,246,.30)" }} />
      <div className="relative flex flex-col items-center text-center">
        <svg viewBox="0 0 120 70" className="intro-eye h-28 w-48 md:h-36 md:w-60">
          <defs><linearGradient id="ig" x1="0" x2="1"><stop offset="0" stopColor="#ffd76a" /><stop offset="1" stopColor="#e8a317" /></linearGradient></defs>
          <path className="intro-lid" d="M8 35 Q60 -8 112 35 Q60 78 8 35 Z" fill="none" stroke="url(#ig)" strokeWidth="5" strokeLinejoin="round" />
          <circle className="intro-pupil" cx="60" cy="35" r="14" fill="url(#ig)" />
          <circle className="intro-pupil" cx="65" cy="30" r="4" fill="#050914" />
        </svg>
        <div className="intro-title mt-6 font-display text-5xl font-extrabold tracking-tight text-white md:text-7xl">NUKÚN <span className="text-[#f7c548]">×</span> Akwɛ</div>
        <div className="intro-sub mt-4 text-base text-slate-300 md:text-lg">Protéger l'argent mobile, puis le faire grandir.</div>
        <div className="intro-sub mt-10 h-1 w-48 overflow-hidden rounded-full bg-white/10"><div className="intro-bar h-full bg-gradient-to-r from-[#e8a317] to-[#ffd76a]" /></div>
      </div>
      <button onClick={onDone} className="absolute bottom-8 right-8 rounded-full border border-white/20 px-4 py-2 text-sm text-slate-300 hover:bg-white/10">Passer</button>
    </div>
  );
}
