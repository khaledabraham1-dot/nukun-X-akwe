import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAmount, findContact, parseTransfer, parseLedgerEntry, analyzeMessage } from "./nlp.js";

const CONTACTS = [
  { id: "M012", name: "Maman Adjoa", keys: ["adjoa", "maman", "tissu"] },
  { id: "X006", name: "« Service client MTN »", keys: ["mtn", "service client", "service"] },
  { id: "I000", name: "Invest Plus 48h", keys: ["invest", "placement", "48"] },
  { id: "M040", name: "Koffi Boutique", keys: ["koffi", "boutique"] },
  { id: "A007", name: "Agent MoMo Zogbo", keys: ["zogbo", "agent momo", "point momo"] },
];

const amounts = [
  ["Envoie 12 000 à Maman Adjoa", 12000],
  ["12000 F", 12000],
  ["12.000", 12000],
  ["12 000 FCFA", 12000],
  ["envoie 25k à koffi", 25000],
  ["2,5 millions", 2500000],
  ["5 mille", 5000],
  ["vingt-cinq mille", 25000],
  ["cent cinquante mille francs", 150000],
  ["deux mille cinq cents", 2500],
  ["soixante-quinze mille", 75000],
  ["un million deux cent mille", 1200000],
  ["quatre-vingt-dix mille", 90000],
  ["vingt et un mille", 21000],
  ["j'ai vendu 3 sacs de riz à 25 000", 25000],
  ["3 sacs de riz à vingt cinq mille", 25000],
  ["2 pagnes", null],
  ["j'ai vendu deux pagnes", null],
  ["envoie 5000 au 0197123456", 5000],
  ["envoie 5000 au 01 97 12 34 56", 5000],
  ["mon numéro c'est 97123456", null],
  ["+229 0197123456 envoie dix mille", 10000],
  ["1 200 000 F", 1200000],
  ["investissez 15 000 et récupérez 60 000 en 48h", 60000],
  ["mille francs", 1000],
  ["Afi me doit 7 000", 7000],
  ["il est 18h j'ai 3 enfants", null],
  ["50 F", 50],
];
for (const [txt, exp] of amounts) test(`parseAmount « ${txt} » → ${exp}`, () => assert.equal(parseAmount(txt), exp));

test("findContact : clé la plus longue, accents et casse", () => {
  assert.equal(findContact("Envoie 12 000 à MAMAN ADJOA", CONTACTS).id, "M012");
  assert.equal(findContact("envoie au service client mtn", CONTACTS).id, "X006");
  assert.equal(findContact("paye l'agent momo de zogbo", CONTACTS).id, "A007");
  assert.equal(findContact("envoie à Koffi", CONTACTS).id, "M040");
  assert.equal(findContact("envoie à Sèna", CONTACTS), null);
  assert.equal(findContact("envoie à Adjoä", [{ id: "Z", name: "Adjoa", keys: [] }]).id, "Z");
});
test("findContact : pas de faux match dans un mot", () => {
  assert.equal(findContact("j'ai des tissus sur moi", [{ id: "T", name: "Tis", keys: ["tis"] }]), null);
});

test("parseTransfer : envoi", () => {
  const r = parseTransfer("Envoie 12 000 à Maman Adjoa", CONTACTS);
  assert.deepEqual([r.intent, r.amount, r.contact.id], ["send", 12000, "M012"]);
});
test("parseTransfer : envoi en lettres sans ponctuation", () => {
  const r = parseTransfer("transfère vingt cinq mille francs a koffi boutique", CONTACTS);
  assert.deepEqual([r.intent, r.amount, r.contact.id], ["send", 25000, "M040"]);
});
test("parseTransfer : solde", () => assert.equal(parseTransfer("quel est mon solde", CONTACTS).intent, "balance"));
test("parseTransfer : combien il me reste", () => assert.equal(parseTransfer("combien il me reste", CONTACTS).intent, "balance"));
test("parseTransfer : frais", () => {
  const r = parseTransfer("combien coûte l'envoi de 50 000 à Koffi", CONTACTS);
  assert.deepEqual([r.intent, r.amount], ["fees", 50000]);
});
test("parseTransfer : inconnu", () => assert.equal(parseTransfer("bonjour comment ça va", CONTACTS).intent, "unknown"));

