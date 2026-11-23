import {useId, useState} from "react"
import {Tabs, TabsContent, TabsList, TabsTrigger} from "./ui/tabs"

export type Day = {day:number; count:number; volume:number}
export const number = new Intl.NumberFormat("fr-FR")
const compact = new Intl.NumberFormat("fr-FR", {notation:"compact", maximumFractionDigits:1})

function Plot({days}: {days:Day[]}) {
  const [index, setIndex] = useState(days.length - 1)
  const gradient = useId()
  const selected = days[index]
  if (!selected) return <p role="status">Aucun flux simulé pour cette période.</p>
  const values = days.map(d => d.volume)
  const min = Math.max(0, Math.floor(Math.min(...values) / 1e6) * 1e6)
  const max = Math.max(min + 1e6, Math.ceil(Math.max(...values) / 1e6) * 1e6)
  const points = days.map((day,i) => ({x: 4 + 592*i/Math.max(1,days.length-1), y: 96 - 88*(day.volume-min)/(max-min)}))
  const line = points.map(p => p.x + "," + p.y).join(" ")
  return <div>
    <div className="chart-readout" aria-live="polite"><strong>{number.format(selected.volume)}</strong> XOF <span>Jour {selected.day} · {number.format(selected.count)} opérations</span></div>
    <div className="chart-grid"><div className="ticks"><span>{compact.format(max)}</span><span>{compact.format((min+max)/2)}</span><span>{compact.format(min)}</span></div>
    <div className="plot">
      <svg viewBox="0 0 600 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id={gradient} x2="0" y2="1"><stop stopColor="var(--ink-chart)" stopOpacity=".26"/><stop offset="1" stopColor="var(--ink-chart)" stopOpacity=".015"/></linearGradient></defs>
        {[8,52,96].map(y=><line key={y} x1="0" x2="600" y1={y} y2={y} stroke="var(--line)" strokeDasharray="3 4"/>)}
        <polygon points={`4,96 ${line} 596,96`} fill={`url(#${gradient})`}/>
        <polyline points={line} fill="none" stroke="var(--ink-chart)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
        <line x1={points[index].x} x2={points[index].x} y1="0" y2="100" stroke="var(--ink-chart)" strokeDasharray="2 4"/>
      </svg>
      <input type="range" min={0} max={days.length-1} value={index} aria-label="Jour de simulation" aria-valuetext={`Jour ${selected.day}, ${number.format(selected.volume)} XOF`} onChange={e=>setIndex(Number(e.target.value))}/>
    </div></div>
    <div className="axis"><span>Jour {days[0].day}</span><span>Jour {days.at(-1)?.day}</span></div>
  </div>
}
export function FlowChart({days}:{days:Day[]}) {
  return <section className="panel flow"><Tabs defaultValue="7"><header className="panel-head"><h2>Volume des échanges</h2>
    <TabsList aria-label="Période affichée">{[7,30].map(n=><TabsTrigger key={n} value={String(n)}>{n} j</TabsTrigger>)}</TabsList></header>
    {[7,30].map(n=><TabsContent key={n} value={String(n)}><Plot days={days.slice(-n)}/></TabsContent>)}</Tabs></section>
}