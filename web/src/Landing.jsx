import { Background, Eye, ThemeToggle, useTheme } from "./ui.jsx";
import Results from "./Results.jsx";

export default function Landing({ launch }) {
  const [dark, setDark] = useTheme();
  return (
    <div className="relative min-h-screen">
      <Background />
      <header className="sticky top-3 z-30 mx-auto mt-3 max-w-6xl px-4">
        <div className="glass flex items-center justify-between rounded-full py-2 pl-4 pr-2">
          <a href="#" className="flex items-center gap-2"><Eye /><span className="font-display text-lg font-bold tracking-tight">NUKÚN</span><span className="hidden rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent sm:inline">CALL GUARD</span></a>
          <nav className="hidden gap-1 md:flex">
            {[["#comment", "Comment ça marche"], ["#fon", "En fɔngbè"], ["#resultats", "Résultats"]].map(([h, l]) => <a key={h} href={h} className="rounded-full px-3.5 py-1.5 text-sm text-muted hover:text-fg">{l}</a>)}
          </nav>
          <div className="flex items-center gap-2"><ThemeToggle dark={dark} setDark={setDark} /><button onClick={launch} className="btn-gold rounded-full">Lancer l'appli</button></div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-12 pt-16 md:pt-24">
        <div className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-safe shadow-[0_0_10px_#22c55e]" />GPU Challenge 2026 · Fintech Academia × Next Fintech Forum · Epitech Bénin</div>
        <h1 className="mt-6 max-w-4xl font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-tight md:text-7xl">Arrêter l'arnaque <span className="bg-gradient-to-r from-[#e8a317] via-[#f7c548] to-[#e8a317] bg-clip-text text-transparent">pendant l'appel.</span></h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted"><b className="text-fg">NUKÚN</b> (« l'œil » en fon) repère les faux agents Mobile Money pendant un appel, vérifie chaque transfert avant qu'il parte, et prévient l'utilisateur <b className="text-fg">en français et en fɔngbè</b>, avant qu'il ne donne son code ou son argent.</p>
        <div className="mt-8 flex flex-wrap gap-3"><button onClick={launch} className="btn-gold rounded-full px-8 py-4 text-base">▶ Lancer l'appli</button><a href="#comment" className="btn-ghost rounded-full px-7 py-4 text-base">Comment ça marche</a></div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            ["1 appel", "suffit : un faux agent MTN demande « le code reçu par SMS », et le compte est vidé.", ""],
            ["1 seconde", "c'est le temps d'un paiement instantané. Une fois parti, l'argent ne revient pas.", "PI-SPI, BCEAO"],
            ["51 %", "des adultes béninois savent lire et écrire. L'alerte doit être dite, et dans leur langue.", "Source : J'aime Ma Langue"],
          ].map(([v, d, s], i) => <div key={i} className="card p-6"><div className={`font-display text-4xl font-extrabold tracking-tight ${i === 0 ? "text-accent" : ""}`}>{v}</div><p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>{s && <p className="mt-2 text-xs text-subtle">{s}</p>}</div>)}
        </div>
      </section>

      <section id="comment" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12">
        <div className="kicker">NUKÚN Call Guard</div>
        <h2 className="h-section mt-2">Détecter. Vérifier. Protéger.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["1", "Vérifier l'appelant", "Le numéro est comparé au registre des numéros officiels. Absent : identité non vérifiée."],
            ["2", "Comprendre la conversation", "Voix transcrite puis analysée : identité annoncée, demande de code, demande d'argent, pression."],
            ["3", "Évaluer le risque", "Plusieurs indices croisés, jamais un mot isolé. « Ne donnez jamais votre code » n'est pas une demande."],
            ["4", "Protéger", "Alerte visuelle et vocale, en français et en fɔngbè, avec raccrocher ou appeler le service officiel."],
          ].map(([n, t, d]) => <div key={n} className="card p-6"><div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-b from-[#ffd76a] to-[#f2b52c] font-bold text-ink-950">{n}</div><div className="mt-4 font-semibold">{t}</div><p className="mt-1 text-sm leading-relaxed text-muted">{d}</p></div>)}
        </div>
        <div className="card mt-6 grid items-center gap-8 p-8 md:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="kicker">Trois boucliers dans une appli</div>
            <ul className="mt-4 space-y-3 text-muted">
              <li><b className="text-fg">📞 Call Guard</b> : faux agents et demandes de code pendant l'appel.</li>
              <li><b className="text-fg">💸 Transferts protégés</b> : un réseau de neurones sur graphe (GraphSAGE) repère les comptes mules avant l'envoi.</li>
              <li><b className="text-fg">💬 Messages suspects</b> : faux dépôts, faux placements, fausses offres de crédit.</li>
            </ul>
            <button onClick={launch} className="btn-gold mt-8 rounded-full px-8 py-4 text-base">▶ Lancer l'appli</button>
          </div>
          <button onClick={launch} className="group relative mx-auto grid h-56 w-56 place-items-center rounded-full glass" aria-label="Lancer l'appli">
            <span className="pulse-ring absolute inset-6 rounded-full bg-gold-400/30" />
            <Eye className="relative h-28 w-28 transition group-hover:scale-110" />
          </button>
        </div>
      </section>

      <section id="fon" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12">
        <div className="card grid gap-8 p-8 md:grid-cols-2">
          <div>
            <div className="kicker">Sécurité et traduction</div>
            <h2 className="h-section mt-2">Prévenu dans sa langue.</h2>
            <p className="mt-4 text-muted">Les escrocs appellent souvent en fon. NUKÚN traduit ce qui est dit en fɔngbè pour l'analyser, et lit ses alertes à voix haute en fɔngbè, avec les modèles ouverts de Meta (NLLB-200, MMS).</p>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl bg-fg/5 p-4"><div className="text-xs text-muted">Alerte en français</div><div className="mt-1">« Personne de MTN ne vous demandera votre code secret. »</div></div>
            <div className="rounded-2xl bg-accent/10 p-4"><div className="text-xs text-muted">Traduction automatique en fɔngbè (NLLB-200)</div><div className="mt-1 font-semibold text-accent">« Mɛɖebǔ ɖò MTN na byɔ́ xógbe towe nùɖé ǎ. »</div></div>
            <p className="text-xs text-subtle">Qualité encore imparfaite : à affiner sur GPU avec le corpus ouvert J'aime Ma Langue (134 h de fon transcrites).</p>
          </div>
        </div>
      </section>

      <section id="resultats" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16 pt-4">
        <div className="kicker">Pour le jury · transferts protégés</div>
        <h2 className="h-section mb-8 mt-2">Résultats mesurés</h2>
        <Results />
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10">
        <div className="glass flex flex-col gap-2 rounded-3xl px-6 py-5 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <span>NUKÚN Call Guard · Prototype GPU Challenge 2026, Epitech Bénin. Appels simulés, registre et portefeuille de démonstration.</span>
          <a className="underline hover:text-fg" href="https://github.com/khaledabraham1-dot/nukun-X-akwe" target="_blank" rel="noreferrer">Code sur GitHub</a>
        </div>
      </footer>
    </div>
  );
}
