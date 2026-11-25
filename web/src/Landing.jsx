import { Background, Eye, ThemeToggle, useTheme } from "./ui.jsx";
import Results from "./Results.jsx";

export default function Landing({ launch }) {
  const [dark, setDark] = useTheme();
  return (
    <div className="relative min-h-screen">
      <Background />
      <header className="sticky top-3 z-30 mx-auto mt-3 max-w-6xl px-4">
        <div className="glass flex items-center justify-between rounded-full py-2 pl-4 pr-2">
          <a href="#" className="flex items-center gap-2"><Eye /><span className="font-display text-lg font-bold tracking-tight">NUKÚN <span className="text-accent">×</span> Akwɛ</span></a>
          <nav className="hidden gap-1 md:flex">
            {[["#probleme", "L'appli"], ["#projet", "Le projet"], ["#resultats", "Résultats"]].map(([h, l]) => <a key={h} href={h} className="rounded-full px-3.5 py-1.5 text-sm text-muted hover:text-fg">{l}</a>)}
          </nav>
          <div className="flex items-center gap-2"><ThemeToggle dark={dark} setDark={setDark} /><button onClick={launch} className="btn-gold rounded-full">Lancer l'appli</button></div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-12 pt-16 md:pt-24">
        <div className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted"><span className="h-2 w-2 rounded-full bg-safe shadow-[0_0_10px_#22c55e]" />GPU Challenge 2026 · Fintech Academia × Next Fintech Forum · Epitech Bénin</div>
        <h1 className="mt-6 max-w-4xl font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-tight md:text-7xl">Protéger l'argent mobile des Béninois, <span className="bg-gradient-to-r from-[#e8a317] via-[#f7c548] to-[#e8a317] bg-clip-text text-transparent">puis le faire grandir.</span></h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted"><b className="text-fg">NUKÚN</b> (« l'œil » en fon) repère les comptes d'arnaqueurs dans le graphe des transactions et prévient la personne <i>avant</i> qu'elle valide son envoi. <b className="text-fg">Akwɛ</b> (« l'argent ») permet aux commerçants de tenir leurs comptes à la voix et d'ouvrir la porte du crédit.</p>
        <div className="mt-8 flex flex-wrap gap-3"><button onClick={launch} className="btn-gold rounded-full px-8 py-4 text-base">▶ Lancer l'appli</button><a href="#projet" className="btn-ghost rounded-full px-7 py-4 text-base">Découvrir le projet</a></div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {[
            ["1 seconde", "C'est le temps d'un paiement instantané. Une fois parti, l'argent ne revient pas : il faut agir avant la validation.", ""],
            ["51 %", "des adultes béninois savent lire et écrire. Les autres confient souvent leur téléphone et leur code pour envoyer de l'argent.", "Source : J'aime Ma Langue"],
            ["×3", "de précision avec notre graphe face à un modèle classique, et 4 fois moins de commerçants honnêtes alertés à tort.", "Données simulées, 3 essais"],
          ].map(([v, d, s], i) => (
            <div key={i} className="card p-6"><div className={`font-display text-4xl font-extrabold tracking-tight ${i === 2 ? "text-accent" : ""}`}>{v}</div><p className="mt-2 text-sm leading-relaxed text-muted">{d}</p>{s && <p className="mt-2 text-xs text-subtle">{s}</p>}</div>
          ))}
        </div>
      </section>

      <section id="probleme" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-10">
        <div className="card overflow-hidden p-8 md:p-12">
          <div className="grid items-center gap-8 md:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="kicker">L'application</div>
              <h2 className="h-section mt-2">Tout tient dans une seule appli</h2>
              <ul className="mt-5 grid gap-2 text-muted sm:grid-cols-2">
                {["Portefeuille piloté à la voix", "Score de fraude GraphSAGE en direct", "Vérification des messages suspects", "Cahier vocal et passeport de crédit", "Traducteur fon ↔ français", "Tableau de bord et résultats"].map((x) => <li key={x} className="flex gap-2"><span className="text-accent">●</span>{x}</li>)}
              </ul>
              <button onClick={launch} className="btn-gold mt-8 rounded-full px-8 py-4 text-base">▶ Lancer l'appli</button>
            </div>
            <button onClick={launch} className="group relative mx-auto grid h-56 w-56 place-items-center rounded-full glass" aria-label="Lancer l'appli">
              <span className="pulse-ring absolute inset-6 rounded-full bg-gold-400/30" />
              <Eye className="relative h-28 w-28 transition group-hover:scale-110" />
            </button>
          </div>
        </div>
      </section>

      <section id="projet" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
        <div className="kicker">Le projet</div>
        <h2 className="h-section mt-2">Un seul moteur qui comprend les flux et parle fon</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            ["1", "La personne parle", "« Envoie 12 000 à… » ou « J'ai vendu 3 pagnes ». Le texte reste toujours possible."],
            ["2", "NUKÚN analyse", "Réseau de neurones sur graphe (GraphSAGE) : qui paie le destinataire, qui revient, où l'argent repart."],
            ["3", "L'IA explique", "Faits simples, alerte vocale, confirmation obligatoire. Rien ne part sans accord."],
            ["4", "Akwɛ valorise", "Cahier confirmé, rapproché des paiements, puis passeport de crédit partagé par choix."],
          ].map(([n, t, d]) => <div key={n} className="card p-6"><div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-b from-[#ffd76a] to-[#f2b52c] font-bold text-ink-950">{n}</div><div className="mt-4 font-semibold">{t}</div><p className="mt-1 text-sm leading-relaxed text-muted">{d}</p></div>)}
        </div>
        <div id="pilote" className="mt-6 grid scroll-mt-24 gap-6 md:grid-cols-2">
          <div className="card p-6">
            <div className="font-semibold">Ce qui tourne sur GPU</div>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>• Entraînement de GraphSAGE sur des millions de transactions (PyTorch, protocole reproductible).</li>
              <li>• Reconnaissance vocale du fon : affinage de MMS sur le corpus ouvert J'aime Ma Langue (134 h transcrites, 650 voix).</li>
              <li>• Modèle de langue pour comprendre les dictées et les messages suspects.</li>
            </ul>
          </div>
          <div className="card p-6">
            <div className="font-semibold">Vers un pilote</div>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>• <b className="text-fg">Opérateurs</b> : API de score appelée avant validation. Chaque fraude évitée est un remboursement de moins.</li>
              <li>• <b className="text-fg">Microfinances</b> : passeport de crédit des commerçants, partagé avec leur accord.</li>
              <li>• <b className="text-fg">Services vocaux en fon</b> : NUKÚN peut vérifier le destinataire d'un transfert préparé à la voix.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="resultats" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-16">
        <div className="kicker">Pour le jury</div>
        <h2 className="h-section mt-2 mb-8">Résultats mesurés</h2>
        <Results />
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10">
        <div className="glass flex flex-col gap-2 rounded-3xl px-6 py-5 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <span>NUKÚN × Akwɛ · Prototype GPU Challenge 2026, Epitech Bénin. Portefeuille fictif, données simulées : aucun argent réel n'est déplacé.</span>
          <a className="underline hover:text-fg" href="https://github.com/khaledabraham1-dot/nukun-X-akwe" target="_blank" rel="noreferrer">Code et protocole sur GitHub</a>
        </div>
      </footer>
    </div>
  );
}
