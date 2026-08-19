import { SubmitButton } from "@/components/forms/submit-button";

type AiPlanFormProps = {
  action: (formData: FormData) => Promise<void>;
  brandProfiles: Array<{ brandName: string }>;
  campaigns: Array<{ campaign_name: string; brand: string[]; start_date?: string | null; end_date?: string | null }>;
};

const channelOptions = ["Instagram", "Facebook", "LinkedIn", "Email", "Blog", "Website", "YouTube", "TikTok"];

export function AiPlanForm({ action, brandProfiles, campaigns }: AiPlanFormProps) {
  return (
    <form action={action} className="quiet-form">
      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Planning mode</span>
          <select name="planningMode" defaultValue="new_content">
            <option value="new_content">New content ideas</option>
            <option value="balanced">Balanced plan</option>
            <option value="cleanup">Clean up existing work</option>
            <option value="campaign_launch">Campaign launch</option>
            <option value="calendar_gaps">Fill calendar gaps</option>
            <option value="variants">Create channel variants</option>
          </select>
        </label>

        <label className="field">
          <span className="field__label">Number of items</span>
          <input defaultValue="8" max="20" min="3" name="itemCount" type="number" />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Goal</span>
        <input name="goal" placeholder="Launch the campaign, grow enquiries, fill next week, improve quality..." />
      </label>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Brand</span>
          <input list="brand-options" name="brand" placeholder="Auto-select if blank" />
          <datalist id="brand-options">
            {brandProfiles.map((profile) => (
              <option key={profile.brandName} value={profile.brandName} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span className="field__label">Campaign</span>
          <input list="campaign-options" name="campaignName" placeholder="Auto-select if blank" />
          <datalist id="campaign-options">
            {campaigns.map((campaign) => (
              <option key={campaign.campaign_name} value={campaign.campaign_name} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Start date</span>
          <input name="startDate" type="date" />
        </label>

        <label className="field">
          <span className="field__label">End date</span>
          <input name="endDate" type="date" />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Channels</span>
        <input name="channels" placeholder="Instagram, Facebook, LinkedIn, Blog" />
        <span className="field__hint">Comma-separated. Leave blank and Quill will choose from current signals.</span>
      </label>

      <div className="quiet-meta">
        {channelOptions.map((channel) => (
          <span key={channel}>{channel}</span>
        ))}
      </div>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Region</span>
          <input name="region" />
        </label>
        <label className="field">
          <span className="field__label">Country</span>
          <input name="country" />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Sport/category</span>
        <input name="sport" />
      </label>

      <label className="field">
        <span className="field__label">Extra guidance</span>
        <textarea name="guidance" rows={4} placeholder="Anything Quill should strongly prefer, avoid, or explain in the plan." />
      </label>

      <div className="form-actions">
        <SubmitButton label="Generate plan" pendingLabel="Building plan..." />
      </div>
    </form>
  );
}
