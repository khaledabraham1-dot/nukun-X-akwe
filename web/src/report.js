import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { load } from "./lib.js";

const F = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n)).replace(/ | /g, " ") + " F";

// Rapport de chiffre d'affaires généré à partir du cahier Akwɛ
export function downloadReport(user, days = 30) {
  const since = Date.now() - days * 86400e3;
  const all = load("akwe.entries2", []).filter((e) => e.status === "confirmée");
  const rows = all.filter((e) => e.at >= since).sort((a, b) => a.at - b.at);
  const sum = (t) => rows.filter((e) => e.type === t).reduce((s, e) => s + e.amount, 0);
  const sales = sum("vente"), spend = sum("dépense"), debts = Math.max(0, sum("dette") - sum("remboursement"));
  const momo = rows.filter((e) => e.type === "vente" && e.channel === "mobile money").reduce((s, e) => s + e.amount, 0);
  const saleDays = new Set(rows.filter((e) => e.type === "vente").map((e) => new Date(e.at).toDateString())).size;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(11, 31, 58); doc.rect(0, 0, W, 110, "F");
  doc.setFillColor(247, 197, 72); doc.rect(0, 110, W, 4, "F");
  doc.setTextColor(247, 197, 72); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("NUKUN x AKWE  |  RAPPORT D'ACTIVITE", 40, 40);
  doc.setTextColor(255, 255, 255); doc.setFontSize(22);
  doc.text("Chiffre d'affaires", 40, 70);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  const period = `Du ${new Date(since).toLocaleDateString("fr-FR")} au ${new Date().toLocaleDateString("fr-FR")}`;
  doc.text(`${user?.name || "Commerçant(e)"}${user?.activity ? "  -  " + user.activity : ""}${user?.market ? ", " + user.market : ""}`, 40, 92);
  doc.text(period, W - 40, 92, { align: "right" });

  const cards = [["Ventes", F(sales)], ["Dépenses", F(spend)], ["Bénéfice", F(sales - spend)], ["On me doit", F(debts)]];
  const cw = (W - 80 - 30) / 4;
  cards.forEach(([l, v], i) => {
    const x = 40 + i * (cw + 10);
    doc.setFillColor(244, 246, 250); doc.roundedRect(x, 135, cw, 64, 8, 8, "F");
    doc.setTextColor(91, 102, 120); doc.setFontSize(9); doc.text(l.toUpperCase(), x + 12, 155);
    doc.setTextColor(11, 31, 58); doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.text(v, x + 12, 182);
    doc.setFont("helvetica", "normal");
  });
  doc.setTextColor(60, 70, 85); doc.setFontSize(10);
  doc.text(`Jours de vente : ${saleDays}   |   Ventes payées par Mobile Money : ${sales ? Math.round((momo / sales) * 100) : 0} %   |   Écritures : ${rows.length}`, 40, 222);

  autoTable(doc, {
    startY: 238,
    head: [["Date", "Opération", "Détail", "Payé par", "Montant"]],
    body: rows.map((e) => [new Date(e.at).toLocaleDateString("fr-FR"), e.type, [e.quantity, e.item].filter(Boolean).join(" ") || e.who || "", e.channel === "mobile money" ? "MoMo" : "Espèces", (e.type === "dépense" ? "- " : "") + F(e.amount)]),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [11, 31, 58], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles: { 4: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });
  const y = (doc.lastAutoTable?.finalY || 260) + 24;
  doc.setFontSize(9); doc.setTextColor(120, 130, 145);
  doc.text("Rapport généré par Akwe à partir des opérations dictées et confirmées par le titulaire du compte.", 40, y);
  doc.text("Partagé uniquement à l'initiative du titulaire. Montants en francs CFA.", 40, y + 14);
  const name = (user?.name || "rapport").normalize("NFD").replace(/[^\w]+/g, "_");
  doc.save(`Rapport_CA_${name}_${new Date().toISOString().slice(0, 10)}.pdf`);
  return rows.length;
}
