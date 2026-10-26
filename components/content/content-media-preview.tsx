import { mediaKind, publicMediaUrl } from "@/lib/content/production-pack";

type Media = { fileUrl: string; title: string; mimeType?: string | null; mediaType?: string | null; thumbnailUrl?: string | null; altText?: string | null };

export function ContentMediaPreview({ asset, imageUrl }: { asset?: Media | null; imageUrl?: string | null }) {
  const sources = [asset ? { ...asset, label: "Linked asset" } : null, imageUrl && imageUrl !== asset?.fileUrl ? { fileUrl: imageUrl, title: "Reference artwork", label: "Reference artwork" } : null].filter((item): item is Media & { label: string } => Boolean(item));
  return <section className="quiet-panel"><div className="section-heading"><div><p className="kicker">Assets</p><h3>Media preview</h3></div></div>
    {sources.length ? sources.map((source) => {
      const url = publicMediaUrl(source.fileUrl);
      if (!url) return <p className="muted" key={source.fileUrl}>The {source.label.toLowerCase()} does not have a valid public media URL.</p>;
      const kind = mediaKind(url, source.mimeType, source.mediaType);
      return <figure className="content-media-preview" key={url}><figcaption><span className="kicker">{source.label}</span><strong>{source.title}</strong></figcaption>
        {kind === "video" ? <video controls preload="metadata" poster={publicMediaUrl(source.thumbnailUrl) ?? undefined} src={url} /> : kind === "audio" ? <audio controls preload="metadata" src={url} /> : kind === "image" ? <img src={url} alt={source.altText ?? source.title} loading="lazy" /> : <p className="muted">Preview unavailable for this file type.</p>}
        <a className="button button--secondary" href={url} target="_blank" rel="noopener noreferrer">Open original {kind === "file" ? "file" : kind}</a>
      </figure>;
    }) : <p className="muted">No media selected yet. Creative directions are available in the production brief.</p>}
  </section>;
}
