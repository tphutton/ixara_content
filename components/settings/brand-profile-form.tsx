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
        <Field htmlFor="brandName" hint="The public brand or product name Quill should recognize." label="Brand name">
          <input defaultValue={profile?.brandName ?? ""} id="brandName" name="brandName" placeholder="Ixara, StadioMate, Nollux" required />
        </Field>

        <Field htmlFor="defaultTone" hint="How the brand should sound by default." label="Default tone">
          <input defaultValue={profile?.defaultTone ?? ""} id="defaultTone" name="defaultTone" placeholder="Confident, practical, expert, warm" />
        </Field>

        <Field htmlFor="targetAudience" hint="The primary people this brand needs to reach." label="Target audience">
          <input
            defaultValue={profile?.targetAudience ?? ""}
            id="targetAudience"
            name="targetAudience"
            placeholder="Sports venue owners, academy directors, B2B operators"
          />
        </Field>

        <Field htmlFor="preferredWebsites" hint="Trusted sites Quill can prefer for links, references, or source context. Comma separated." label="Preferred websites">
          <input
            defaultValue={formatArray(profile?.preferredWebsites ?? [])}
            id="preferredWebsites"
            name="preferredWebsites"
            placeholder="https://example.com, https://media.ixara.tech"
          />
        </Field>

        <Field htmlFor="sports" hint="Sports or categories this brand commonly covers. Comma separated." label="Sports">
          <input defaultValue={formatArray(profile?.sports ?? [])} id="sports" name="sports" placeholder="Football, padel, tennis, cricket" />
        </Field>

        <Field htmlFor="regions" hint="Regional markets or operating areas. Comma separated." label="Regions">
          <input defaultValue={formatArray(profile?.regions ?? [])} id="regions" name="regions" placeholder="Southeast Asia, GCC, Europe" />
        </Field>

        <Field htmlFor="countries" hint="Priority countries for copy, offers, and campaign planning. Comma separated." label="Countries">
          <input
            defaultValue={formatArray(profile?.countries ?? [])}
            id="countries"
            name="countries"
            placeholder="Thailand, Singapore, UAE, UK"
          />
        </Field>

        <Field htmlFor="preferredCTAs" hint="Calls to action the AI should reuse or adapt. Comma separated." label="Preferred CTAs">
          <input
            defaultValue={formatArray(profile?.preferredCTAs ?? [])}
            id="preferredCTAs"
            name="preferredCTAs"
            placeholder="Book a demo, Speak to the team, Request pricing"
          />
        </Field>
      </div>

      <Field htmlFor="description" hint="A short explanation of what the brand does and why it exists." label="Brand description">
        <textarea
          defaultValue={profile?.description ?? ""}
          id="description"
          name="description"
          placeholder="Describe the product, customer problem, and main value in plain language."
          rows={4}
        />
      </Field>

      <Field htmlFor="positioning" hint="The market position Quill should defend in copy." label="Positioning">
        <textarea
          defaultValue={profile?.positioning ?? ""}
          id="positioning"
          name="positioning"
          placeholder="What makes this brand different, credible, and worth choosing?"
          rows={3}
        />
      </Field>

      <div className="form-grid form-grid--2">
        <Field htmlFor="contentPillars" hint="Repeatable themes the brand should publish about. Comma separated." label="Content pillars">
          <textarea
            defaultValue={formatArray(profile?.contentPillars ?? [])}
            id="contentPillars"
            name="contentPillars"
            placeholder="Operations advice, customer stories, product education, market trends"
            rows={3}
          />
        </Field>

        <Field htmlFor="audiencePersonas" hint="Specific audience segments the AI should write for. Comma separated." label="Audience personas">
          <textarea
            defaultValue={formatArray(profile?.audiencePersonas ?? [])}
            id="audiencePersonas"
            name="audiencePersonas"
            placeholder="Venue owner, marketing manager, operations director, academy founder"
            rows={3}
          />
        </Field>

        <Field htmlFor="keyOffers" hint="Products, services, packages, or offers to mention. Comma separated." label="Key offers">
          <textarea
            defaultValue={formatArray(profile?.keyOffers ?? [])}
            id="keyOffers"
            name="keyOffers"
            placeholder="Starter package, managed launch, monthly platform subscription"
            rows={3}
          />
        </Field>

        <Field htmlFor="proofPoints" hint="Evidence Quill can use to make claims credible. Comma separated." label="Proof points">
          <textarea
            defaultValue={formatArray(profile?.proofPoints ?? [])}
            id="proofPoints"
            name="proofPoints"
            placeholder="Customer results, years of experience, partner network, platform data"
            rows={3}
          />
        </Field>

        <Field htmlFor="seoKeywords" hint="Search phrases to consider for blogs and website copy. Comma separated." label="SEO keywords">
          <textarea
            defaultValue={formatArray(profile?.seoKeywords ?? [])}
            id="seoKeywords"
            name="seoKeywords"
            placeholder="sports venue software, booking platform, football academy management"
            rows={3}
          />
        </Field>

        <Field htmlFor="competitors" hint="Competitors, alternatives, or reference brands Quill should understand. Comma separated." label="Competitors / references">
          <textarea
            defaultValue={formatArray(profile?.competitors ?? [])}
            id="competitors"
            name="competitors"
            placeholder="Competitor names, substitute tools, brands with a similar audience"
            rows={3}
          />
        </Field>
      </div>

      <Field htmlFor="voiceExamples" hint="Paste short examples of on-brand copy. Comma separated if using multiple examples." label="Voice examples">
        <textarea
          defaultValue={formatArray(profile?.voiceExamples ?? [])}
          id="voiceExamples"
          name="voiceExamples"
          placeholder="Example headlines, captions, intros, or CTAs that sound exactly right."
          rows={4}
        />
      </Field>

      <Field htmlFor="visualGuidelines" hint="Creative direction for imagery, layout, colours, and asset selection." label="Visual guidelines">
        <textarea
          defaultValue={profile?.visualGuidelines ?? ""}
          id="visualGuidelines"
          name="visualGuidelines"
          placeholder="Describe image style, logo usage, colours, composition, and what to avoid."
          rows={3}
        />
      </Field>

      <div className="form-grid form-grid--2">
        <Field htmlFor="instagramGuidelines" hint="How this brand should show up on Instagram." label="Instagram guidelines">
          <textarea
            defaultValue={profile?.instagramGuidelines ?? ""}
            id="instagramGuidelines"
            name="instagramGuidelines"
            placeholder="Hooks, caption length, hashtags, visual style, story/reel preferences."
            rows={3}
          />
        </Field>

        <Field htmlFor="facebookGuidelines" hint="How this brand should use Facebook posts and pages." label="Facebook guidelines">
          <textarea
            defaultValue={profile?.facebookGuidelines ?? ""}
            id="facebookGuidelines"
            name="facebookGuidelines"
            placeholder="Community tone, post structure, link style, local-market guidance."
            rows={3}
          />
        </Field>

        <Field htmlFor="linkedinGuidelines" hint="How this brand should speak to professional audiences." label="LinkedIn guidelines">
          <textarea
            defaultValue={profile?.linkedinGuidelines ?? ""}
            id="linkedinGuidelines"
            name="linkedinGuidelines"
            placeholder="Thought leadership angle, buyer persona, proof style, CTA style."
            rows={3}
          />
        </Field>

        <Field htmlFor="blogGuidelines" hint="Editorial standards for long-form articles." label="Blog guidelines">
          <textarea
            defaultValue={profile?.blogGuidelines ?? ""}
            id="blogGuidelines"
            name="blogGuidelines"
            placeholder="Article structure, SEO expectations, source style, examples, forbidden angles."
            rows={3}
          />
        </Field>

        <Field htmlFor="emailGuidelines" hint="Rules for newsletter or lifecycle email copy." label="Email guidelines">
          <textarea
            defaultValue={profile?.emailGuidelines ?? ""}
            id="emailGuidelines"
            name="emailGuidelines"
            placeholder="Subject line style, length, offer framing, segmentation, CTA preferences."
            rows={3}
          />
        </Field>

        <Field htmlFor="adGuidelines" hint="Rules for paid social or ad copy." label="Ad guidelines">
          <textarea
            defaultValue={profile?.adGuidelines ?? ""}
            id="adGuidelines"
            name="adGuidelines"
            placeholder="Offer angle, claim limits, CTA, proof needed, compliance warnings."
            rows={3}
          />
        </Field>
      </div>

      <Field htmlFor="bannedPhrases" hint="Words, claims, or phrases the AI must avoid. Comma separated." label="Banned phrases">
        <textarea
          defaultValue={formatArray(profile?.bannedPhrases ?? [])}
          id="bannedPhrases"
          name="bannedPhrases"
          placeholder="Revolutionary, guaranteed results, cheap, anything legally risky"
          rows={3}
        />
      </Field>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} />
      </div>
    </form>
  );
}
