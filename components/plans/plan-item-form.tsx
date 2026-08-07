import { ContentPlanItemStatus, ContentPlanItemType, type ContentPlan } from "@prisma/client";

type PlanItemFormProps = {
  action: (formData: FormData) => Promise<void>;
  plan: ContentPlan;
};

export function PlanItemForm({ action, plan }: PlanItemFormProps) {
  return (
    <form action={action} className="quiet-form">
      <label className="field">
        <span className="field__label">Item title</span>
        <input name="title" required placeholder="LinkedIn thought-leadership post" />
      </label>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Type</span>
          <select name="itemType" defaultValue={ContentPlanItemType.content}>
            {Object.values(ContentPlanItemType).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Status</span>
          <select name="status" defaultValue={ContentPlanItemStatus.planned}>
            {Object.values(ContentPlanItemStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="field__label">Brief</span>
        <textarea name="brief" rows={4} placeholder="Audience, angle, proof points, CTA, and asset notes." />
      </label>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Channel</span>
          <input name="channel" placeholder="LinkedIn" />
        </label>
        <label className="field">
          <span className="field__label">Scheduled for</span>
          <input name="scheduledFor" type="datetime-local" />
        </label>
      </div>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Brand</span>
          <input name="brand" defaultValue={plan.brand ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">Campaign</span>
          <input name="campaignName" defaultValue={plan.campaignName ?? ""} />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Asset request</span>
        <input name="assetRequest" placeholder="Screenshot, venue image, player visual, product crop..." />
      </label>

      <div className="form-actions">
        <button className="button button--primary" type="submit">
          Add item
        </button>
      </div>
    </form>
  );
}
