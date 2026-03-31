import { BrandProfile } from "@prisma/client";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";

type BrandProfileFormProps = {
  action: (formData: FormData) => void;
  profile?: BrandProfile | null;
  submitLabel: string;
  pendingLabel: string;
};

function formatArray(values: string[]) {
  return values.join(", ");
}

export function BrandProfileForm({
  action,
  profile,
  submitLabel,
  pendingLabel,
}: BrandProfileFormProps) {
  return (
    <form action={action} className="stack">
      <div className="form-grid form-grid--2">
        <Field htmlFor="brandName" label="Brand name">
          <input defaultValue={profile?.brandName ?? ""} id="brandName" name="brandName" required />
        </Field>

        <Field htmlFor="defaultTone" label="Default tone">
          <input defaultValue={profile?.defaultTone ?? ""} id="defaultTone" name="defaultTone" />
        </Field>

        <Field htmlFor="targetAudience" label="Target audience">
          <input
            defaultValue={profile?.targetAudience ?? ""}
            id="targetAudience"
            name="targetAudience"
          />
        </Field>

        <Field htmlFor="preferredWebsites" hint="Comma separated" label="Preferred websites">
          <input
            defaultValue={formatArray(profile?.preferredWebsites ?? [])}
            id="preferredWebsites"
            name="preferredWebsites"
          />
        </Field>

        <Field htmlFor="sports" hint="Comma separated" label="Sports">
          <input defaultValue={formatArray(profile?.sports ?? [])} id="sports" name="sports" />
        </Field>

        <Field htmlFor="regions" hint="Comma separated" label="Regions">
          <input defaultValue={formatArray(profile?.regions ?? [])} id="regions" name="regions" />
        </Field>

        <Field htmlFor="countries" hint="Comma separated" label="Countries">
          <input
            defaultValue={formatArray(profile?.countries ?? [])}
            id="countries"
            name="countries"
          />
        </Field>

        <Field htmlFor="preferredCTAs" hint="Comma separated" label="Preferred CTAs">
          <input
            defaultValue={formatArray(profile?.preferredCTAs ?? [])}
            id="preferredCTAs"
            name="preferredCTAs"
          />
        </Field>
      </div>

      <Field htmlFor="description" label="Brand description">
        <textarea
          defaultValue={profile?.description ?? ""}
          id="description"
          name="description"
          rows={4}
        />
      </Field>

      <Field htmlFor="bannedPhrases" hint="Comma separated" label="Banned phrases">
        <textarea
          defaultValue={formatArray(profile?.bannedPhrases ?? [])}
          id="bannedPhrases"
          name="bannedPhrases"
          rows={3}
        />
      </Field>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
      </div>
    </form>
  );
}
