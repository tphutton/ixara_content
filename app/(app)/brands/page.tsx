import Link from "next/link";
import { BrandProfileForm } from "@/components/settings/brand-profile-form";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getBrandProfileReadiness } from "@/lib/brand-profiles/intelligence";
import { prisma } from "@/lib/prisma";
import { runwayVoicePresets } from "@/lib/mcp/runway-character-operations";
import {
  addBrandKitReferenceAction,
  createBrandCharacterAction,
  queueRunwayCharacterAction,
  startRunwayCharacterAction,
  cancelRunwayCharacterAction,
  updateBrandCharacterAction,
  removeBrandKitReferenceAction,
  updateBrandKitReferenceAction,
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
    include: { kitReferences: { include: { asset: true }, orderBy: { createdAt: "desc" } }, characters: { include: { referenceAsset: true }, orderBy: { name: "asc" } } },
  });
  const availableAssets = resolvedSearchParams?.view ? await prisma.asset.findMany({ where: { OR: [{ source: "manual" }, { brand: profiles.find(p => p.id === resolvedSearchParams.view)?.brandName ?? "" }] }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, title: true } }) : [];
  const editingProfile = resolvedSearchParams?.edit
    ? profiles.find((profile) => profile.id === resolvedSearchParams.edit) ?? null
    : null;
  const viewingProfile = resolvedSearchParams?.view
    ? profiles.find((profile) => profile.id === resolvedSearchParams.view) ?? null
    : null;
  const characterJobs = viewingProfile?.characters.length ? await prisma.mediaGenerationJob.findMany({
    where: { provider: "runway", targetType: "brand_character", targetId: { in: viewingProfile.characters.map(character => character.id) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, targetId: true, status: true, error: true, input: true },
  }) : [];
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
        title="Brand Kits"
        description="Manage editorial guidance and approved creative references for each brand."
        actions={
          <Link className="button button--primary" href="/brands?new=1">
            New brand kit
          </Link>
        }
      />

      <div className="summary-strip">
        <div className="summary-tile"><p className="summary-tile__label">Brand kits</p><strong>{profiles.length}</strong></div>
        <div className="summary-tile"><p className="summary-tile__label">AI-ready</p><strong>{readinessRows.filter(({ readiness }) => readiness.score >= 80).length}</strong></div>
        <div className="summary-tile"><p className="summary-tile__label">Needs work</p><strong>{readinessRows.filter(({ readiness }) => readiness.score < 80).length}</strong></div>
        <div className="summary-tile"><p className="summary-tile__label">Average readiness</p><strong>{profiles.length ? Math.round(readinessRows.reduce((total, row) => total + row.readiness.score, 0) / profiles.length) : 0}%</strong></div>
      </div>

      {profiles.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No brand kits yet</h3>
            <p className="muted">
              Add your first brand kit to give the team and assistant a shared editorial rule
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
            <div className="editor-overlay__header"><div><p className="kicker">Brand kit</p><h3>{viewingProfile.brandName}</h3><div className="toolbar__group"><StatusBadge label={readiness.status} /><span className="inline-chip">{readiness.score}% AI-ready</span></div></div><Link className="button button--secondary" href="/brands">Close</Link></div>
            <div className="editor-overlay__content stack">
              <div><p className="kicker">Positioning</p><p>{viewingProfile.description ?? "No description added."}</p><p className="muted">{viewingProfile.positioning ?? "No positioning guidance added."}</p></div>
              <div className="metadata-grid"><div><span>Tone</span><strong>{viewingProfile.defaultTone ?? "Not set"}</strong></div><div><span>Audience</span><strong>{viewingProfile.targetAudience ?? "Not set"}</strong></div><div><span>Markets</span><strong>{listSummary([...viewingProfile.regions, ...viewingProfile.countries])}</strong></div><div><span>Sports</span><strong>{listSummary(viewingProfile.sports)}</strong></div></div>
              <div><p className="kicker">Visual direction</p><p>{viewingProfile.visualGuidelines ?? "No visual guidelines added."}</p></div>
              <div className="stack">
                <div><p className="kicker">Characters</p><p className="muted">Save each presenter’s appearance, personality and voice guidance in this brand kit. Creating or editing a profile does not generate video or spend credits.</p></div>
                {viewingProfile.characters.length ? viewingProfile.characters.map(character => {
                  const job = characterJobs.find(item => item.targetId === character.id);
                  const active = job && ["queued", "submitted", "running"].includes(job.status);
                  const locked = Boolean(character.providerCharacterId || active);
                  const startRequested = job?.input && typeof job.input === "object" && !Array.isArray(job.input) && job.input.startRequested === true;
                  const references = viewingProfile.kitReferences.filter(ref => ref.role === "character" && ref.status === "approved" && ["image/png", "image/jpeg", "image/webp"].includes(ref.asset.mimeType ?? ""));
                  return <div className="quiet-panel stack" key={character.id}>
                    <div><strong>{character.name}</strong> <span className="inline-chip">{character.providerCharacterId ? "Connected to Runway" : active ? `Runway: ${job.status}` : "Profile saved · not connected to Runway"}</span></div>
                    <p><a href={character.referenceAsset.fileUrl} target="_blank" rel="noreferrer">View reference image</a></p>
                    {locked ? <><p><strong>Personality:</strong> {character.personality}</p><p><strong>Voice guidance:</strong> {character.voiceDescription || "Not set"}</p><p className="muted">{active ? "This profile is locked while its Runway job is active." : "Editing connected characters is not available yet."}</p></> :
                    <form action={updateBrandCharacterAction.bind(null, character.id)} className="stack">
                      <label>Name <input name="name" defaultValue={character.name} required maxLength={100} /></label>
                      <label>Approved reference <select name="referenceAssetId" defaultValue={character.referenceAssetId} required>{references.map(ref => <option key={ref.id} value={ref.assetId}>{ref.asset.title}</option>)}</select></label>
                      <label>Personality <textarea name="personality" defaultValue={character.personality} required maxLength={10000} rows={3} /></label>
                      <label>Voice guidance <textarea name="voiceDescription" defaultValue={character.voiceDescription ?? ""} maxLength={2000} rows={2} /></label>
                      <button className="button button--secondary" type="submit">Save character</button>
                    </form>}
                    {!character.providerCharacterId && !active ? <form action={queueRunwayCharacterAction.bind(null, character.id)} className="stack">
                      <strong>Prepare a Runway character</strong>
                      <p className="muted">Choose a preset voice to prepare the character. This step does not contact Runway or spend credits. Kit’s existing narration is not automatically matched to a preset.</p>
                      <label>Runway voice <select name="voicePreset" required defaultValue=""><option value="" disabled>Select a voice</option>{runwayVoicePresets.map(voice => <option key={voice} value={voice}>{voice[0].toUpperCase() + voice.slice(1)}</option>)}</select></label>
                      <button type="submit" className="button button--secondary">Prepare Runway character</button>
                    </form> : null}
                    {job?.status === "queued" ? <div className="stack">
                      <p className="muted">Prepared. Starting sends the approved image and character details to Runway. Check current Runway pricing first.</p>
                      {startRequested ? <p className="muted">Start requested. Waiting for the Runway worker to submit the character.</p> : process.env.RUNWAY_RUNNER_ENABLED === "true" && process.env.RUNWAYML_API_SECRET ? <form action={startRunwayCharacterAction.bind(null, job.id)}><button type="submit" className="button button--primary">Start Runway character</button></form> : <p className="muted">Runway processing is currently disabled. The prepared character will not be submitted.</p>}
                      <form action={cancelRunwayCharacterAction.bind(null, job.id)}><button type="submit" className="button button--secondary">Cancel preparation</button></form>
                    </div> : null}
                    {job?.status === "submitted" && !character.providerCharacterId ? <p className="muted">Submission is being checked. Do not create another character if the result is uncertain.</p> : null}
                    {job?.status === "failed" ? <p className="muted">The last Runway job failed; check its status before trying again.</p> : null}
                  </div>;
                }) : <p className="muted">No characters added yet.</p>}
                {viewingProfile.kitReferences.some(ref => ref.role === "character" && ref.status === "approved" && ["image/png", "image/jpeg", "image/webp"].includes(ref.asset.mimeType ?? "")) ? <form action={createBrandCharacterAction.bind(null, viewingProfile.id)} className="stack quiet-panel">
                  <strong>Add character</strong>
                  <label>Name <input name="name" required maxLength={100} /></label>
                  <label>Approved reference <select name="referenceAssetId" required defaultValue=""><option value="" disabled>Select an approved character image</option>{viewingProfile.kitReferences.filter(ref => ref.role === "character" && ref.status === "approved" && ["image/png", "image/jpeg", "image/webp"].includes(ref.asset.mimeType ?? "")).map(ref => <option key={ref.id} value={ref.assetId}>{ref.asset.title}</option>)}</select></label>
                  <label>Personality <textarea name="personality" required maxLength={10000} rows={3} /></label>
                  <label>Voice guidance <textarea name="voiceDescription" maxLength={2000} rows={2} /></label>
                  <button className="button button--secondary" type="submit">Add character</button>
                </form> : <p className="muted">To add a character, first approve an image with the Character role in Creative references below.</p>}
              </div>
              <div className="stack"><div><p className="kicker">Creative references</p><p className="muted">Keep reusable character, prop, style, logo and sound references here. Upload media in Assets first; episode-specific material belongs with the episode. Draft and retired references are not approved for reuse.</p></div>
                {viewingProfile.kitReferences.length ? viewingProfile.kitReferences.map(ref => <div className="quiet-panel" key={ref.id}>
                  <strong>{ref.asset.title}</strong> <span className="inline-chip">{ref.role} · {ref.status}</span>
                  <form action={updateBrandKitReferenceAction.bind(null, ref.id)} className="stack">
                    <label>Status <select name="status" defaultValue={ref.status}><option value="draft">Draft</option><option value="approved">Approved</option><option value="retired">Retired</option></select></label>
                    <label>Usage notes <textarea name="notes" defaultValue={ref.notes ?? ""} rows={2} /></label>
                    <button className="button button--secondary" type="submit">Save reference</button>
                  </form>
                  <p><a href={ref.asset.fileUrl} target="_blank" rel="noreferrer">Open asset</a></p>
                  <form action={removeBrandKitReferenceAction.bind(null, ref.id)}><button className="button button--secondary" type="submit">Remove from kit</button></form>
                </div>) : <p className="muted">No references added yet.</p>}
                <form action={addBrandKitReferenceAction.bind(null, viewingProfile.id)} className="stack quiet-panel">
                  <strong>Add reference</strong>
                  <label>Asset <select name="assetId" required defaultValue=""><option value="" disabled>Select a recent uploaded or brand asset</option>{availableAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.title}</option>)}</select></label>
                  <label>Role <select name="role" defaultValue="character"><option value="character">Character</option><option value="prop">Prop</option><option value="style">Style</option><option value="logo">Logo</option><option value="voice">Voice</option><option value="music">Music / sound</option><option value="other">Other</option></select></label>
                  <label>Status <select name="status" defaultValue="draft"><option value="draft">Draft</option><option value="approved">Approved</option><option value="retired">Retired</option></select></label>
                  <label>Usage notes <textarea name="notes" rows={2} placeholder="How and when should this reference be used?" /></label>
                  <button className="button button--secondary" type="submit">Add to kit</button>
                </form>
              </div>
              <div><p className="kicker">Content intelligence</p><div className="quiet-meta">{viewingProfile.contentPillars.map((item) => <span key={item}>{item}</span>)}{viewingProfile.contentPillars.length === 0 ? <span>No pillars</span> : null}</div></div>
              <div><p className="kicker">Offers & proof</p><p><strong>Offers:</strong> {listSummary(viewingProfile.keyOffers)}</p><p><strong>Proof:</strong> {listSummary(viewingProfile.proofPoints)}</p><p><strong>Preferred CTAs:</strong> {listSummary(viewingProfile.preferredCTAs)}</p></div>
              {readiness.missing.length ? <div><p className="kicker">AI context gaps</p><div className="quiet-meta">{readiness.missing.map((item) => <span key={item.key}>{item.label}</span>)}</div></div> : null}
            </div>
            <div className="editor-overlay__footer form-actions"><Link className="button button--primary" href={`/brands?edit=${viewingProfile.id}`}>Edit brand kit</Link></div>
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
                <h3>Create brand kit</h3>
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
                submitLabel="Create brand kit"
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
                submitLabel="Save brand kit"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
