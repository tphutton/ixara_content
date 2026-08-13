import Link from "next/link";
import { BrandProfileForm } from "@/components/settings/brand-profile-form";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getBrandProfileReadiness } from "@/lib/brand-profiles/intelligence";
import { prisma } from "@/lib/prisma";
import {
  createBrandProfileAction,
  deleteBrandProfileAction,
  updateBrandProfileAction,
} from "./actions";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams?: Promise<{ new?: string; edit?: string }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isCreating = resolvedSearchParams?.new === "1";
  const profiles = await prisma.brandProfile.findMany({
    orderBy: { brandName: "asc" },
  });
  const editingProfile = resolvedSearchParams?.edit
    ? profiles.find((profile) => profile.id === resolvedSearchParams.edit) ?? null
    : null;

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Settings"
        description="Manage shared brand rules so the editorial team and AI assistant work from the same tone, audience, and publishing constraints."
        actions={
          <Link className="button button--primary" href="/settings?new=1">
            New brand profile
          </Link>
        }
      />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)" }}>
        <article className="quiet-panel">
          <p className="kicker">Brand profiles</p>
          <h3 style={{ marginTop: 0 }}>Brand operating profiles</h3>
          <p className="muted">
            These profiles give the assistant shared context for tone, audience, approved sites,
            regional focus, and banned phrases.
          </p>
          <div className="metadata-grid">
            <div><span>Total profiles</span><strong>{profiles.length}</strong></div>
            <div><span>Strong readiness</span><strong>{profiles.filter((profile) => getBrandProfileReadiness(profile).score >= 80).length}</strong></div>
          </div>
          <Link className="button button--primary" href="/settings?new=1">
            Create profile
          </Link>
        </article>

        <article className="quiet-panel">
          <p className="kicker">Editorial guidance</p>
          <h3 style={{ marginTop: 0 }}>How these rules are used</h3>
          <div className="stack" style={{ gap: 16 }}>
            <div>
              <strong>Chat assistant context</strong>
              <p className="muted" style={{ marginBottom: 0 }}>
                The assistant reads your saved brand profiles during chat so it can keep drafts,
                blog sections, and schedules aligned with each brand&apos;s publishing rules.
              </p>
            </div>
            <div>
              <strong>Manual editorial consistency</strong>
              <p className="muted" style={{ marginBottom: 0 }}>
                Editors can use the same rules when creating records manually, which keeps content
                and campaigns aligned before social publishing is added.
              </p>
            </div>
          </div>
        </article>
      </div>

      <div className="stack">
        <div>
          <p className="kicker">Existing profiles</p>
          <h3 style={{ marginTop: 0 }}>Saved brand rules</h3>
        </div>

        {profiles.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No brand profiles yet</h3>
            <p className="muted">
              Add your first brand profile to give the team and assistant a shared editorial rule
              set.
            </p>
          </div>
        ) : (
          <div className="stack">
            {profiles.map((profile) => {
              const deleteAction = deleteBrandProfileAction.bind(null, profile.id);
              const readiness = getBrandProfileReadiness(profile);

              return (
                <article className="quiet-panel" key={profile.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 16,
                      marginBottom: 20,
                    }}
                  >
                    <div>
                      <h3 style={{ marginTop: 0, marginBottom: 6 }}>{profile.brandName}</h3>
                      <p className="muted" style={{ margin: 0 }}>
                        Updated {new Date(profile.updatedAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="toolbar__group">
                      <StatusBadge label={readiness.status} />
                      <span className="inline-chip">{readiness.score}% AI-ready</span>
                      <Link className="button button--secondary" href={`/settings?edit=${profile.id}`}>
                        Edit
                      </Link>
                      <form action={deleteAction}>
                        <button className="button button--secondary" type="submit">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>

                  {readiness.missing.length > 0 ? (
                    <div className="card card--padded" style={{ marginBottom: 20 }}>
                      <p className="kicker">AI context gaps</p>
                      <p className="muted" style={{ marginTop: 0 }}>
                        Complete these fields before relying on heavy automation for this brand.
                      </p>
                      <div className="toolbar__group">
                        {readiness.missing.slice(0, 8).map((item) => (
                          <span className="inline-chip" key={item.key}>
                            {item.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="metadata-grid">
                    <div><span>Tone</span><strong>{profile.defaultTone ?? "Not set"}</strong></div>
                    <div><span>Audience</span><strong>{profile.targetAudience ?? "Not set"}</strong></div>
                    <div><span>Pillars</span><strong>{profile.contentPillars.length}</strong></div>
                    <div><span>Proof points</span><strong>{profile.proofPoints.length}</strong></div>
                    <div><span>SEO keywords</span><strong>{profile.seoKeywords.length}</strong></div>
                    <div><span>Channel rules</span><strong>{[
                      profile.instagramGuidelines,
                      profile.facebookGuidelines,
                      profile.linkedinGuidelines,
                      profile.blogGuidelines,
                      profile.emailGuidelines,
                      profile.adGuidelines,
                    ].filter(Boolean).length}</strong></div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {isCreating ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close create profile" href="/settings" />
          </div>
          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Brand intelligence</p>
                <h3>Create brand profile</h3>
                <p className="muted">Add the core operating context Quill and Atlas need for brand-safe work.</p>
              </div>
              <Link className="button button--secondary" href="/settings">
                Close
              </Link>
            </div>
            <div className="editor-overlay__content">
              <BrandProfileForm
                action={createBrandProfileAction}
                pendingLabel="Creating profile..."
                submitLabel="Create brand profile"
              />
            </div>
          </div>
        </div>
      ) : null}

      {editingProfile ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close edit profile" href="/settings" />
          </div>
          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Brand intelligence</p>
                <h3>{editingProfile.brandName}</h3>
                <p className="muted">Update the brand context used by manual workflows, Quill, and Atlas.</p>
              </div>
              <Link className="button button--secondary" href="/settings">
                Close
              </Link>
            </div>
            <div className="editor-overlay__content">
              <BrandProfileForm
                action={updateBrandProfileAction.bind(null, editingProfile.id)}
                pendingLabel="Saving profile..."
                profile={editingProfile}
                submitLabel="Save brand profile"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
