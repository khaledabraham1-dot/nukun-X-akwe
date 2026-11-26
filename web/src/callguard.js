// Moteur NUKÚN-CALL GUARD : vérification de l'appelant + analyse du discours + score de risque.
// Le risque croise plusieurs indices ; un mot isolé ne suffit jamais.

// Registre de démonstration (à remplacer par un registre officiel fourni par les opérateurs)
export const REGISTRY = [
  { number: "+229 01 60 00 00 00", name: "MTN MoMo · Service client (démo)" },
  { number: "+229 01 61 00 00 00", name: "Moov Money · Service client (démo)" },
  { number: "+229 01 62 00 00 00", name: "Celtiis Cash · Service client (démo)" },
];
export const verifyCaller = (num) => REGISTRY.find((r) => r.number.replace(/\s/g, "") === String(num).replace(/\s/g, "")) || null;

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");

const OPERATOR = /\b(mtn|moov|celtiis|momo|mobile money|flooz)\b/;
const ROLE = /\b(agent|service client|conseiller|technicien|responsable|equipe|service technique|operateur)\b/;
const CODE = /\b(code|pin|mot de passe|otp|code secret|chiffres|code de (confirmation|validation|retrait))\b/;
const ASK = /\b(donne[rz]?|communique[rz]?|dite[s]?|dis|lis(ez)?|envoie[rz]?|tape[rz]?|compose[rz]?|transmet(s|tez)?|dicte[rz]?|rappele[rz]?|confirme[rz]?|faut que vous|devez|besoin)\b/;
const PREVENT = /\b(ne|n )\s*(\w+\s+){0,3}(jamais|pas|aucun)\b|\bjamais\b.{0,30}\bcode\b|\bpersonne ne\b/;
const MONEY = /\b(renvoye[zr]|renvoie[sz]?[- ]moi|remboursez|transferez|envoyez|faites un (depot|transfert)|depot (fait )?par erreur|trompe de numero|frais de deblocage)\b/;
const PRESSURE = /\b(urgent\w*|vite|immediatement|tout de suite|maintenant|sinon|bloque\w*|suspendu\w*|desactive\w*|dernier delai|dans \d+ minutes?)\b/;
const PRETEXT = /\b(probleme|erreur|anomalie|mise a jour|verification de (votre )?compte|bonus|gagne|cadeau|promotion|tirage)\b/;

export function analyzeUtterance(text) {
  const t = norm(text);
  const s = [];
  const prevention = PREVENT.test(t) && CODE.test(t);
  if (OPERATOR.test(t) && (ROLE.test(t) || /\bje (suis|travaille|vous appelle)\b/.test(t))) s.push("identity");
  if (CODE.test(t) && ASK.test(t) && !prevention) s.push("code");
  if (MONEY.test(t) && !/\bne (\w+ )?(jamais|pas)\b.{0,20}(renvoy|envoy)/.test(t)) s.push("money");
  if (PRESSURE.test(t)) s.push("pressure");
  if (PRETEXT.test(t)) s.push("pretext");
  if (prevention) s.push("prevention");
  return s;
}

export const SIGNAL_LABEL = {
  identity: "Prétend représenter un opérateur",
  code: "Demande un code confidentiel",
  money: "Demande un envoi d'argent",
  pressure: "Met la pression",
  pretext: "Invoque un faux problème ou un gain",
  prevention: "Phrase de prévention (pas une demande)",
};

// Score cumulé sur l'appel
export function scoreCall(signals, verified) {
  const has = (k) => signals.has(k);
  let score = 0;
  if (has("identity")) score += verified ? 0 : 30;
  if (has("code")) score += 40;
  if (has("money")) score += 35;
  if (has("pressure")) score += 12;
  if (has("pretext")) score += 8;
  if (verified) score -= 35;
  if (has("prevention") && !has("code") && !has("money")) score -= 10;
  score = Math.max(0, Math.min(100, score));
  let level = score >= 70 ? 3 : score >= 45 ? 2 : score >= 20 ? 1 : 0;
  if (!verified && (has("code") || has("money")) && has("identity")) level = 3; // identité douteuse + demande sensible
  return { score: level === 3 ? Math.max(score, 85) : score, level };
}

export const LEVELS = [
  { name: "Faible", desc: "Aucun signal fort détecté", action: "Surveillance", tone: "safe", color: "#22c55e" },
  { name: "Moyen", desc: "Quelques éléments inhabituels", action: "Avertissement", tone: "warn", color: "#f59e0b" },
  { name: "Élevé", desc: "Identité douteuse ou demande sensible", action: "Alerte renforcée", tone: "danger", color: "#f97316" },
  { name: "Critique", desc: "Forte suspicion de tentative de vol", action: "Protection et assistance", tone: "danger", color: "#ef4444" },
];

export const SCENARIOS = [
  {
    id: "fake", title: "Faux agent MTN MoMo", sub: "Numéro hors registre", number: "+229 01 97 48 22 14", name: "Numéro inconnu",
    lines: [
      "Bonjour monsieur, je suis un agent MTN MoMo. Je vous appelle concernant un problème sur votre compte.",
      "Vous devez me communiquer le code de confirmation que vous venez de recevoir pour débloquer votre compte.",
      "Faites vite, sinon votre compte sera bloqué dans dix minutes.",
    ],
  },
  {
    id: "deposit", title: "Faux dépôt par erreur", sub: "Numéro hors registre", number: "+229 01 52 13 77 08", name: "Numéro inconnu",
    lines: [
      "Bonjour maman, pardon, je me suis trompé de numéro, j'ai envoyé vingt-cinq mille francs sur votre compte.",
      "S'il vous plaît, renvoyez-moi l'argent, c'est urgent, c'est pour l'hôpital.",
    ],
  },
  {
    id: "real", title: "Vrai service client", sub: "Numéro officiel vérifié", number: "+229 01 60 00 00 00", name: "MTN MoMo · Service client (démo)",
    lines: [
      "Bonjour, ici le service client MTN MoMo, nous vous rappelons au sujet de votre réclamation de ce matin.",
      "Votre transfert a bien été remboursé. Rappel important : ne donnez jamais votre code secret, même à un agent.",
    ],
  },
];

export const ALERT_FR = {
  3: "Alerte critique. Identité non vérifiée. Ne communiquez aucun code PIN ni code de validation, et n'envoyez pas d'argent. Raccrochez et appelez vous-même le service officiel.",
  2: "Attention. Cet appel présente des signes d'arnaque. Ne communiquez aucun code et n'envoyez pas d'argent.",
  1: "Prudence. Quelques éléments inhabituels dans cet appel.",
};
