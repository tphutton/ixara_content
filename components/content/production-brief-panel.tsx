import { parseProductionPack } from "@/lib/content/production-pack";
import { CopyTextButton } from "./copy-text-button";

export function ProductionBriefPanel({ brief, sourcePrompt }: { brief?: string | null; sourcePrompt?: string | null }) {
  const { sections, archive } = parseProductionPack(brief);
  return <section className="quiet-panel production-brief-panel" id="production-brief">
    <div className="section-heading"><div><p className="kicker">Production brief</p><h3>Build this content</h3></div>{brief ? <CopyTextButton text={brief} label="Copy full brief" /> : null}</div>
    {sections.length ? <div className="stack">{sections.map((section, index) => <section className="brief-section" key={`${section.title}-${index}`}>
      <div className="section-heading"><h4>{section.title.toLowerCase().replace(/^./, (letter) => letter.toUpperCase())}</h4><CopyTextButton text={section.text} label={/caption/i.test(section.title) ? "Copy caption" : /prompt/i.test(section.title) ? "Copy prompt" : "Copy"} /></div>
      <p className="preserve-lines">{section.text}</p>
    </section>)}</div> : <p className="muted">No production brief has been added. Add creative directions, card copy or shot instructions in the editor.</p>}
    {archive ? <details className="brief-history"><summary>Earlier production notes and sources</summary><p className="preserve-lines">{archive}</p></details> : null}
    {sourcePrompt ? <details className="brief-history"><summary>Source prompt and planning history</summary><CopyTextButton text={sourcePrompt} label="Copy source prompt" /><p className="preserve-lines">{sourcePrompt}</p></details> : null}
  </section>;
}
