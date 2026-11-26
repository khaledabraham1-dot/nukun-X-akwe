import { useState } from "react";
import { SEEDS, STRESS, VARIANTS, mean } from "./lib.js";

const COLORS = { Référence: "bg-slate-500", Contrôle: "bg-sky-500", Graphe: "bg-gold-400" };

function Bars({ title, sub, idx, fmt, max, better }) {
  const rows = VARIANTS.filter((v) => !v.key.endsWith("_akwe"));
  return (
    <div className="card p-6">
      <div className="font-semibold text-fg">{title}</div>
      <div className="mb-4 text-xs text-muted">{sub} · moyenne des 3 seeds · {better}</div>
      <div className="space-y-3">
        {rows.map((v) => {
          const m = mean(v.key, idx);
          return (
            <div key={v.key}>
              <div className="mb-1 flex justify-between text-sm"><span className={v.family === "Graphe" ? "font-semibold text-accent" : "text-fg/80"}>{v.label}</span><span className="tabular-nums text-fg/80">{fmt(m)}</span></div>
              <div className="h-3 rounded-full bg-fg/5"><div className={`h-3 rounded-full ${COLORS[v.family]}`} style={{ width: `${(m / max) * 100}%` }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Results() {
  const [seed, setSeed] = useState(73101);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi value="×3" label="Précision moyenne (AP) de GraphSAGE par rapport à la régression logistique" detail="0,61 contre 0,19 en moyenne" />
        <Kpi value="÷4" label="Commerçants honnêtes pris à tort pour des fraudeurs" detail="17 % contre 81 % avec la régression" />
        <Kpi value="3 × 18 000" label="Transactions simulées, protocole figé avant les essais" detail="7 variantes, mêmes seuils, mêmes données" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Bars title="Précision moyenne (AP)" sub="Capacité à classer les fraudes en tête" idx={2} fmt={(m) => m.toFixed(2).replace(".", ",")} max={0.7} better="plus c'est haut, mieux c'est" />
        <Bars title="Fausses alertes sur les commerçants" sub="Part des commerçants honnêtes alertés à tort" idx={3} fmt={(m) => m.toFixed(0) + " %"} max={100} better="plus c'est bas, mieux c'est" />
      </div>
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div><div className="font-semibold text-fg">Tous les résultats sur la période de test</div><div className="text-xs text-muted">Seuil choisi sur la validation pour 80 % de rappel, puis gelé sur le test</div></div>
          <div className="flex gap-1">{SEEDS.map((s) => <button key={s} onClick={() => setSeed(s)} className={`chip ${seed === s ? "border-accent text-accent" : ""}`}>Seed {s}</button>)}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface text-xs text-muted"><tr>{["Variante", "Rappel", "Précision", "AP", "Fausses alertes commerçants", "Rappel imitateurs", "Alertes"].map((h) => <th key={h} className="p-3 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>{VARIANTS.map((v) => { const r = STRESS[seed][v.key]; return (
              <tr key={v.key} className={`border-t border-fg/5 ${v.key === "sage_history" ? "bg-accent/10" : ""}`}>
                <td className="p-3"><span className={v.family === "Graphe" ? "font-semibold text-accent" : "text-fg/80"}>{v.label}</span><span className="ml-2 text-[11px] text-subtle">{v.family}</span></td>
                <td className="p-3 tabular-nums">{r[0]} %</td><td className="p-3 tabular-nums">{r[1]} %</td><td className="p-3 tabular-nums font-semibold">{r[2].toFixed(3)}</td><td className="p-3 tabular-nums">{r[3]} %</td><td className="p-3 tabular-nums">{r[4]} %</td><td className="p-3 tabular-nums">{r[5]}</td>
              </tr>); })}</tbody>
          </table>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <div className="font-semibold text-fg">Ce que nous avons appris</div>
          <ul className="mt-3 space-y-2 text-sm text-fg/80">
            <li>✅ <b className="text-fg">Le graphe fait la différence.</b> Un commerçant et une mule reçoivent tous deux de l'argent de nombreuses personnes. Regarder le voisinage (qui paie, qui revient, où l'argent repart) permet de les distinguer.</li>
            <li>⚖️ <b className="text-fg">Une hypothèse non confirmée.</b> Ajouter les ventes déclarées par les commerçants n'améliore pas le modèle de façon stable sur ce protocole difficile. Nous le publions tel quel.</li>
            <li>🧪 <b className="text-fg">Les nouveaux comptes restent difficiles</b>, comme dans la réalité.</li>
          </ul>
        </div>
        <div className="card p-6">
          <div className="font-semibold text-fg">Limites assumées</div>
          <ul className="mt-3 space-y-2 text-sm text-fg/80">
            <li>• Données simulées (scénarios béninois : mules, imitateurs, commerçants, agents), pas de données d'opérateur.</li>
            <li>• Modèles entraînés sur CPU. Le protocole est prêt pour une exécution GPU sur le même code.</li>
            <li>• Voix : français dans le navigateur. Le fon passe par le corpus ouvert J'aime Ma Langue (134 h transcrites).</li>
            <li>• Le score met en pause et explique. Il ne bloque jamais seul un paiement réel.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Kpi({ value, label, detail }) {
  return <div className="card p-5"><div className="font-display text-4xl font-extrabold text-accent">{value}</div><div className="mt-2 text-sm text-fg">{label}</div><div className="mt-1 text-xs text-muted">{detail}</div></div>;
}
