import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AssetSyncButton } from "@/components/assets/asset-sync-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { prisma } from "@/lib/prisma";
import { syncWordPressAssetsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const assets = await prisma.asset.findMany({
    orderBy: { syncedAt: "desc" },
    take: 100,
  });

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="Assets"
        description="Manage synced WordPress media and attach reusable assets across content, blogs, and campaigns."
      />

      <div className="stack">
        <form action={syncWordPressAssetsAction}>
          <AssetSyncButton />
        </form>

        {assets.length === 0 ? (
          <div className="card card--padded empty-state">
            <h3>No assets synced yet</h3>
            <p className="muted">Sync the latest WordPress media library items to create your internal asset catalog.</p>
          </div>
        ) : (
          <div className="card table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Dimensions</th>
                  <th>Source</th>
                  <th>Synced</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <div className="stack" style={{ gap: 6 }}>
                        <strong>{asset.title}</strong>
                        <Link className="muted" href={asset.fileUrl} target="_blank">
                          Open media URL
                        </Link>
                      </div>
                    </td>
                    <td>{asset.mimeType ?? asset.mediaType ?? "—"}</td>
                    <td>
                      {asset.width && asset.height ? `${asset.width} × ${asset.height}` : "—"}
                    </td>
                    <td>{asset.source}</td>
                    <td>
                      {asset.syncedAt
                        ? formatDistanceToNow(asset.syncedAt, { addSuffix: true })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
