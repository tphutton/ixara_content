import { ContentPlanItemStatus, ContentPlanItemType, type ContentPlan, type ContentPlanItem } from "@prisma/client";
import { BrandSelect } from "@/components/forms/brand-select";

type PlanItemFormProps = {
  action: (formData: FormData) => Promise<void>;
  plan: ContentPlan;
  item?: ContentPlanItem | null;
  brandProfiles?: Array<{ id?: string; brandName: string }>;
  submitLabel?: string;
};

function dateTimeValue(date?: Date | null) {
  return date ? date.toISOString().slice(0, 16) : "";
}

export function PlanItemForm({ action, plan, item, brandProfiles = [], submitLabel = "Add item" }: PlanItemFormProps) {
  return (
    <form action={action} className="quiet-form">
      <label className="field">
        <span className="field__label">Item title</span>
        <input name="title" required defaultValue={item?.title ?? ""} placeholder="LinkedIn thought-leadership post" />
      </label>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Type</span>
          <select name="itemType" defaultValue={item?.itemType ?? ContentPlanItemType.content}>
            {Object.values(ContentPlanItemType).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Status</span>
          <select name="status" defaultValue={item?.status ?? ContentPlanItemStatus.planned}>
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
        <textarea
          name="brief"
          rows={4}
          defaultValue={item?.brief ?? ""}
          placeholder="Audience, angle, proof points, CTA, and asset notes."
        />
      </label>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Channel</span>
          <input name="channel" defaultValue={item?.channel ?? ""} placeholder="LinkedIn" />
        </label>
        <label className="field">
          <span className="field__label">Scheduled for</span>
          <input name="scheduledFor" type="datetime-local" defaultValue={dateTimeValue(item?.scheduledFor)} />
        </label>
      </div>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Brand</span>
          <BrandSelect options={brandProfiles} value={item?.brand ?? plan.brand} />
        </label>
        <label className="field">
          <span className="field__label">Campaign</span>
          <input name="campaignName" defaultValue={item?.campaignName ?? plan.campaignName ?? ""} />
        </label>
      </div>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Region</span>
          <input name="region" defaultValue={item?.region ?? ""} placeholder="Southeast Asia" />
        </label>
        <label className="field">
          <span className="field__label">Country</span>
          <input name="country" defaultValue={item?.country ?? ""} placeholder="Thailand" />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Sport/category</span>
        <input name="sport" defaultValue={item?.sport ?? ""} placeholder="Golf, padel, villas, B2B partner commerce..." />
      </label>

      <label className="field">
        <span className="field__label">Asset request</span>
        <input
          name="assetRequest"
          defaultValue={item?.assetRequest ?? ""}
          placeholder="Screenshot, venue image, player visual, product crop..."
        />
      </label>

      <div className="form-actions">
        <button className="button button--primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