test("ledger : vente pagnes momo", () => {
  const r = parseLedgerEntry("J'ai vendu 3 pagnes à 25 000 par MoMo");
  assert.deepEqual([r.type, r.amount, r.quantity, r.item, r.channel], ["vente", 25000, 3, "pagnes", "mobile money"]);
});
test("ledger : vente en lettres, espèces", () => {
  const r = parseLedgerEntry("vendu deux sacs de riz à cinquante mille");
  assert.deepEqual([r.type, r.amount, r.quantity, r.item, r.channel], ["vente", 50000, 2, "sacs de riz", "espèces"]);
});
test("ledger : dette", () => {
  const r = parseLedgerEntry("Afi me doit 7 000");
  assert.deepEqual([r.type, r.amount, r.who], ["dette", 7000, "Afi"]);
});
test("ledger : dette avec titre", () => {
  const r = parseLedgerEntry("maman Sika me doit quinze mille");
  assert.deepEqual([r.type, r.amount, r.who], ["dette", 15000, "Maman Sika"]);
});
test("ledger : vendu à crédit", () => {
  const r = parseLedgerEntry("j'ai donné 2 pagnes à crédit à Rachida pour 18000");
  assert.deepEqual([r.type, r.amount, r.who], ["dette", 18000, "Rachida"]);
});
test("ledger : remboursement", () => {
  const r = parseLedgerEntry("Koffi m'a remboursé 5000");
  assert.deepEqual([r.type, r.amount, r.who], ["remboursement", 5000, "Koffi"]);
});
test("ledger : remboursement par momo", () => {
  const r = parseLedgerEntry("Afi m'a rendu 3000 par momo");
  assert.deepEqual([r.type, r.amount, r.who, r.channel], ["remboursement", 3000, "Afi", "mobile money"]);
});
test("ledger : dépense transport", () => {
  const r = parseLedgerEntry("j'ai payé le transport 2000");
  assert.deepEqual([r.type, r.amount, r.item], ["dépense", 2000, "transport"]);
});
test("ledger : achat tissu", () => {
  const r = parseLedgerEntry("J'ai acheté du tissu pour 40 000");
  assert.deepEqual([r.type, r.amount, r.item], ["dépense", 40000, "tissu"]);
});
test("ledger : loyer", () => {
  const r = parseLedgerEntry("loyer de la boutique 30 mille");
  assert.deepEqual([r.type, r.amount, r.item], ["dépense", 30000, "loyer"]);
});
test("ledger : type inconnu", () => assert.equal(parseLedgerEntry("bonjour 5000").type, null));
test("ledger : quantité sans montant", () => {
  const r = parseLedgerEntry("j'ai vendu 2 pagnes");
  assert.deepEqual([r.type, r.amount, r.quantity], ["vente", null, 2]);
});

const scams = [
  ["Bonjour, c'est le service client MTN. Un dépôt de 25 000 F a été fait par erreur sur votre compte, renvoyez-le vite au 0197XXXXXX sinon votre compte sera bloqué.", "high", ["faux_depot", "faux_agent"]],
  ["INVEST PLUS : investissez 15 000 F aujourd'hui et récupérez 60 000 F en 48h, rendement garanti. Rejoignez notre groupe WhatsApp.", "high", ["faux_investissement"]],
  ["Prêt immédiat sans garantie jusqu'à 500 000 F. Payez seulement 5 000 F de frais de déblocage par MoMo pour recevoir votre crédit.", "high", ["faux_credit"]],
  ["Vous avez reçu 50 000 F de 0196554433. Nouveau solde 50 650 F. Ref 88213", "mid", ["faux_sms_operateur"]],
  ["bonsoir je me suis trompé de numéro j'ai envoyé 20000 sur ton compte stp renvoie moi ça", "high", ["faux_depot"]],
  ["ici moov money pour valider votre bonus donnez le code que vous allez recevoir par sms", "high", ["code_secret"]],
  ["Rappelez-nous pour confirmer la transaction, sinon elle sera annulée", "mid", ["confirmation_appel"]],
  ["Recrutement urgent société minière 15 postes disponibles frais de dossier 10 000 F à envoyer par momo", "high", ["faux_recrutement"]],
  ["Félicitations vous avez gagné 500 000 F au tirage MTN. Payez 7500 F de frais pour retirer votre lot", "high", ["faux_gain"]],
  ["Votre compte MoMo sera suspendu dans les 24h. Transférez votre solde vers le numéro de sécurité 0167000000", "high", ["numero_depannage", "chantage_blocage"]],
  ["bonus fidélité celtiis de 10 000 F : composez *880*1*0167223344*5000# pour activer", "high", ["faux_bonus"]],
  ["votre puce sera désactivée appelez immédiatement notre technicien moov", "high", ["chantage_blocage"]],
];
for (const [txt, lvl, ids] of scams) test(`arnaque (${lvl}) : ${txt.slice(0, 50)}…`, () => {
  const r = analyzeMessage(txt);
  assert.equal(r.level, lvl, JSON.stringify(r.hits.map((h) => h.id)));
  for (const id of ids) assert.ok(r.hits.some((h) => h.id === id), `${id} attendu, obtenu ${r.hits.map((h) => h.id)}`);
  for (const h of r.hits) assert.ok(h.why && h.tip);
});

const safe = [
  "je t'envoie l'argent ce soir",
  "ton dépôt de 5000 est arrivé merci",
  "Bonjour maman, je passe récupérer les pagnes demain matin, je t'envoie l'argent ce soir.",
  "J'ai payé l'agent MoMo de Zogbo ce matin, tout est bon",
  "On se voit au marché Dantokpa samedi, apporte les tissus",
  "Merci pour les 3 pagnes, je te rembourse la semaine prochaine sans faute",
  "le code de la porte c'est le même que d'habitude",
];
for (const txt of safe) test(`message normal : ${txt.slice(0, 50)}`, () => {
  const r = analyzeMessage(txt);
  assert.equal(r.level, "low", JSON.stringify(r.hits.map((h) => h.id)));
});
test("analyzeMessage : texte vide", () => assert.deepEqual(analyzeMessage(""), { level: "low", score: 0, hits: [] }));
test("ledger : bidons d'huile", () => {
  const r = parseLedgerEntry("vente de 4 bidons d'huile 20 mille momo");
  assert.deepEqual([r.type, r.amount, r.quantity, r.item, r.channel], ["vente", 20000, 4, "bidons d'huile", "mobile money"]);
});
test("ledger : je dois à tonton Paul", () => {
  const r = parseLedgerEntry("je dois 5000 à tonton Paul");
  assert.deepEqual([r.type, r.amount, r.who], ["dette", 5000, "Tonton Paul"]);
});
test("message normal : compte bloqué raconté", () => assert.equal(analyzeMessage("mon compte est bloqué depuis hier tu peux m'aider").level, "low"));
test("message normal : code promo", () => assert.equal(analyzeMessage("envoie moi le code promo du resto").level, "low"));
