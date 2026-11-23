import {createRoot} from "react-dom/client"
import {BookOpen, ChartNoAxesCombined, Network, ShieldCheck, WalletCards, ChevronRight, ReceiptText} from "lucide-react"
import {Button} from "./ui/button"
import {Engraving} from "./Engraving"
import {FlowChart, number, type Day} from "./FlowChart"

type Data = {days:Day[]; balance:number; sales:number; expenses:number; entries:number; total:number; matched:number}
type Bridge = {data:Data; parentElement:HTMLElement|ShadowRoot; setTriggerValue:(key:string,value:string)=>void}
type Nav = (page:string)=>void

function Wallet({balance,go}:{balance:number; go:Nav}) {
  return <section className="note" aria-label="Portefeuille de démonstration"><Engraving/>
    <div className="note-content"><p className="note-label"><WalletCards size={18}/> Portefeuille de démonstration</p>
      <h2>Solde disponible</h2><div className="amount">{number.format(balance)} <span>XOF</span></div>
      <Button className="transfer" onClick={()=>go("NUKÚN Protège")}><ShieldCheck/>Analyser un transfert</Button>
    </div></section>
}
function Ledger({data,go}:{data:Data; go:Nav}) {
  return <section className="panel ledger"><header className="panel-head"><h2>Cahier Akwɛ</h2><BookOpen size={19}/></header>
    <dl>{[["Ventes confirmées",data.sales],["Dépenses confirmées",data.expenses]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{number.format(Number(value))} <small>XOF</small></dd></div>)}</dl>
    <p><ReceiptText size={16}/>{data.entries ? `${data.matched} / ${data.entries} écritures rapprochées` : "Aucune écriture confirmée"}</p>
    <Button className="open-ledger" variant="outline" onClick={()=>go("Cahier Akwɛ")}>Ouvrir le cahier <ChevronRight/></Button>
  </section>
}
function Workspace({data,go}:{data:Data;go:Nav}) {
  return <section className="workspace" aria-label="Vue d’ensemble">
    <Wallet balance={data.balance} go={go}/>
    <div className="analysis-grid"><FlowChart days={data.days}/><Ledger data={data} go={go}/></div>
    <div className="research"><header><h2>Analyse des risques</h2><p>{number.format(data.total)} transactions simulées</p></header>
      <div className="research-actions">{[{page:"Résultats",name:"Comparer les modèles",icon:ChartNoAxesCombined},{page:"Laboratoire graphe",name:"Explorer le graphe",icon:Network}].map(({page,name,icon:Icon})=><Button key={page} variant="outline" onClick={()=>go(page)}><Icon/>{name}</Button>)}</div></div>
  </section>
}
export default function render({parentElement,data,setTriggerValue}:Bridge) {
  const mount=parentElement.querySelector(".workspace-mount")
  if (!mount) return
  const root=createRoot(mount)
  root.render(<Workspace data={data} go={page=>setTriggerValue("navigate",page)}/>)
  return ()=>root.unmount()
}