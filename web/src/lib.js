import engine from "./engine.json";

export { engine };

export const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " F";
export const pct = (x, d = 0) => (x * 100).toFixed(d).replace(".", ",") + " %";

// Contacts du portefeuille fictif : chaque contact pointe vers un compte du graphe simulé.
// Les scores affichés sont ceux calculés par les modèles entraînés (poids réels), pas des valeurs scénarisées.
export const CONTACTS = [
  { id: "M012", name: "Maman Adjoa", role: "Vendeuse de tissus, Dantokpa", keys: ["adjoa", "maman", "tissu"] },
  { id: "X006", name: "« Service client MTN »", role: "Numéro qui vous a appelé", keys: ["mtn", "service client", "service"] },
  { id: "I000", name: "Invest Plus 48h", role: "Offre reçue sur WhatsApp", keys: ["invest", "placement", "48"] },
  { id: "M040", name: "Koffi Boutique", role: "Boutique de quartier, Akpakpa", keys: ["koffi", "boutique"] },
  { id: "A007", name: "Agent MoMo Zogbo", role: "Point de service mobile money", keys: ["zogbo", "agent momo", "point momo"] },
];

export const AMOUNT_BUCKETS = [5000, 12000, 50000];

export function scoreFor(accountId, amount) {
  const acc = engine.accounts[accountId];
  const bucket = AMOUNT_BUCKETS.reduce((b, x) => (Math.abs(Math.log(x / amount)) < Math.abs(Math.log(b / amount)) ? x : b));
  return { acc, bucket, s: acc.scores[String(bucket)] };
}

export const TH = engine.thresholds;

// Lecture des montants en français : « 12 000 », « 12000 F », « 12 mille », « 5.000 », « 2,5 millions »
const WORDNUM = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50, cent: 100 };
export function parseAmount(text) {
  const t = text.toLowerCase().replace(/(\d)[\s.  ](?=\d{3}\b)/g, "$1");
  let m = t.match(/(\d+(?:,\d+)?)\s*(mille|k\b|millions?)/);
  if (m) {
    const base = parseFloat(m[1].replace(",", "."));
    return Math.round(base * (m[2].startsWith("million") ? 1e6 : 1000));
  }
  m = t.match(/\b(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|quinze|vingt|trente|quarante|cinquante|cent)\s+mille\b/);
  if (m) return WORDNUM[m[1]] * 1000;
  if (/\bmille\b/.test(t)) return 1000;
  const nums = [...t.matchAll(/\d+/g)].map((x) => parseInt(x[0], 10)).filter((x) => x >= 100);
  return nums.length ? Math.max(...nums) : null;
}

export function findContact(text) {
  const t = text.toLowerCase();
  let best = null, len = 0;
  for (const c of CONTACTS) for (const k of c.keys) if (t.includes(k) && k.length > len) { best = c; len = k.length; }
  return best;
}

// Faits observés (7 derniers jours) traduits en phrases simples
export function explainFacts(f, profileHint) {
  const out = [];
  out.push({ k: "senders", txt: `${f.unique_senders} personnes différentes lui ont envoyé de l'argent en 7 jours (${f.incoming_count} dépôts)`, level: f.unique_senders >= 15 ? "watch" : "ok" });
  out.push({ k: "turnover", txt: `${pct(Math.min(1, f.turnover))} de l'argent reçu est déjà ressorti du compte`, level: f.turnover > 0.6 ? "bad" : f.turnover > 0.35 ? "watch" : "ok" });
  if (f.recent_outgoing_share > 0.15) out.push({ k: "recent", txt: `Sorties importantes ces dernières 24 h (${pct(Math.min(1, f.recent_outgoing_share))} des entrées)`, level: "bad" });
  out.push({ k: "age", txt: f.account_age_days < 10 ? `Compte récent : actif depuis ${Math.max(1, Math.round(f.account_age_days))} jours` : `Compte actif depuis ${Math.round(f.account_age_days)} jours`, level: f.account_age_days < 10 ? "bad" : "ok" });
  out.push({ k: "repeat", txt: `${pct(f.repeat_share)} des dépôts viennent de clients qui reviennent`, level: f.repeat_share > 0.3 ? "ok" : "watch" });
  return out;
}

