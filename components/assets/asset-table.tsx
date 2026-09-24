"use client";

import Link from "next/link";
import * as React from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { bulkUpdateAssetsAction, deleteAssetAction } from "@/app/(app)/assets/actions";

export type AssetTableRow = {
  id: string;
  title: string;
  previewHref: string;
  thumbnailUrl: string | null;
  fileUrl: string;
  altText: string | null;
  source: string;
  description: string | null;
  region: string | null;
  country: string | null;
  category: string | null;
  imageType: string | null;
  featured: boolean;
  sourceRecordCount: number;
  usageCount: number;
};

export function AssetTable({ assets }: { assets: AssetTableRow[] }) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const allSelected = assets.length > 0 && selectedIds.length === assets.length;

  function toggleAll() {
    setSelectedIds(allSelected ? [] : assets.map((asset) => asset.id));
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  return (
    <div className="asset-table-workspace">
      <form action={bulkUpdateAssetsAction} className="asset-bulk-toolbar">
        {selectedIds.map((id) => <input key={id} name="assetIds" type="hidden" value={id} />)}
        <label className="asset-select-all">
          <input aria-label="Select all visible assets" checked={allSelected} onChange={toggleAll} type="checkbox" />
          <span>{selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select visible"}</span>
        </label>
        {selectedIds.length > 0 ? (
          <>
            <select aria-label="Bulk asset action" defaultValue="" name="action">
              <option value="">Choose bulk action</option>
              <option value="feature">Mark featured</option>
              <option value="unfeature">Remove featured</option>
              <option value="delete">Delete from Content</option>
            </select>
            <SubmitButton label="Apply" pendingLabel="Applying..." variant="secondary" />
            <button className="button button--secondary" onClick={() => setSelectedIds([])} type="button">Clear</button>
          </>
        ) : <span className="muted">Select rows to feature, unfeature, or delete local assets.</span>}
      </form>

      <div className="table-shell table-shell--flush">
        <table className="table assets-table">
          <thead><tr><th><span className="sr-only">Select</span></th><th>Asset</th><th>Source</th><th>Context</th><th>Usage</th><th>Status</th><th aria-label="Actions" /></tr></thead>
          <tbody>{assets.map((asset) => {
            return <tr data-selected={selectedIds.includes(asset.id)} key={asset.id}>
              <td><input aria-label={`Select ${asset.title}`} checked={selectedIds.includes(asset.id)} onChange={() => toggleOne(asset.id)} type="checkbox" /></td>
              <td>
                <div className="asset-table__identity">
                  <Link className="asset-table__thumb" href={asset.previewHref}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt={asset.altText ?? asset.title} src={asset.thumbnailUrl ?? asset.fileUrl} />
                  </Link>
                  <div><Link href={asset.previewHref}><strong>{asset.title}</strong></Link><div className="table-subtext">{asset.description ?? "No description yet"}</div></div>
                </div>
              </td>
              <td><span className="inline-chip">{asset.source}</span>{asset.sourceRecordCount > 0 ? <div className="table-subtext">{asset.sourceRecordCount} TSADB record{asset.sourceRecordCount === 1 ? "" : "s"}</div> : null}</td>
              <td><div>{[asset.category, asset.imageType, asset.region, asset.country].filter(Boolean).join(" · ") || "No context"}</div></td>
              <td>{asset.usageCount}</td>
              <td>{asset.featured ? <StatusBadge label="featured" /> : <span className="muted">Standard</span>}</td>
              <td><div className="row-actions table-actions"><Link className="button button--secondary" href={asset.previewHref}>View</Link><form action={deleteAssetAction}><input name="id" type="hidden" value={asset.id} /><button className="button button--secondary" type="submit">Delete</button></form></div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
