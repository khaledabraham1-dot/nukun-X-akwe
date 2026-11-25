// NUKÚN : compréhension du français dans le navigateur, sans serveur ni dépendance.
// Pensé pour le texte de la reconnaissance vocale Chrome (fr-FR) : pas de ponctuation,
// nombres en lettres, « momo », fautes de frappe courantes.

// ---------------------------------------------------------------------------
// Outils de normalisation
// ---------------------------------------------------------------------------

/** Minuscules, sans accents, apostrophes et espaces unifiés. */
export function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/[’‘`´]/g, "'")
    .replace(/[  \t\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---------------------------------------------------------------------------
// Montants
// ---------------------------------------------------------------------------

const UNITS = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, septante: 70, huitante: 80, octante: 80, nonante: 90,
};
const MULT = { cent: 100, cents: 100, mille: 1000, mil: 1000, k: 1000, million: 1e6, millions: 1e6, milliard: 1e9, milliards: 1e9 };
const CURRENCY = new Set(["f", "fr", "frs", "fcfa", "cfa", "franc", "francs", "xof", "balles"]);

// Mots après un nombre qui indiquent une durée, un pourcentage, un rang : jamais un montant.
const NOT_MONEY = new Set([
  "h", "heure", "heures", "min", "minute", "minutes", "jour", "jours", "j", "semaine", "semaines", "mois", "an", "ans", "annee", "annees",
  "fois", "personne", "personnes", "%", "pour", "pourcent", "pourcents", "eme", "e", "er", "ere", "x",
]);
// Mots après un nombre qui laissent le nombre être un montant (pas une quantité de marchandise).
const AFTER_MONEY_OK = new Set([
  "a", "au", "aux", "par", "pour", "de", "d", "du", "en", "sur", "et", "avec", "via", "sans", "chez", "ce", "cette", "hier", "aujourd'hui",
  "aujourd", "demain", "ou", "a", "le", "la", "les", "l", "s'il", "svp", "stp", "merci", "momo", "mobile", "cash", "espece", "especes",
  "comptant", "seulement", "maintenant", "tout", "plus", "moins", "frais", "chacun", "chacune", "piece", "l'unite", "unite", "le", "deja",
]);
// Unités de marchandise : le nombre devant est une quantité.
const QTY_UNITS = /^(sacs?|pagnes?|cartons?|bidons?|paniers?|boites?|kilos?|kg|kilogrammes?|metres?|m|pieces?|litres?|l|bouteilles?|paquets?|tas|bassines?|seaux?|douzaines?|tonnes?|yards?|rouleaux?|caisses?|plateaux?|unites?|articles?|tissus?|complets?|robes?|chemises?|pantalons?|paires?|tubercules?|regimes?|boules?|morceaux?|plats?|assiettes?|sachets?|savons?|pots?|tasses?|verres?|mesures?|bols?|clients?|enfants?|poulets?|oeufs?|tomates?|ignames?|ananas|mangues?|oranges?)$/;

/** Retire les numéros de téléphone (8 à 10 chiffres, ou commençant par 01 / 229). */
function stripPhones(t) {
  return t
    .replace(/\+?\b229[\s.]?(?:\d[\s.]?){8,10}/g, " ")
    .replace(/\b01(?:[\s.]?\d{2}){4}\b/g, " ")
    .replace(/\b01\d*x{2,}\b/g, " ")
    .replace(/\b\d{2}(?:[\s.]\d{2}){3}\b(?!\s*(?:f|fcfa|francs?|cfa)\b)/g, " ")
    .replace(/\b0?1\d{8}\b/g, " ")
    .replace(/\b\d{8,10}\b(?!\s*(?:f|fr|frs|fcfa|francs?|cfa|xof)\b)/g, " ");
}

/** Découpe en jetons où chaque nombre (chiffres et/ou lettres) devient {n, start, end}. */
function numberTokens(text) {
  let t = normalize(text);
  t = stripPhones(t);
  // décimales devant un multiplicateur : « 2,5 millions », « 1.5 k »
  t = t.replace(/(\d)[,.](\d{1,2})(?=\s*(?:k|mille|millions?|milliards?)\b)/g, "$1#$2");
  // séparateurs de milliers : « 12 000 », « 12.000 », « 1 200 000 », « 12,000 »
  for (let i = 0; i < 3; i++) t = t.replace(/(\d)[ .,](?=\d{3}(?!\d))/g, "$1");
  t = t.replace(/#/g, ".");
  t = t.replace(/(\d)([a-z%])/g, "$1 $2").replace(/([a-z])(\d)/g, "$1 $2");
  t = t.replace(/-/g, " ").replace(/[^a-z0-9.%' ]/g, " ").replace(/\.(?!\d)/g, " ");
  const words = t.split(/\s+/).filter(Boolean);

  const out = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    const isDigit = /^\d+(\.\d+)?$/.test(w);
    const isWordNum = w in UNITS || (w in MULT && w !== "k" && w !== "mil");
    if (!isDigit && !isWordNum) { out.push({ w }); i++; continue; }
    // une suite de mots-nombres = un seul nombre
    let total = 0, cur = 0, j = i, prev = null, hasMult = false;
    while (j < words.length) {
      const x = words[j];
      if (/^\d+(\.\d+)?$/.test(x)) {
        if (prev !== null && !(prev === "mille" || prev === "million" || prev === "millions" || prev === "milliard" || prev === "milliards")) break;
        cur += parseFloat(x);
      } else if (x in UNITS) {
        if (prev !== null && /^\d/.test(prev)) break; // « 3 deux » : deux nombres distincts
        if ((x === "vingt" || x === "vingts") && prev === "quatre") cur += 76;
        else cur += UNITS[x];
      } else if (x === "et" && prev !== null && j + 1 < words.length && /^(un|une|onze)$/.test(words[j + 1])) {
        // « vingt et un »
      } else if (x === "cent" || x === "cents") {
        if (prev !== null && /^\d/.test(prev)) break;
        cur = (cur || 1) * 100; hasMult = true;
      } else if (x === "mille" || x === "mil" || x === "k") {
        if (x !== "mille" && prev === null) break;
        total += (cur || 1) * 1000; cur = 0; hasMult = true;
      } else if (/^millions?$|^milliards?$/.test(x)) {
        total += (cur || 1) * MULT[x]; cur = 0; hasMult = true;
      } else break;
      prev = x; j++;
    }
    if (j === i) { out.push({ w }); i++; continue; }
    out.push({ n: Math.round(total + cur), raw: words.slice(i, j).join(" "), hasMult });
    i = j;
  }
  return out;
}

/** Classe chaque nombre : montant possible, quantité, ou autre (durée, pourcentage). */
function classifyNumbers(text) {
  const toks = numberTokens(text);
  const res = [];
  toks.forEach((tk, idx) => {
    if (tk.n == null) return;
    const next = toks[idx + 1]?.w || "";
    const next2 = toks[idx + 2]?.w || "";
    const prevW = toks[idx - 1]?.w || "";
    const currency = CURRENCY.has(next);
    let kind;
    if (currency) kind = "money";
    else if (NOT_MONEY.has(next) || (next === "pour" && /^(cent|100)$/.test(next2))) kind = "other";
    else if (QTY_UNITS.test(next) && !tk.hasMult) kind = "qty";
    else if (/^(un|une)$/.test(tk.raw)) kind = "qty"; // article « un pagne »
    else if (!next || AFTER_MONEY_OK.has(next) || tk.n >= 100 || tk.hasMult) kind = "money";
    else kind = "qty";
    res.push({ n: tk.n, kind, currency, next, prevW });
  });
  return res;
}

/**
 * Montant en FCFA (entier) ou null.
 * « Envoie 12 000 à Maman » → 12000 ; « 3 sacs de riz à 25 000 » → 25000 ; « 2 pagnes » → null.
 */
export function parseAmount(text) {
  const nums = classifyNumbers(text);
  const withCur = nums.filter((x) => x.kind === "money" && x.currency && x.n > 0);
  if (withCur.length) return Math.max(...withCur.map((x) => x.n));
  const money = nums.filter((x) => x.kind === "money" && x.n >= 100);
  return money.length ? Math.max(...money.map((x) => x.n)) : null;
}

// ---------------------------------------------------------------------------
// Contacts et virements
// ---------------------------------------------------------------------------

/** Meilleur contact (clé la plus longue trouvée, sans casse ni accents) ou null. */
export function findContact(text, contacts = []) {
  const t = " " + normalize(text).replace(/[^a-z0-9' ]/g, " ") + " ";
  let best = null, len = 0;
  for (const c of contacts || []) {
    const keys = [...(c.keys || [])];
    if (c.name) keys.push(c.name);
    for (const k of keys) {
      const nk = normalize(k).replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim();
      if (!nk) continue;
      const re = new RegExp("[^a-z0-9]" + nk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (/^\d+$/.test(nk) ? "" : "(?=[^a-z0-9]|s[^a-z0-9])"));
      if (re.test(t) && nk.length > len) { best = c; len = nk.length; }
    }
  }
  return best;
}

/** Intention d'un ordre vocal : envoi, solde, frais. */
export function parseTransfer(text, contacts = []) {
  const t = normalize(text);
  const amount = parseAmount(text);
  const contact = findContact(text, contacts);
  let intent = "unknown";
  const fees = /\b(frais|tarifs?|commissions?|combien (ca |ça )?(coute|coutera|me coute|fait)|ca coute combien|coute combien|cout de)\b/.test(t);
  const balance = /\b(solde|combien (il )?(me reste|j'ai|ai je|j ai)|qu'est ce qu'il me reste|reste sur mon compte|mon compte contient)\b/.test(t);
  const send = /\b(envo\w*|transf[eè]r\w*|transfer\w*|vir(e|er|ez|ement)|paye\w*|payer|donne\w*|depose\w*|fais passer|fait passer|faire passer|balance|send|rembourse\w*|regle\w*)\b/.test(t);
  if (fees) intent = "fees";
  else if (balance && !(send && amount)) intent = "balance";
  else if (send || (amount && contact)) intent = "send";
  return { intent, amount, contact };
}

// ---------------------------------------------------------------------------
// Cahier vocal (Akwɛ)
// ---------------------------------------------------------------------------

const DET = new Set(["le", "la", "les", "l", "du", "de", "des", "d", "un", "une", "mon", "ma", "mes", "son", "sa", "ses", "notre", "nos", "ce", "cet", "cette", "ces", "au", "aux"]);
const NOT_ITEM = new Set([
  "a", "par", "pour", "en", "et", "avec", "aujourd'hui", "aujourd", "hier", "ce", "matin", "soir", "momo", "mobile", "money", "cash", "especes",
  "espece", "francs", "franc", "f", "fcfa", "cfa", "mille", "client", "cliente", "clients", "il", "elle", "lui", "on", "tout", "quelque", "chose",
  "credit", "dette", "argent", "somme", "montant", "telephone", "moov", "mtn", "celtiis", "flooz", "je", "j", "me", "m", "maman", "papa",
]);
const PRONOUNS = new Set(["il", "elle", "on", "ils", "elles", "quelqu'un", "client", "cliente", "le", "la", "lui", "personne", "ca", "qui", "je", "j", "tu", "vous"]);
const TITLES = "(?:maman|mama|mami|papa|tonton|tata|tantie|tanti|madame|mme|monsieur|mr|dame|frere|soeur|vieux|vieille|dada|daavi|fofo|da)";
const NAME = `((?:${TITLES}\\s+)?[a-z][a-z'-]+)`;

function originalWords(text) {
  // mots du texte d'origine (avec accents et majuscules), indexés par leur forme normalisée
  const map = new Map();
  for (const w of String(text || "").replace(/[’]/g, "'").split(/[^\p{L}\p{N}'-]+/u)) {
    const k = normalize(w);
    if (k && !map.has(k)) map.set(k, w);
  }
  return map;
}
function restore(phrase, map) {
  return phrase.split(" ").map((w) => { const o = map.get(w) || w; return o; }).join(" ");
}
function personName(raw, map) {
  if (!raw) return "";
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1 && PRONOUNS.has(parts[0])) return "";
  if (parts.some((p) => /^\d/.test(p))) return "";
  return restore(parts.join(" "), map).split(" ").map(cap).join(" ");
}

/**
 * Écriture du cahier : { type, amount, channel, item, quantity, who }.
 * type : "vente" | "dépense" | "dette" | "remboursement" | null
 */
export function parseLedgerEntry(text) {
  const t = normalize(text).replace(/[^a-z0-9' -]/g, " ").replace(/\s+/g, " ");
  const map = originalWords(text);
  const amount = parseAmount(text);

  let type = null;
  const owedToMe = /\bme doi(t|vent)\b|\bdoi(t|vent) me\b|\ba credit\b|\bpas encore (paye|regle|verse)\b|\bj'ai prete\b|\bprete a\b|\bm'a emprunte\b|\bdette\b|\bje (lui )?dois\b|\bj'ai emprunte\b|\bnote dans le cahier\b/;
  if (/\bremb(ou|ou)rs\w*|\bm'a (rendu|regle sa dette|paye sa dette|solde)|\ba (rendu|solde|regle) (sa|son|ses) (dette|credit)|\bce qu'(il|elle) me devait\b|\bm'a (paye|verse|regle) (ce qu|sa|son|les)/.test(t)) type = "remboursement";
  else if (owedToMe.test(t)) type = "dette";
  else if (/\bvendu\w*|\bvente\w*|\bvend(s|u)?\b|\bencaiss\w*|\bj'ai gagne\b|\brecette\w*|\bun client m'a (paye|envoye)|\bclient\w* m'a (paye|envoye|regle)/.test(t)) type = "vente";
  else if (/\bachet\w*|\bachat\w*|\bdepens\w*|\bpaye\w*|\bpayer\b|\bregle\w*|\bloyer\b|\btransport\b|\bfacture\b|\bcarburant\b|\bessence\b|\bsortie\b|\bdonne\b.*\bpour\b/.test(t)) type = "dépense";

  const channel = /\b(momo|mo mo|mobile money|mobile|par telephone|moov|mtn|celtiis|flooz|wave|transfert|par transfert|envoye sur mon (compte|numero)|sur mon compte)\b/.test(t) ? "mobile money" : "espèces";

  // Quantité + article : « 3 pagnes », « deux sacs de riz »
  let quantity = null, item = "";
  const toks = numberTokens(text);
  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i];
    if (tk.n == null || tk.hasMult) continue;
    const nx = toks[i + 1]?.w;
    if (!nx || NOT_MONEY.has(nx) || CURRENCY.has(nx) || AFTER_MONEY_OK.has(nx) || NOT_ITEM.has(nx) || DET.has(nx)) continue;
    if (tk.n >= 1000) continue;
    if (/^(un|une)$/.test(tk.raw) && !QTY_UNITS.test(nx) && type !== "vente" && type !== "dépense") continue;
    if (!/^[a-z][a-z']+$/.test(nx)) continue;
    quantity = tk.n;
    item = nx;
    const a = toks[i + 2]?.w, b = toks[i + 3]?.w;
    if ((a === "de" || a === "d") && b && /^[a-z]{3,}$/.test(b) && !NOT_ITEM.has(b)) item = `${nx} de ${b}`;
    else if (a && /^d'[a-z]{3,}$/.test(a)) item = `${nx} ${a}`;
    break;
  }
  if (!item) {
    const m = t.match(/\b(?:vendu|vendre|vends|vente|achete|acheter|achat|paye|payer|regle|depense|depenser|depenses)\s+(?:pour\s+|de\s+)?((?:[a-z']+\s+){0,3})/);
    if (m) {
      const words = m[1].trim().split(/\s+/).filter(Boolean);
      for (const w of words) {
        const base = w.replace(/^(l|d)'/, "");
        if (DET.has(w) || DET.has(base) || w === "de" || w === "la") continue;
        if (!NOT_ITEM.has(base) && /^[a-z]{3,}$/.test(base) && !/^(a|par|pour)$/.test(base) && !(base in UNITS)) item = base;
        break;
      }
      if (/\bpaye\b/.test(m[0]) && /^(a|pour)$/.test(words[0] || "")) item = "";
    }
    if (!item) {
      const kw = t.match(/\b(loyer|transport|electricite|courant|eau|essence|carburant|marchandise|tissu|pagnes?|stock|taxe|ticket|impot|nourriture|salaire|communication|credit telephone)\b/);
      if (kw && type !== "dette" && type !== "remboursement") item = kw[1];
    }
    if (item) item = restore(item, map);
  } else item = restore(item, map);

  // Qui ?
  let who = "";
  const patterns = [
    new RegExp(`${NAME}\\s+me doi(?:t|vent)\\b`),
    new RegExp(`${NAME}\\s+doit me\\b`),
    new RegExp(`${NAME}\\s+m'a\\s+(?:rembourse|rendu|paye|regle|verse|emprunte|solde)`),
    new RegExp(`${NAME}\\s+a\\s+(?:rembourse|rendu|solde|regle|paye)`),
    new RegExp(`(?:^|\\s)(?:a|au)\\s+${NAME}`),
    new RegExp(`\\bdette\\s+(?:de|d')\\s*${NAME}`),
  ];
  if (type === "dette" || type === "remboursement") {
    for (const re of patterns) {
      for (const m of t.matchAll(new RegExp(re.source, "g"))) {
        let raw = m[1].replace(/^(?:et|mais|donc|alors|oui|bon|aujourd'hui|hier)\s+/, "");
        if (/^(j'ai|j|je|il|elle)$/.test(raw)) continue;
        // éviter « à 25 000 » ou « à crédit »
        if (/^(credit|cause|cote|moi|toi|lui|elle|eux)$/.test(raw.split(" ").pop())) continue;
        who = personName(raw, map);
        if (who) break;
      }
      if (who) break;
    }
  }

  return { type, amount, channel, item, quantity, who };
}

// ---------------------------------------------------------------------------
// Détection d'arnaques mobile money
// ---------------------------------------------------------------------------

const OP = "(?:mtn|moov|celtiis|momo|mobile money|flooz|moov money|mtn money)";

export const SCAM_RULES = [
  {
    id: "faux_depot", w: 3,
    re: /(erreur|trompe|me suis trompe|mauvais numero|pas pour (toi|vous)).{0,60}(depot|envoi|transfert|numero|argent|compte|somme)/,
    why: "On parle d'un dépôt « fait par erreur » sur votre compte",
    tip: "Vérifiez votre vrai solde avec le code officiel de votre opérateur, pas avec le SMS. Si l'erreur est réelle, l'opérateur l'annule lui-même : ne renvoyez rien.",
  },
  {
    id: "demande_renvoi", w: 2,
    re: /renvo(ie|ies|yer|yez|ye)\b.{0,40}(argent|somme|montant|depot|\d|moi (ca|le|la|l'argent|mon argent)|le moi|la moi)|(retourne[rz]?|rembourse[rz]?|restitue[rz]?)\b.{0,30}(l'argent|la somme|le montant|le depot|le transfert)/,
    why: "On vous demande de renvoyer de l'argent",
    tip: "Ne renvoyez jamais un montant sans avoir vérifié vous-même votre solde. Un faux SMS de dépôt suffit à piéger quelqu'un.",
  },
  {
    id: "manipulation_ussd", w: 3,
    re: /\*\d{2,4}\*\d+\*[\d*#x]+/,
    why: "On vous dicte une manipulation (code étoile) à taper",
    tip: "Ces codes peuvent déclencher un transfert depuis votre compte. Ne tapez jamais un code étoile envoyé par un inconnu.",
  },
  {
    id: "faux_sms_operateur", w: 2,
    test: (t) =>
      /(vous avez recu|depot (recu|de|effectue)|transfert recu|nouveau solde|transaction (reussie|id)|id transaction|ref ?:?\s?\d)/.test(t) &&
      /(erreur|renvo|rappel|appelez|contactez|numero|\b0?1\d{6,}|\+229|confirm|annul|bloqu)/.test(t),
    why: "Ce message imite un SMS de dépôt de l'opérateur",
    tip: "Un vrai SMS de dépôt vient de l'expéditeur officiel (MobileMoney, Moov Money), jamais d'un numéro ordinaire. Consultez votre solde vous-même avant toute action.",
  },
  {
    id: "code_secret", w: 3,
    re: /(donne|donnez|envoie|envoyez|communique|communiquez|confirme|confirmez|tape|tapez|saisis|saisissez|dicte|dictez|transmet|transmettez|partage|partagez|indique|indiquez|lis|lisez|redonne|repete|repetez)\w*\s.{0,30}(code(?! promo| de la porte| wifi)|pin|mot de passe|otp|chiffres recus)|code (secret|pin|de confirmation|de validation|de retrait|recu par sms|a \d chiffres|otp)|\b(ton|votre) (code|pin|mot de passe)\b|\bpin\b|\botp\b|mot de passe/,
    why: "On vous demande votre code secret ou un code reçu par SMS",
    tip: "Personne de MTN, Moov ou Celtiis ne vous demandera jamais votre code. Ne le donnez à personne, même à un « agent ».",
  },
  {
    id: "confirmation_appel", w: 2,
    re: /(appel\w*|rappel\w*|contact\w*|joign\w*|whatsapp\w*)[\s-].{0,40}(confirm\w*|valid\w*|debloqu\w*|activ\w*|verifi\w*|recevoir|retirer)|confirm\w*.{0,30}par (appel|telephone|whatsapp)/,
    why: "On vous demande de « confirmer » par un appel ou une manipulation",
    tip: "Ne suivez jamais une manipulation dictée au téléphone : elle sert souvent à vous faire envoyer de l'argent sans vous en rendre compte.",
  },
  {
    id: "faux_agent", w: 2,
    re: new RegExp(`(service client\\w*|service technique|technicien|responsable|conseiller|direction|equipe|agence|centre d'appel|support)\\s*(de |d'|du )?(la )?${OP}|(je suis|c'est|ici|nous sommes|de la part)\\s+(de |d'|du |un |l'|le )?(agent|service|technicien)?\\s*(de |d'|du )?${OP}\\b|\\b(mtn|moov|celtiis)\\s+(service|agent|support|securite|info)`),
    why: "Quelqu'un se présente comme l'opérateur",
    tip: "Raccrochez et appelez vous-même le service client officiel de votre opérateur à partir du numéro inscrit sur son site ou en agence.",
  },
  {
    id: "numero_depannage", w: 3,
    re: /numero (de |d')?(depannage|assistance|support|service|reclamation|verification|securite|secours|recuperation)|(envoy|transfer|depos|vers|versez)\w*.{0,50}(numero|compte) (de |d')?(securite|depannage|securisation|verification|assistance|secours|tampon|temporaire)|compte (securise|de securite|tampon|temporaire)|mettre (votre|ton) argent (a l'abri|en securite)/,
    why: "On vous demande de transférer vers un numéro « de dépannage » ou « de sécurité »",
    tip: "Un opérateur ne fait jamais déplacer votre argent vers un autre numéro pour le protéger. C'est un vol : ne transférez rien.",
  },
  {
    id: "chantage_blocage", w: 2,
    re: /(compte|sim|puce|numero|ligne|portefeuille)\s.{0,40}(sera|va etre|vont etre|seront|risque d'etre|risquez|est en cours de) (bloque|suspendu|desactive|ferme|supprime|gele|resilie)|(allons|va|vont|devons|risque de) (bloquer|suspendre|desactiver|fermer|supprimer)\s.{0,30}(compte|sim|puce|ligne|numero)|(sinon|faute de quoi).{0,40}(bloque|suspendu|desactive|ferme|supprime)/,
    why: "Menace de blocage de votre compte ou de votre puce",
    tip: "Un opérateur ne bloque pas un compte par SMS en exigeant une action immédiate. Rendez-vous en agence officielle pour vérifier.",
  },
  {
    id: "urgence", w: 1,
    re: /\burgent\w*|\bimmediatement\b|\btout de suite\b|\bdernier delai\b|\bsans delai\b|\bdans les \d+ ?(min|minutes|h|heures)\b|\bavant (ce soir|minuit|demain|\d+ ?h)\b|\bsinon\b|\bderniere chance\b|\bvite vite\b/,
    why: "Pression et urgence",
    tip: "Les arnaqueurs pressent pour vous empêcher de réfléchir. Prenez le temps de vérifier auprès d'un proche ou en agence.",
  },
  {
    id: "faux_investissement", w: 3,
    re: /\b(doubl|tripl|quadrupl|multipli)\w*\s.{0,40}(argent|mise|investissement|capital|somme|en \d+|gains?)|\bx ?[2-9]\b.{0,20}(en|sous|dans) \d+|rendement|(gain|benefice|profit|retour|interet)s? garanti|garanti\w* a 100|\d+ ?% (par|chaque|tous les) (jour|semaine|mois)|(invest|plac|mise[rz]?|misez)\w*\s.{0,80}(recup|recev|gagn|rapport|touch)\w*\s.{0,40}\d|(recuperez|recevez|touchez|gagnez) \d+.{0,30}en \d+ ?(h|heures|jours)|\b(trading|forex|crypto|bitcoin)\b.{0,60}(gagn|benefice|profit)/,
    why: "Promesse de gain rapide ou garanti",
    tip: "Aucun placement honnête ne double votre argent en quelques jours. C'est le signe d'une arnaque de type Ponzi : vous perdrez votre mise.",
  },
  {
    id: "faux_credit", w: 3,
    re: /(pret|credit|financement|microcredit|micro credit|avance)\w*\s.{0,80}(sans garantie|sans justificatif|sans condition|immediat|rapide|en \d+ ?(min|minutes|h|heures)|frais|deblocage)|frais (de |d')(dossier|deblocage|activation|ouverture|assurance|traitement|validation|decaissement)/,
    why: "Fausse offre de crédit avec frais à payer d'avance",
    tip: "Une vraie microfinance ne demande pas de payer des « frais de déblocage » par mobile money avant le prêt. Allez en agence agréée.",
  },
  {
    id: "faux_recrutement", w: 3,
    re: /(recrut|emploi|embauche|poste|job|travail|stage|offre d'emploi|travailler)\w*\s.{0,100}(frais|payer|paiement|cotisation|inscription payante|formation payante|versez|deposez)|frais (de |d')(inscription|formation|tenue|badge|visite medicale|candidature|placement).{0,80}(emploi|poste|recrut|travail|job|stage)?/,
    why: "Offre d'emploi qui demande de payer d'abord",
    tip: "Un vrai employeur ne fait jamais payer pour être embauché. Ne versez aucun frais d'inscription, de badge ou de formation.",
  },
  {
    id: "faux_gain", w: 2,
    re: /felicitations|vous avez (ete )?(gagne|selectionne)|tu as gagne|(vous etes|tu es) (l'heureux |le grand |le )?gagnant|tirage au sort|loterie|\bgagne (un|une|\d)|\bgros lot\b/,
    why: "Faux gain : vous auriez gagné sans avoir joué",
    tip: "Vous ne pouvez pas gagner à un jeu auquel vous n'avez pas joué. Ne payez aucun frais pour « retirer » un lot.",
  },
  {
    id: "faux_bonus", w: 2,
    re: /(bonus|cashback|prime|credit gratuit|forfait gratuit|offert|cadeau|recompense)\w*\s.{0,60}(activ|reclam|recevoir|recevez|debloq|valid|envoy|compos|cliqu|retir|payer|frais)/,
    why: "Faux bonus à « activer »",
    tip: "Les vrais bonus de l'opérateur arrivent seuls. S'il faut envoyer de l'argent ou un code pour les « activer », c'est une arnaque.",
  },
  {
    id: "payer_pour_recevoir", w: 3,
    re: /(pay|envoy|regl|vers|depos|transfer)\w*\s.{0,50}(frais|\d).{0,60}(pour|afin de|avant de) (recevoir|debloquer|retirer|toucher|activer|liberer|obtenir)/,
    why: "On vous demande de payer pour recevoir de l'argent",
    tip: "Si l'on vous doit vraiment de l'argent, on ne vous demande rien en échange. Payer d'abord, c'est perdre son argent.",
  },
  {
    id: "lien", w: 1,
    re: /https?:|www\.|bit\.ly|wa\.me|t\.me|tinyurl|cliquez|clique (ici|sur)|\blien\b|groupe whatsapp|telegram/,
    why: "Lien ou redirection vers une messagerie",
    tip: "N'ouvrez pas de lien reçu d'un inconnu et ne rejoignez pas de groupe pour « gagner ».",
  },
  {
    id: "secret", w: 1,
    re: /ne (le )?(dites|dis) (rien|a personne)|n'en parlez a personne|gardez (le |ca )?(secret|pour vous)|strictement confidentiel/,
    why: "On vous demande de garder le secret",
    tip: "Parlez-en à un proche avant d'agir : un arnaqueur veut vous isoler.",
  },
];

/**
 * Analyse d'un message reçu.
 * Renvoie { level: "high"|"mid"|"low", score, hits: [{ id, why, tip, w }] }.
 */
export function analyzeMessage(text) {
  const t = normalize(text);
  if (!t) return { level: "low", score: 0, hits: [] };
  const hits = SCAM_RULES.filter((r) => (r.test ? r.test(t) : r.re.test(t))).map(({ id, why, tip, w }) => ({ id, why, tip, w }));
  // le plus grave d'abord
  hits.sort((a, b) => b.w - a.w);
  const score = hits.reduce((s, h) => s + h.w, 0);
  const strong = hits.some((h) => h.w >= 3);
  const level = score >= 5 || (strong && hits.length >= 2) ? "high" : score >= 2 || strong ? "mid" : "low";
  return { level, score, hits };
}

// Alias compatibles avec l'existant (Akwe.jsx : parseEntry)
export const parseEntry = parseLedgerEntry;
