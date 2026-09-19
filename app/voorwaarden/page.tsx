import Link from "next/link";
import { CURRENT_TERMS } from "@/lib/legal/terms";
export default function TermsPage() {
 return <main className="mx-auto max-w-3xl space-y-4 p-6 text-sm leading-7">
  <Link href="/">Terug naar Leerkrachtentools</Link>
  {CURRENT_TERMS.blocks.map((block,index)=>block.kind==="h1" ? <h1 key={index} className="text-2xl font-bold">{block.text}</h1> : block.kind==="h2" || block.kind==="h3" ? <h2 key={index} className="text-lg font-semibold">{block.text}</h2> : <p key={index}>{block.text}</p>)}
  <p>Vastgelegde tekstversie {CURRENT_TERMS.version}. <a href={CURRENT_TERMS.source}>Oorspronkelijke publicatie</a>.</p>
  <p>Kosteloze testtoegang brengt geen automatische betalingsverplichting of verplichte einddatum mee. Een betaalde dienst vereist een afzonderlijke afspraak.</p>
 </main>;
}
