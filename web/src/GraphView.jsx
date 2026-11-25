// Voisinage réel du compte destinataire (7 derniers jours du graphe simulé)
export default function GraphView({ acc, danger }) {
  const W = 420, H = 260, cx = W / 2, cy = H / 2;
  const ins = acc.in.slice(-24), outs = acc.out.slice(-12);
  const senders = [...new Set(ins.map((x) => x[0]))];
  const receivers = [...new Set(outs.map((x) => x[0]))];
  const place = (list, side) => list.map((id, i) => {
    const n = list.length, a = (Math.PI * 0.8) * ((i + 0.5) / Math.max(1, n) - 0.5);
    const r = side === "in" ? 150 : 150;
    const x = side === "in" ? cx - Math.cos(a) * r : cx + Math.cos(a) * r;
    return { id, x, y: cy + Math.sin(a) * (H / 2 - 18) };
  });
  const L = place(senders, "in"), R = place(receivers, "out");
  const center = danger ? "#ef4444" : "#22c55e";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Voisinage du compte destinataire">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#64748b" /></marker>
        <marker id="arrR" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#f59e0b" /></marker>
      </defs>
      {L.map((p) => <line key={"l" + p.id} x1={p.x} y1={p.y} x2={cx - 16} y2={cy} stroke="#475569" strokeWidth="1" markerEnd="url(#arr)" opacity=".8" />)}
      {R.map((p) => <line key={"r" + p.id} x1={cx + 16} y1={cy} x2={p.x} y2={p.y} stroke="#f59e0b" strokeWidth="1.3" markerEnd="url(#arrR)" opacity=".9" />)}
      {L.map((p) => <circle key={"a" + p.id} cx={p.x} cy={p.y} r="5" fill="#94a3b8" />)}
      {R.map((p) => <circle key={"b" + p.id} cx={p.x} cy={p.y} r="5" fill="#f59e0b" />)}
      <circle cx={cx} cy={cy} r="24" fill={center} opacity=".18" className={danger ? "pulse-ring" : ""} style={{ transformOrigin: `${cx}px ${cy}px` }} />
      <circle cx={cx} cy={cy} r="15" fill={center} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="#060b16">{acc.id}</text>
      <text x="8" y="14" fontSize="10" fill="#94a3b8">Expéditeurs ({senders.length})</text>
      <text x={W - 8} y="14" fontSize="10" fill="#f59e0b" textAnchor="end">Argent ressorti vers ({receivers.length})</text>
    </svg>
  );
}
