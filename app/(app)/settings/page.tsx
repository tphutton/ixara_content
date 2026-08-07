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

export default async function SettingsPage() {
  const profiles = await prisma.brandProfile.findMany({
    orderBy: { brandName: "asc" },
  });

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Settings"
        description="Manage shared brand rules so the editorial team and AI assistant work from the same tone, audience, and publishing constraints."
      />

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)" }}>
        <article className="card card--padded">
          <p className="kicker">Brand profiles</p>
          <h3 style={{ marginTop: 0 }}>Create a brand operating profile</h3>
          <p className="muted">
            These profiles give the assistant shared context for tone, audience, approved sites,
            regional focus, and banned phrases.
          </p>
          <BrandProfileForm
            action={createBrandProfileAction}
            pendingLabel="Creating profile..."
            submitLabel="Create brand profile"
          />
        </article>

        <article className="card card--padded">
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
              const updateAction = updateBrandProfileAction.bind(null, profile.id);
              const deleteAction = deleteBrandProfileAction.bind(null, profile.id);
              const readiness = getBrandProfileReadiness(profile);

              return (
                <article className="card card--padded" key={profile.id}>
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

                  <BrandProfileForm
                    action={updateAction}
                    pendingLabel="Saving profile..."
                    profile={profile}
                    submitLabel="Save brand profile"
                  />
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
