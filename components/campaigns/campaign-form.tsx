import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import {
  campaignStatuses,
  campaignTypes,
  type Campaign,
} from "@/lib/campaigns/types";

type CampaignFormProps = {
  action: (formData: FormData) => void;
  campaign?: Campaign | null;
  linkedAssetId?: string | null;
  assets?: Array<{ id: string; title: string }>;
};

export function CampaignForm({ action, campaign, linkedAssetId, assets = [] }: CampaignFormProps) {
  return (
    <form action={action} className="stack">
      <div className="form-grid form-grid--2">
        <Field htmlFor="campaign_name" label="Campaign name">
          <input
            defaultValue={campaign?.campaign_name ?? ""}
            id="campaign_name"
            name="campaign_name"
            required
          />
        </Field>

        <Field htmlFor="campaign_status" label="Status">
          <select
            defaultValue={campaign?.campaign_status ?? "draft"}
            id="campaign_status"
            name="campaign_status"
          >
            {campaignStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="campaign_type" label="Campaign type">
          <select
            defaultValue={campaign?.campaign_type ?? ""}
            id="campaign_type"
            name="campaign_type"
          >
            <option value="">No type selected</option>
            {campaignTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="brand" hint="Comma separated brands" label="Brands">
          <input defaultValue={campaign?.brand.join(", ") ?? ""} id="brand" name="brand" />
        </Field>

        <Field htmlFor="start_date" label="Start date">
          <input
            defaultValue={campaign?.start_date ?? ""}
            id="start_date"
            name="start_date"
            type="date"
          />
        </Field>

        <Field htmlFor="end_date" label="End date">
          <input
            defaultValue={campaign?.end_date ?? ""}
            id="end_date"
            name="end_date"
            type="date"
          />
        </Field>

        <Field htmlFor="country" label="Country">
          <input defaultValue={campaign?.country ?? ""} id="country" name="country" />
        </Field>

        <Field htmlFor="region" label="Region">
          <input defaultValue={campaign?.region ?? ""} id="region" name="region" />
        </Field>

        <Field htmlFor="category" label="Category">
          <input defaultValue={campaign?.category ?? ""} id="category" name="category" />
        </Field>

        <Field htmlFor="partner_id" label="Partner ID">
          <input defaultValue={campaign?.partner_id ?? ""} id="partner_id" name="partner_id" />
        </Field>

        <Field htmlFor="featured_image_link" label="Featured image URL">
          <input
            defaultValue={campaign?.featured_image_link ?? ""}
            id="featured_image_link"
            name="featured_image_link"
          />
        </Field>

        <Field htmlFor="linkedAssetId" label="Linked asset">
          <select defaultValue={linkedAssetId ?? ""} id="linkedAssetId" name="linkedAssetId">
            <option value="">No linked asset</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.title}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field htmlFor="campaign_description" label="Description">
        <textarea
          defaultValue={campaign?.campaign_description ?? ""}
          id="campaign_description"
          name="campaign_description"
          rows={6}
        />
      </Field>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <SubmitButton
          label={campaign ? "Save campaign" : "Create campaign"}
          pendingLabel={campaign ? "Saving campaign..." : "Creating campaign..."}
        />
      </div>
    </form>
  );
}
