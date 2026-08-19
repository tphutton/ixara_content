type BrandRuleGuideProps = {
  profiles: Array<{
    id: string;
    brandName: string;
    defaultTone: string | null;
    targetAudience: string | null;
    preferredWebsites: string[];
    sports: string[];
    regions: string[];
    countries: string[];
    contentPillars?: string[];
    audiencePersonas?: string[];
    keyOffers?: string[];
    proofPoints?: string[];
    seoKeywords?: string[];
    voiceExamples?: string[];
    bannedPhrases: string[];
    preferredCTAs: string[];
  }>;
};

function renderList(values: string[]) {
  return values.length > 0 ? values.join(", ") : "—";
}

export function BrandRuleGuide({ profiles }: BrandRuleGuideProps) {
  if (profiles.length === 0) {
    return (
      <div className="card card--padded">
        <h3 style={{ marginTop: 0 }}>No brand profiles configured</h3>
        <p className="muted" style={{ marginBottom: 0 }}>
          Add profiles in Brands to auto-fill editorial defaults and give the assistant stronger
          brand context.
        </p>
      </div>
    );
  }

  return (
    <div className="card card--padded">
      <p className="kicker">Brand rules</p>
      <h3 style={{ marginTop: 0 }}>Available brand profiles</h3>
      <p className="muted">
        When a record brand matches one of these profiles, missing defaults are filled
        automatically and banned phrases are flagged in the audit trail.
      </p>

      <div className="stack" style={{ gap: 16 }}>
        {profiles.map((profile) => (
          <article
            key={profile.id}
            style={{
              borderTop: "1px solid rgba(15, 23, 42, 0.08)",
              paddingTop: 16,
            }}
          >
            <strong>{profile.brandName}</strong>
            <div className="stack" style={{ gap: 6, marginTop: 10 }}>
              <span className="inline-chip">Tone: {profile.defaultTone ?? "—"}</span>
              <span className="inline-chip">Audience: {profile.targetAudience ?? "—"}</span>
              <span className="inline-chip">
                Websites: {renderList(profile.preferredWebsites)}
              </span>
              <span className="inline-chip">Sports: {renderList(profile.sports)}</span>
              <span className="inline-chip">Regions: {renderList(profile.regions)}</span>
              <span className="inline-chip">Countries: {renderList(profile.countries)}</span>
              <span className="inline-chip">
                Pillars: {renderList(profile.contentPillars ?? [])}
              </span>
              <span className="inline-chip">
                Personas: {renderList(profile.audiencePersonas ?? [])}
              </span>
              <span className="inline-chip">Offers: {renderList(profile.keyOffers ?? [])}</span>
              <span className="inline-chip">Proof: {renderList(profile.proofPoints ?? [])}</span>
              <span className="inline-chip">SEO: {renderList(profile.seoKeywords ?? [])}</span>
              <span className="inline-chip">
                Preferred CTAs: {renderList(profile.preferredCTAs)}
              </span>
              <span className="inline-chip">
                Banned phrases: {renderList(profile.bannedPhrases)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
