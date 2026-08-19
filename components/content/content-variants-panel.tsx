import type { ContentVariant } from "@prisma/client";
import { SubmitButton } from "@/components/forms/submit-button";
import { StatusBadge } from "@/components/ui/status-badge";

type ContentVariantsPanelProps = {
  action: () => Promise<void>;
  deleteAction: (variantId: string) => Promise<void>;
  variants: ContentVariant[];
};

export function ContentVariantsPanel({ action, deleteAction, variants }: ContentVariantsPanelProps) {
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
                  <StatusBadge label={variant.status} />
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
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
