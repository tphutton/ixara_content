import { EditorialApprovalTargetType, type ContentVariant } from "@prisma/client";
import Link from "next/link";
import { EditorialApprovalPanel } from "@/components/approvals/editorial-approval-panel";
import { SubmitButton } from "@/components/forms/submit-button";
import { StatusBadge } from "@/components/ui/status-badge";

type ContentVariantsPanelProps = {
  action: () => Promise<void>;
  contentId: string;
  deleteAction: (variantId: string) => Promise<void>;
  updateAction: (variantId: string, formData: FormData) => Promise<void>;
  selectAction: (variantId: string) => Promise<void>;
  selectedVariantId: string | null;
  editVariantId?: string;
  variants: ContentVariant[];
};

export function ContentVariantsPanel({ action, contentId, deleteAction, updateAction, selectAction, selectedVariantId, editVariantId, variants }: ContentVariantsPanelProps) {
  const editVariant = variants.find((variant) => variant.id === editVariantId) ?? null;
  return (
    <section className="quiet-panel">
      <div className="section-heading">
        <div>
          <p className="kicker">Channel variants</p>
          <h3>{variants.length} saved variant{variants.length === 1 ? "" : "s"}</h3>
        </div>
        <form action={action}>
          <SubmitButton label="Generate variants" pendingLabel="Generating..." />
        </form>
      </div>

      {variants.length === 0 ? (
        <p className="muted">Generate platform-specific versions for Instagram, Facebook, LinkedIn, and email.</p>
      ) : (
        <div className="variant-list">
          {variants.map((variant) => (
            <article className="variant-card" key={variant.id}>
              <div className="section-heading">
                <div>
                  <p className="kicker">{variant.platform}</p>
                  <h3>{variant.title}</h3>
                </div>
                <div className="row-actions">
                  {selectedVariantId === variant.id ? <StatusBadge label="selected for publishing" /> : null}
                  <StatusBadge label={variant.status} />
                  <Link className="button button--secondary" href={`/content/${contentId}?variant=${variant.id}`}>Edit</Link>
                  {selectedVariantId !== variant.id ? <form action={selectAction.bind(null, variant.id)}><button className="button button--secondary" type="submit">Use for publishing</button></form> : null}
                  <form action={deleteAction.bind(null, variant.id)}>
                    <button className="button button--secondary" type="submit">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
              {variant.hook ? <strong>{variant.hook}</strong> : null}
              {variant.body ? <p className="muted">{variant.body}</p> : null}
              {variant.cta ? <span className="inline-chip">{variant.cta}</span> : null}
              {variant.notes ? <p className="quality-next-step">{variant.notes}</p> : null}
              <details className="approval-history"><summary>Approval</summary><EditorialApprovalPanel compact path={`/content/${contentId}`} targetId={variant.id} targetType={EditorialApprovalTargetType.content_variant} /></details>
            </article>
          ))}
        </div>
      )}

      {editVariant ? (
        <div className="editor-overlay editor-overlay--dialog">
          <div className="editor-overlay__backdrop"><Link aria-label="Close variant editor" href={`/content/${contentId}`} /></div>
          <section className="editor-overlay__panel variant-editor-panel">
            <div className="editor-overlay__header">
              <div><p className="kicker">Variant editor</p><h3>{editVariant.platform}</h3><p className="muted">Refine the final channel copy before selecting it for publishing.</p></div>
              <Link className="button button--secondary" href={`/content/${contentId}`}>Close</Link>
            </div>
            <div className="editor-overlay__content">
              <form action={updateAction.bind(null, editVariant.id)} className="quiet-form">
                <label className="field"><span className="field__label">Title</span><input defaultValue={editVariant.title} name="title" /></label>
                <label className="field"><span className="field__label">Platform</span><input defaultValue={editVariant.platform} name="platform" /></label>
                <label className="field"><span className="field__label">Hook</span><textarea defaultValue={editVariant.hook ?? ""} name="hook" rows={3} /></label>
                <label className="field"><span className="field__label">Body</span><textarea defaultValue={editVariant.body ?? ""} name="body" rows={8} /></label>
                <label className="field"><span className="field__label">CTA</span><input defaultValue={editVariant.cta ?? ""} name="cta" /></label>
                <label className="field"><span className="field__label">Notes</span><textarea defaultValue={editVariant.notes ?? ""} name="notes" rows={3} /></label>
                <div className="form-actions"><button className="button button--primary" type="submit">Save variant</button></div>
              </form>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
