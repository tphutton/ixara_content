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
} from "../settings/actions";

export const dynamic = "force-dynamic";

type BrandsPageProps = {
  searchParams?: Promise<{ new?: string; edit?: string; view?: string }>;
};

function listSummary(values: string[], fallback = "Not set") {
  if (values.length === 0) return fallback;
  return values.slice(0, 3).join(", ") + (values.length > 3 ? ` +${values.length - 3}` : "");
}

export default async function BrandsPage({ searchParams }: BrandsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const isCreating = resolvedSearchParams?.new === "1";
  const profiles = await prisma.brandProfile.findMany({
    orderBy: { brandName: "asc" },
  });
  const editingProfile = resolvedSearchParams?.edit
    ? profiles.find((profile) => profile.id === resolvedSearchParams.edit) ?? null
    : null;
  const viewingProfile = resolvedSearchParams?.view
    ? profiles.find((profile) => profile.id === resolvedSearchParams.view) ?? null
    : null;
  const readinessRows = profiles.map((profile) => ({
    profile,
    readiness: getBrandProfileReadiness(profile),
    channelRules: [
      profile.instagramGuidelines,
      profile.facebookGuidelines,
      profile.linkedinGuidelines,
      profile.blogGuidelines,
      profile.emailGuidelines,
      profile.adGuidelines,
    ].filter(Boolean).length,
  }));

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Brands"
        description="Manage the brand intelligence Quill and Atlas use for tone, audience, offers, channels, and publishing constraints."
        actions={
          <Link className="button button--primary" href="/brands?new=1">
            New brand profile
          </Link>
        }
      />

      <div className="summary-strip">
        <div className="summary-tile"><p className="summary-tile__label">Profiles</p><strong>{profiles.length}</strong></div>
        <div className="summary-tile"><p className="summary-tile__label">AI-ready</p><strong>{readinessRows.filter(({ readiness }) => readiness.score >= 80).length}</strong></div>
        <div className="summary-tile"><p className="summary-tile__label">Needs work</p><strong>{readinessRows.filter(({ readiness }) => readiness.score < 80).length}</strong></div>
        <div className="summary-tile"><p className="summary-tile__label">Average readiness</p><strong>{profiles.length ? Math.round(readinessRows.reduce((total, row) => total + row.readiness.score, 0) / profiles.length) : 0}%</strong></div>
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
          <div className="table-shell">
            <table className="table brand-table">
              <thead><tr><th>Brand</th><th>Readiness</th><th>Tone & audience</th><th>Markets</th><th>Knowledge</th><th>Updated</th><th aria-label="Actions" /></tr></thead>
              <tbody>
            {readinessRows.map(({ profile, readiness, channelRules }) => {
              const deleteAction = deleteBrandProfileAction.bind(null, profile.id);

              return (
                <tr key={profile.id}>
                  <td><Link href={`/brands?view=${profile.id}`}><strong>{profile.brandName}</strong></Link><div className="table-subtext">{profile.description ?? "No description"}</div></td>
                  <td><div className="table-status"><StatusBadge label={readiness.status} /><strong>{readiness.score}%</strong></div>{readiness.missing.length ? <div className="table-subtext">{readiness.missing.length} gaps</div> : null}</td>
                  <td><strong>{profile.defaultTone ?? "Not set"}</strong><div className="table-subtext">{profile.targetAudience ?? "Audience not set"}</div></td>
                  <td>{listSummary([...profile.regions, ...profile.countries])}</td>
                  <td><strong>{profile.contentPillars.length} pillars</strong><div className="table-subtext">{profile.proofPoints.length} proof · {profile.seoKeywords.length} SEO · {channelRules} channels</div></td>
                  <td>{new Date(profile.updatedAt).toLocaleDateString()}</td>
                  <td><div className="row-actions table-actions"><Link className="button button--secondary" href={`/brands?view=${profile.id}`}>View</Link><Link className="button button--secondary" href={`/brands?edit=${profile.id}`}>Edit</Link><form action={deleteAction}><button className="button button--secondary" type="submit">Delete</button></form></div></td>
                </tr>
              );
            })}
              </tbody>
            </table>
          </div>
        )}

      {viewingProfile ? (() => {
        const readiness = getBrandProfileReadiness(viewingProfile);
        return <div className="editor-overlay editor-overlay--dialog">
          <div className="editor-overlay__backdrop"><Link aria-label="Close brand details" href="/brands" /></div>
          <section className="editor-overlay__panel brand-detail-panel">
            <div className="editor-overlay__header"><div><p className="kicker">Brand profile</p><h3>{viewingProfile.brandName}</h3><div className="toolbar__group"><StatusBadge label={readiness.status} /><span className="inline-chip">{readiness.score}% AI-ready</span></div></div><Link className="button button--secondary" href="/brands">Close</Link></div>
            <div className="editor-overlay__content stack">
              <div><p className="kicker">Positioning</p><p>{viewingProfile.description ?? "No description added."}</p><p className="muted">{viewingProfile.positioning ?? "No positioning guidance added."}</p></div>
              <div className="metadata-grid"><div><span>Tone</span><strong>{viewingProfile.defaultTone ?? "Not set"}</strong></div><div><span>Audience</span><strong>{viewingProfile.targetAudience ?? "Not set"}</strong></div><div><span>Markets</span><strong>{listSummary([...viewingProfile.regions, ...viewingProfile.countries])}</strong></div><div><span>Sports</span><strong>{listSummary(viewingProfile.sports)}</strong></div></div>
              <div><p className="kicker">Content intelligence</p><div className="quiet-meta">{viewingProfile.contentPillars.map((item) => <span key={item}>{item}</span>)}{viewingProfile.contentPillars.length === 0 ? <span>No pillars</span> : null}</div></div>
              <div><p className="kicker">Offers & proof</p><p><strong>Offers:</strong> {listSummary(viewingProfile.keyOffers)}</p><p><strong>Proof:</strong> {listSummary(viewingProfile.proofPoints)}</p><p><strong>Preferred CTAs:</strong> {listSummary(viewingProfile.preferredCTAs)}</p></div>
              {readiness.missing.length ? <div><p className="kicker">AI context gaps</p><div className="quiet-meta">{readiness.missing.map((item) => <span key={item.key}>{item.label}</span>)}</div></div> : null}
            </div>
            <div className="editor-overlay__footer form-actions"><Link className="button button--primary" href={`/brands?edit=${viewingProfile.id}`}>Edit brand profile</Link></div>
          </section>
        </div>;
      })() : null}

      {isCreating ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close create profile" href="/brands" />
          </div>
          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Brand intelligence</p>
                <h3>Create brand profile</h3>
                <p className="muted">Add the core operating context Quill and Atlas need for brand-safe work.</p>
              </div>
              <Link className="button button--secondary" href="/brands">
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
            <Link aria-label="Close edit profile" href="/brands" />
          </div>
          <div className="editor-overlay__panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Brand intelligence</p>
                <h3>{editingProfile.brandName}</h3>
                <p className="muted">Update the brand context used by manual workflows, Quill, and Atlas.</p>
              </div>
              <Link className="button button--secondary" href="/brands">
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