// Reconnaissance vocale du navigateur (Chrome, Edge, Safari)
export function getRecognizer(lang = "fr-FR") {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = lang; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
  return r;
}

export function speak(text, lang = "fr-FR") {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 1;
    const v = speechSynthesis.getVoices().find((x) => x.lang?.startsWith("fr"));
    if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { /* synthèse indisponible */ }
}

export function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
export function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
}

// Résultats du protocole de stress (reports/STRESS_RESULTATS.md, 3 seeds, 18 000 transactions chacune)
export const VARIANTS = [
  { key: "rules", label: "Règles simples", family: "Référence" },
  { key: "logistic_history", label: "Régression logistique", family: "Référence" },
  { key: "logistic_akwe", label: "Régression + ventes déclarées", family: "Référence" },
  { key: "mlp_history", label: "Réseau sans graphe (MLP)", family: "Contrôle" },
  { key: "mlp_akwe", label: "MLP + ventes déclarées", family: "Contrôle" },
  { key: "sage_history", label: "NUKÚN GraphSAGE", family: "Graphe" },
  { key: "sage_akwe", label: "GraphSAGE + ventes déclarées", family: "Graphe" },
];
// [rappel, précision, AP, FPR commerçants, rappel imitateurs, alertes]
export const STRESS = {
  73101: { rules: [70.9, 14.6, .134, 76.6, 63.1, 2422], logistic_history: [75.7, 21.6, .202, 78.1, 81.4, 1745], logistic_akwe: [76.7, 21.9, .191, 78.1, 82.5, 1744], mlp_history: [73.1, 29.1, .384, 54.0, 68.1, 1253], mlp_akwe: [57.8, 26.6, .270, 44.3, 56.7, 1082], sage_history: [66.1, 56.5, .533, 15.0, 67.3, 582], sage_akwe: [70.5, 57.5, .629, 16.6, 71.1, 610] },
  73102: { rules: [81.9, 21.5, .166, 61.0, 78.4, 1985], logistic_history: [79.4, 24.0, .200, 79.2, 85.6, 1723], logistic_akwe: [76.3, 23.4, .184, 78.8, 84.6, 1695], mlp_history: [77.5, 29.7, .305, 56.6, 82.1, 1356], mlp_akwe: [73.1, 24.3, .216, 68.9, 82.1, 1564], sage_history: [55.2, 60.9, .642, 11.1, 54.5, 471], sage_akwe: [67.5, 36.5, .601, 36.6, 64.9, 962] },
  73103: { rules: [85.0, 16.3, .147, 68.4, 88.2, 2438], logistic_history: [75.2, 17.9, .170, 85.6, 79.2, 1959], logistic_akwe: [76.7, 19.4, .226, 82.1, 82.0, 1842], mlp_history: [70.4, 25.4, .383, 52.8, 75.1, 1295], mlp_akwe: [61.5, 27.8, .327, 44.1, 75.5, 1033], sage_history: [78.4, 47.9, .663, 24.7, 82.0, 764], sage_akwe: [78.2, 43.9, .599, 27.9, 83.3, 831] },
};
export const SEEDS = [73101, 73102, 73103];
export function mean(key, idx) { return SEEDS.reduce((s, sd) => s + STRESS[sd][key][idx], 0) / SEEDS.length; }

// Journal d'activité partagé entre les écrans (tableau de bord)
export function logEvent(type, data = {}) {
  const list = load("nukun.events", []);
  list.unshift({ id: Date.now() + Math.random(), type, at: new Date().toISOString(), ...data });
  save("nukun.events", list.slice(0, 60));
}
