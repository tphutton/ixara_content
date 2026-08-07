import { ContentPlanStatus, type ContentPlan } from "@prisma/client";

type PlanFormProps = {
  action: (formData: FormData) => Promise<void>;
  plan?: ContentPlan | null;
  submitLabel: string;
};

function dateValue(date?: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function PlanForm({ action, plan, submitLabel }: PlanFormProps) {
  return (
    <form action={action} className="quiet-form">
      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Plan name</span>
          <input name="title" required defaultValue={plan?.title ?? ""} placeholder="August social growth plan" />
        </label>
        <label className="field">
          <span className="field__label">Status</span>
          <select name="status" defaultValue={plan?.status ?? ContentPlanStatus.draft}>
            {Object.values(ContentPlanStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="field__label">Goal</span>
        <input name="goal" defaultValue={plan?.goal ?? ""} placeholder="Grow qualified enquiries from LinkedIn and blog search" />
      </label>

      <label className="field">
        <span className="field__label">Description</span>
        <textarea name="description" rows={4} defaultValue={plan?.description ?? ""} placeholder="What this plan is trying to coordinate." />
      </label>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Brand</span>
          <input name="brand" defaultValue={plan?.brand ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">Campaign</span>
          <input name="campaignName" defaultValue={plan?.campaignName ?? ""} />
        </label>
      </div>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Start</span>
          <input name="startDate" type="date" defaultValue={dateValue(plan?.startDate)} />
        </label>
        <label className="field">
          <span className="field__label">End</span>
          <input name="endDate" type="date" defaultValue={dateValue(plan?.endDate)} />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Source prompt</span>
        <textarea name="sourcePrompt" rows={3} defaultValue={plan?.sourcePrompt ?? ""} placeholder="Optional Quill or Atlas prompt that created the plan." />
      </label>

      <div className="form-actions">
        <button className="button button--primary" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
