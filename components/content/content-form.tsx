import { Content, ContentStatus, ContentType } from "@prisma/client";
import { contentStatusOptions, contentTypeOptions } from "@/lib/constants/options";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";

type ContentFormProps = {
  action: (formData: FormData) => void;
  content?: Content | null;
};

export function ContentForm({ action, content }: ContentFormProps) {
  return (
    <form action={action} className="stack">
      <div className="form-grid form-grid--2">
        <Field htmlFor="title" label="Title">
          <input defaultValue={content?.title ?? ""} id="title" name="title" required />
        </Field>

        <Field htmlFor="status" label="Status">
          <select defaultValue={content?.status ?? ContentStatus.idea} id="status" name="status">
            {contentStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="contentType" label="Content type">
          <select
            defaultValue={content?.contentType ?? ContentType.social_post}
            id="contentType"
            name="contentType"
          >
            {contentTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="platform" label="Platform">
          <input defaultValue={content?.platform ?? ""} id="platform" name="platform" />
        </Field>

        <Field htmlFor="campaignName" label="Campaign name">
          <input defaultValue={content?.campaignName ?? ""} id="campaignName" name="campaignName" />
        </Field>

        <Field htmlFor="brand" label="Brand">
          <input defaultValue={content?.brand ?? ""} id="brand" name="brand" />
        </Field>

        <Field htmlFor="sport" label="Sport">
          <input defaultValue={content?.sport ?? ""} id="sport" name="sport" />
        </Field>

        <Field htmlFor="region" label="Region">
          <input defaultValue={content?.region ?? ""} id="region" name="region" />
        </Field>

        <Field htmlFor="country" label="Country">
          <input defaultValue={content?.country ?? ""} id="country" name="country" />
        </Field>

        <Field htmlFor="tone" label="Tone">
          <input defaultValue={content?.tone ?? ""} id="tone" name="tone" />
        </Field>

        <Field htmlFor="targetAudience" label="Target audience">
          <input defaultValue={content?.targetAudience ?? ""} id="targetAudience" name="targetAudience" />
        </Field>

        <Field htmlFor="aiGenerated" label="AI generated">
          <select defaultValue={String(content?.aiGenerated ?? false)} id="aiGenerated" name="aiGenerated">
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </Field>
      </div>

      <Field htmlFor="hook" label="Hook">
        <textarea defaultValue={content?.hook ?? ""} id="hook" name="hook" rows={3} />
      </Field>

      <Field htmlFor="body" label="Body">
        <textarea defaultValue={content?.body ?? ""} id="body" name="body" rows={8} />
      </Field>

      <Field htmlFor="cta" label="Call to action">
        <textarea defaultValue={content?.cta ?? ""} id="cta" name="cta" rows={3} />
      </Field>

      <div className="form-grid form-grid--2">
        <Field htmlFor="tags" hint="Comma separated" label="Tags">
          <input defaultValue={content?.tags.join(", ") ?? ""} id="tags" name="tags" />
        </Field>

        <Field htmlFor="websites" hint="Comma separated" label="Websites">
          <input defaultValue={content?.websites.join(", ") ?? ""} id="websites" name="websites" />
        </Field>

        <Field htmlFor="assetImage" label="Asset image URL">
          <input defaultValue={content?.assetImage ?? ""} id="assetImage" name="assetImage" />
        </Field>

        <Field htmlFor="assetCaption" label="Asset caption">
          <input defaultValue={content?.assetCaption ?? ""} id="assetCaption" name="assetCaption" />
        </Field>
      </div>

      <Field htmlFor="sourcePrompt" label="Source prompt">
        <textarea defaultValue={content?.sourcePrompt ?? ""} id="sourcePrompt" name="sourcePrompt" rows={4} />
      </Field>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <SubmitButton
          label={content ? "Save content" : "Create content"}
          pendingLabel={content ? "Saving content..." : "Creating content..."}
        />
      </div>
    </form>
  );
}
