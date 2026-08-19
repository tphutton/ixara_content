import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Search, Sparkles, Trash2 } from "lucide-react";
import { AssetSyncButton } from "@/components/assets/asset-sync-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { SubmitButton } from "@/components/forms/submit-button";
import { prisma } from "@/lib/prisma";
import {
  deleteAssetAction,
  syncTsadbAssetsAction,
  syncWordPressAssetsAction,
} from "./actions";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

type AssetsPageProps = {
  searchParams?: Promise<{
    q?: string;
    region?: string;
    country?: string;
    category?: string;
    imageType?: string;
    source?: string;
    featured?: string;
    asset?: string;
  }>;
};

export default async function AssetsPage({ searchParams }: AssetsPageProps) {
  const params = searchParams ? await searchParams : {};
  const where = buildAssetWhere(params);
  const [assets, allAssets, totalAssets, tsadbAssets, featuredAssets, selectedAsset] = await Promise.all([
    prisma.asset.findMany({
      where,
      orderBy: [{ featured: "desc" }, { syncedAt: "desc" }, { updatedAt: "desc" }],
      take: 120,
      include: {
        _count: {
          select: {
            contentPrimaryFor: true,
            blogFeatureFor: true,
            contentLinks: true,
            blogLinks: true,
            campaignLinks: true,
          },
        },
      },
    }),
    prisma.asset.findMany({
      select: {
        source: true,
        region: true,
        country: true,
        category: true,
        imageType: true,
      },
      take: 2000,
    }),
    prisma.asset.count(),
    prisma.asset.count({ where: { source: "tsadb" } }),
    prisma.asset.count({ where: { featured: true } }),
    params.asset
      ? prisma.asset.findUnique({
          where: { id: params.asset },
          include: {
            _count: {
              select: {
                contentPrimaryFor: true,
                blogFeatureFor: true,
                contentLinks: true,
                blogLinks: true,
                campaignLinks: true,
              },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const facets = {
    sources: uniqueValues(allAssets.map((asset) => asset.source)),
    regions: uniqueValues(allAssets.map((asset) => asset.region)),
    countries: uniqueValues(allAssets.map((asset) => asset.country)),
    categories: uniqueValues(allAssets.map((asset) => asset.category)),
    imageTypes: uniqueValues(allAssets.map((asset) => asset.imageType)),
  };

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Assets"
        description="Search, sync, and curate reusable image assets for plans, campaigns, content, blogs, and publishing workflows."
      />

      <div className="asset-summary-grid">
        <article className="quiet-panel">
          <p className="kicker">Library</p>
          <strong className="asset-stat">{totalAssets}</strong>
          <p className="muted">Total synced assets available for editorial planning.</p>
        </article>
        <article className="quiet-panel">
          <p className="kicker">Enriched</p>
          <strong className="asset-stat">{tsadbAssets}</strong>
          <p className="muted">TSADB images with region, category, item, and description context.</p>
        </article>
        <article className="quiet-panel">
          <p className="kicker">Featured</p>
          <strong className="asset-stat">{featuredAssets}</strong>
          <p className="muted">Priority images the planner should consider first.</p>
        </article>
      </div>

      <div className="asset-ops-grid">
        <form action={syncTsadbAssetsAction} className="quiet-panel asset-sync-panel">
          <div>
            <p className="kicker">Enriched TSADB sync</p>
            <h3>Bring in the useful image metadata</h3>
            <p className="muted">
              Pulls descriptions, regions, countries, categories, item links, featured state, and WordPress IDs.
            </p>
          </div>
          <div className="asset-sync-fields">
            <label>
              <span>Owner ID</span>
              <input name="ownerId" placeholder="Optional if TSADB_IMAGES_OWNER_ID is set" />
            </label>
            <label>
              <span>Sales item ID</span>
              <input name="salesItemId" placeholder="Optional targeted sync" />
            </label>
            <label>
              <span>Limit</span>
              <input defaultValue="1000" min="1" name="limit" type="number" />
            </label>
          </div>
          <SubmitButton label="Sync enriched images" pendingLabel="Syncing images..." />
        </form>

        <form action={syncWordPressAssetsAction} className="quiet-panel asset-sync-panel">
          <div>
            <p className="kicker">WordPress sync</p>
            <h3>Refresh recent media</h3>
            <p className="muted">
              Pulls the latest public WordPress media records for files that are not yet in the catalog.
            </p>
          </div>
          <AssetSyncButton />
        </form>
      </div>

      <form className="quiet-panel asset-filter-panel">
        <div className="asset-search-field">
          <Search aria-hidden="true" size={18} />
          <input
            defaultValue={params.q ?? ""}
            name="q"
            placeholder="Search title, caption, description, item, category, region, or country"
          />
        </div>
        <FilterSelect label="Source" name="source" options={facets.sources} value={params.source} />
        <FilterSelect label="Region" name="region" options={facets.regions} value={params.region} />
        <FilterSelect label="Country" name="country" options={facets.countries} value={params.country} />
        <FilterSelect label="Category" name="category" options={facets.categories} value={params.category} />
        <FilterSelect label="Image type" name="imageType" options={facets.imageTypes} value={params.imageType} />
        <label>
          <span>Featured</span>
          <select defaultValue={params.featured ?? ""} name="featured">
            <option value="">Any</option>
            <option value="1">Featured only</option>
          </select>
        </label>
        <button className="button button--primary" type="submit">
          Filter
        </button>
        <Link className="button button--secondary" href="/assets">
          Reset
        </Link>
      </form>

      {assets.length === 0 ? (
        <div className="card card--padded empty-state">
          <h3>No assets match this view</h3>
          <p className="muted">Sync enriched images or broaden the filters to find reusable creative.</p>
        </div>
      ) : (
        <div className="asset-grid">
          {assets.map((asset) => (
            <article className="asset-card" key={asset.id}>
              <Link className="asset-card__image" href={assetLink(params, asset.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={asset.altText ?? asset.title} src={asset.thumbnailUrl ?? asset.fileUrl} />
                {asset.featured ? <span className="asset-card__flag">Featured</span> : null}
              </Link>
              <div className="asset-card__body">
                <div>
                  <h3>{asset.title}</h3>
                  <p className="muted">{asset.description ?? asset.caption ?? "No description yet"}</p>
                </div>
                <div className="quiet-meta">
                  <span>{asset.source}</span>
                  {asset.region ? <span>{asset.region}</span> : null}
                  {asset.country ? <span>{asset.country}</span> : null}
                  {asset.category ? <span>{asset.category}</span> : null}
                  {asset.imageType ? <span>{asset.imageType}</span> : null}
                </div>
                <div className="asset-card__footer">
                  <span className="muted">{usageCount(asset)} linked use{usageCount(asset) === 1 ? "" : "s"}</span>
                  <Link className="button button--secondary" href={assetLink(params, asset.id)}>
                    Preview
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedAsset ? (
        <div className="editor-overlay">
          <div className="editor-overlay__backdrop">
            <Link aria-label="Close asset preview" href={assetLink(params, null)} />
          </div>
          <div className="editor-overlay__panel asset-preview-panel">
            <div className="editor-overlay__header">
              <div>
                <p className="kicker">Asset preview</p>
                <h3>{selectedAsset.title}</h3>
                <p className="muted">{selectedAsset.fileUrl}</p>
              </div>
              <Link className="button button--secondary" href={assetLink(params, null)}>
                Close
              </Link>
            </div>
            <div className="editor-overlay__content">
              <div className="asset-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={selectedAsset.altText ?? selectedAsset.title} src={selectedAsset.fileUrl} />
                <div className="asset-preview__details">
                  <div className="asset-recommendation-note">
                    <Sparkles aria-hidden="true" size={18} />
                    <p>
                      Best used when the plan matches{" "}
                      {[selectedAsset.region, selectedAsset.country, selectedAsset.category, selectedAsset.itemType]
                        .filter(Boolean)
                        .join(", ") || "this asset's saved metadata"}
                      .
                    </p>
                  </div>
                  <div className="metadata-grid">
                    <div><span>Description</span><strong>{selectedAsset.description ?? "Not set"}</strong></div>
                    <div><span>Caption</span><strong>{selectedAsset.caption ?? "Not set"}</strong></div>
                    <div><span>Item</span><strong>{selectedAsset.itemName ?? selectedAsset.itemId ?? "Not linked"}</strong></div>
                    <div><span>Region</span><strong>{selectedAsset.region ?? "Not set"}</strong></div>
                    <div><span>Country</span><strong>{selectedAsset.country ?? "Not set"}</strong></div>
                    <div><span>Category</span><strong>{selectedAsset.category ?? "Not set"}</strong></div>
                    <div><span>Type</span><strong>{selectedAsset.imageType ?? selectedAsset.itemType ?? "Not set"}</strong></div>
                    <div><span>WordPress ID</span><strong>{selectedAsset.wordpressAttachmentId ?? "Not set"}</strong></div>
                    <div><span>Orientation</span><strong>{selectedAsset.orientation ?? "Unknown"}</strong></div>
                    <div><span>Synced</span><strong>{selectedAsset.syncedAt ? formatDistanceToNow(selectedAsset.syncedAt, { addSuffix: true }) : "Unknown"}</strong></div>
                  </div>
                  <div className="row-actions">
                    <Link className="button button--secondary" href={selectedAsset.fileUrl} target="_blank">
                      Open original
                    </Link>
                    <form action={deleteAssetAction}>
                      <input name="id" type="hidden" value={selectedAsset.id} />
                      <button className="button button--secondary" type="submit">
                        <Trash2 aria-hidden="true" size={16} />
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function buildAssetWhere(params: Awaited<NonNullable<AssetsPageProps["searchParams"]>>) {
  const q = clean(params.q);
  const where: Prisma.AssetWhereInput = {
    source: clean(params.source) ? (clean(params.source) as never) : undefined,
    region: clean(params.region) ?? undefined,
    country: clean(params.country) ?? undefined,
    category: clean(params.category) ?? undefined,
    imageType: clean(params.imageType) ?? undefined,
    featured: params.featured === "1" ? true : undefined,
    OR: q
      ? [
          { title: { contains: q, mode: "insensitive" } },
          { altText: { contains: q, mode: "insensitive" } },
          { caption: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
          { itemName: { contains: q, mode: "insensitive" } },
          { itemType: { contains: q, mode: "insensitive" } },
          { imageType: { contains: q, mode: "insensitive" } },
          { region: { contains: q, mode: "insensitive" } },
          { country: { contains: q, mode: "insensitive" } },
          { tags: { has: q } },
        ]
      : undefined,
  };

  return where;
}

function clean(value: string | undefined) {
  return value?.trim() || null;
}

function uniqueValues(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function FilterSelect({
  label,
  name,
  options,
  value,
}: {
  label: string;
  name: string;
  options: string[];
  value?: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <select defaultValue={value ?? ""} name={name}>
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function assetLink(
  params: Awaited<NonNullable<AssetsPageProps["searchParams"]>>,
  assetId: string | null,
) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "asset" && value) next.set(key, value);
  }
  if (assetId) next.set("asset", assetId);
  return `/assets${next.size ? `?${next.toString()}` : ""}`;
}

function usageCount(asset: {
  _count: {
    contentPrimaryFor: number;
    blogFeatureFor: number;
    contentLinks: number;
    blogLinks: number;
    campaignLinks: number;
  };
}) {
  return (
    asset._count.contentPrimaryFor +
    asset._count.blogFeatureFor +
    asset._count.contentLinks +
    asset._count.blogLinks +
    asset._count.campaignLinks
  );
}
