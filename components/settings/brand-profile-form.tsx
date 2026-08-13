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

      <Field htmlFor="positioning" label="Positioning">
        <textarea
          defaultValue={profile?.positioning ?? ""}
          id="positioning"
          name="positioning"
          rows={3}
        />
      </Field>

      <div className="form-grid form-grid--2">
        <Field htmlFor="contentPillars" hint="Comma separated" label="Content pillars">
          <textarea
            defaultValue={formatArray(profile?.contentPillars ?? [])}
            id="contentPillars"
            name="contentPillars"
            rows={3}
          />
        </Field>

        <Field htmlFor="audiencePersonas" hint="Comma separated" label="Audience personas">
          <textarea
            defaultValue={formatArray(profile?.audiencePersonas ?? [])}
            id="audiencePersonas"
            name="audiencePersonas"
            rows={3}
          />
        </Field>

        <Field htmlFor="keyOffers" hint="Comma separated" label="Key offers">
          <textarea
            defaultValue={formatArray(profile?.keyOffers ?? [])}
            id="keyOffers"
            name="keyOffers"
            rows={3}
          />
        </Field>

        <Field htmlFor="proofPoints" hint="Comma separated" label="Proof points">
          <textarea
            defaultValue={formatArray(profile?.proofPoints ?? [])}
            id="proofPoints"
            name="proofPoints"
            rows={3}
          />
        </Field>

        <Field htmlFor="seoKeywords" hint="Comma separated" label="SEO keywords">
          <textarea
            defaultValue={formatArray(profile?.seoKeywords ?? [])}
            id="seoKeywords"
            name="seoKeywords"
            rows={3}
          />
        </Field>

        <Field htmlFor="competitors" hint="Comma separated" label="Competitors / references">
          <textarea
            defaultValue={formatArray(profile?.competitors ?? [])}
            id="competitors"
            name="competitors"
            rows={3}
          />
        </Field>
      </div>

      <Field htmlFor="voiceExamples" hint="Comma separated examples of on-brand copy" label="Voice examples">
        <textarea
          defaultValue={formatArray(profile?.voiceExamples ?? [])}
          id="voiceExamples"
          name="voiceExamples"
          rows={4}
        />
      </Field>

      <Field htmlFor="visualGuidelines" label="Visual guidelines">
        <textarea
          defaultValue={profile?.visualGuidelines ?? ""}
          id="visualGuidelines"
          name="visualGuidelines"
          rows={3}
        />
      </Field>

      <div className="form-grid form-grid--2">
        <Field htmlFor="instagramGuidelines" label="Instagram guidelines">
          <textarea
            defaultValue={profile?.instagramGuidelines ?? ""}
            id="instagramGuidelines"
            name="instagramGuidelines"
            rows={3}
          />
        </Field>

        <Field htmlFor="facebookGuidelines" label="Facebook guidelines">
          <textarea
            defaultValue={profile?.facebookGuidelines ?? ""}
            id="facebookGuidelines"
            name="facebookGuidelines"
            rows={3}
          />
        </Field>

        <Field htmlFor="linkedinGuidelines" label="LinkedIn guidelines">
          <textarea
            defaultValue={profile?.linkedinGuidelines ?? ""}
            id="linkedinGuidelines"
            name="linkedinGuidelines"
            rows={3}
          />
        </Field>

        <Field htmlFor="blogGuidelines" label="Blog guidelines">
          <textarea
            defaultValue={profile?.blogGuidelines ?? ""}
            id="blogGuidelines"
            name="blogGuidelines"
            rows={3}
          />
        </Field>

        <Field htmlFor="emailGuidelines" label="Email guidelines">
          <textarea
            defaultValue={profile?.emailGuidelines ?? ""}
            id="emailGuidelines"
            name="emailGuidelines"
            rows={3}
          />
        </Field>

        <Field htmlFor="adGuidelines" label="Ad guidelines">
          <textarea
            defaultValue={profile?.adGuidelines ?? ""}
            id="adGuidelines"
            name="adGuidelines"
            rows={3}
          />
        </Field>
      </div>

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
