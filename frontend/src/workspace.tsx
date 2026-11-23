import {useState} from "react"
import {createRoot, type Root} from "react-dom/client"
import {BookOpen, ShieldCheck, Activity, Wallet, Network, ChartColumn} from "lucide-react"
import {Button} from "./ui/button"
import {Tabs,TabsList,TabsTrigger,TabsContent} from "./ui/tabs"

const format = new Intl.NumberFormat("fr-FR")
type Day = {day:number; count:number; volume:number}
type Data = {days:Day[]; balance:number; entries:number; total:number}
type Bridge = {data:Data;parentElement:HTMLElement|ShadowRoot;setTriggerValue:(key:string,value:string)=>void}
const actions = [
  {page:"NUKÚN Protège",title:"Analyser un transfert",description:"Vérifier le destinataire et les signaux de risque.",icon:ShieldCheck},
  {page:"Cahier Akwɛ",title:"Ouvrir le cahier",description:"Dicter ou saisir une vente ou une dépense.",icon:BookOpen},
  {page:"Résultats",title:"Comparer les modèles",description:"Consulter les résultats sur les données simulées.",icon:ChartColumn},
  {page:"Laboratoire graphe",title:"Explorer le graphe",description:"Examiner un compte avec GraphSAGE.",icon:Network}
]
function Timeline({days}:{days:Day[]}) {
  const [selected,setSelected]=useState<number|null>(null)
  const current=days.find(d=>d.day===selected) ?? days.at(-1)
  if(!current) return <p role="status">Aucune transaction sur cette période.</p>
  const max=Math.max(1,...days.map(d=>d.volume))
  return <><div className="bars" aria-label="Volumes quotidiens">{days.map(d=><button key={d.day} type="button" aria-pressed={current.day===d.day} aria-label={`Jour ${d.day}, ${format.format(d.volume)} XOF`} onClick={()=>setSelected(d.day)}><span style={{height:Math.max(1,100*d.volume/max)+"%"}}/></button>)}</div>
    <div className="axis"><span>Jour {days[0].day}</span><span>Jour {days.at(-1)?.day}</span></div>
    <p className="readout" aria-live="polite">Jour {current.day} · {format.format(current.count)} opérations · {format.format(current.volume)} XOF</p></>
}
function Workspace({data,go}:{data:Data;go:(page:string)=>void}){
  return <section className="workspace" aria-label="Vue d’ensemble du portefeuille">
    <div className="balance"><div><Wallet size={20}/> Portefeuille de démonstration</div><strong>{format.format(data.balance)} <small>XOF</small></strong><p>Solde disponible pour les transferts fictifs</p></div>
    <div className="surface flow"><Tabs defaultValue="7"><header><div><Activity size={19}/><h2>Flux simulés</h2></div><TabsList aria-label="Période affichée">{[7,30].map(n=><TabsTrigger key={n} value={String(n)}>{n} j</TabsTrigger>)}</TabsList></header>
    {[7,30].map(n=><TabsContent key={n} value={String(n)}><Timeline days={data.days.slice(-n)}/></TabsContent>)}</Tabs></div>
    <section className="tasks" aria-label="Actions du portefeuille">{actions.map(({icon:Icon,page,title,description})=><Button key={page} variant="outline" className="task" onClick={()=>go(page)}><Icon aria-hidden="true"/><span><strong>{title}</strong><small>{description}</small></span></Button>)}</section>
    <div className="foot">{format.format(data.total)} transactions simulées <span>·</span> {format.format(data.entries)} écriture(s) confirmée(s)</div>
  </section>
}
const roots=new WeakMap<Element,Root>()
export default function render({parentElement,data,setTriggerValue}:Bridge){
  const mount=parentElement.querySelector(".workspace-mount")
  if(!mount)return
  let root=roots.get(mount)
  if(!root){root=createRoot(mount);roots.set(mount,root)}
  root.render(<Workspace data={data} go={page=>setTriggerValue("navigate",page)}/>)
  return ()=>{root.unmount();roots.delete(mount)}
}
