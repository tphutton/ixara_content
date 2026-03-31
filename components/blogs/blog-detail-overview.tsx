import { Blog } from "@prisma/client";
import { StatusBadge } from "@/components/ui/status-badge";
import { getBlogReadiness } from "@/lib/blogs/readiness";

type BlogDetailOverviewProps = {
  blog: Blog;
};

const sectionIndexes = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function BlogDetailOverview({ blog }: BlogDetailOverviewProps) {
  const readiness = getBlogReadiness(blog);
  const sectionStats = sectionIndexes.map((index) => {
    const text = blog[`text${index}` as keyof Blog] as string | null;
    const image = blog[`image${index}` as keyof Blog] as string | null;
    const caption = blog[`image${index}Caption` as keyof Blog] as string | null;

    return {
      index,
      hasText: Boolean(text?.trim()),
      hasImage: Boolean(image?.trim()),
      hasCaption: Boolean(caption?.trim()),
      excerpt: text ? stripHtml(text).slice(0, 180) : "",
    };
  });

  const populatedSections = sectionStats.filter(
    (section) => section.hasText || section.hasImage || section.hasCaption,
  );

  return (
    <div className="stack">
      <div className="blog-hero card card--padded">
        <div className="blog-hero__content">
          <div className="blog-hero__meta">
            <StatusBadge label={blog.status} />
            <StatusBadge label={readiness.ready ? "ready" : "warning"} />
            {blog.category ? <span className="inline-chip">{blog.category}</span> : null}
          </div>
          <p className="kicker">Structured article</p>
          <h3>{blog.title}</h3>
          <p className="muted">
            {blog.authorName || "Unassigned author"}
            {blog.postDate
              ? ` • ${new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(new Date(blog.postDate))}`
              : ""}
          </p>
          <div className="blog-chip-row">
            {blog.brand ? <span className="inline-chip">{blog.brand}</span> : null}
            {blog.sport ? <span className="inline-chip">{blog.sport}</span> : null}
            {blog.region ? <span className="inline-chip">{blog.region}</span> : null}
            {blog.country ? <span className="inline-chip">{blog.country}</span> : null}
          </div>
        </div>

        {blog.featureImage ? (
          <div className="blog-hero__media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={blog.title} src={blog.featureImage} />
          </div>
        ) : (
          <div className="blog-hero__empty">
            <span className="inline-chip">Feature image missing</span>
          </div>
        )}
      </div>

      <div className="blog-detail-grid">
        <div className="stack">
          <article className="card card--padded blog-rendered-preview">
            <div className="section-heading">
              <div>
                <p className="kicker">Preview</p>
                <h3>Article flow</h3>
              </div>
              <span className="inline-chip">{populatedSections.length} live sections</span>
            </div>

            <div className="stack">
              {populatedSections.length === 0 ? (
                <div className="preview-media">
                  <strong>No article sections yet</strong>
                  <p className="muted">Open the editor to add copy, imagery, and captions.</p>
                </div>
              ) : (
                populatedSections.map((section) => (
                  <section className="blog-section-preview" key={section.index}>
                    <div className="blog-section-preview__header">
                      <strong>Section {section.index}</strong>
                      <div className="blog-chip-row">
                        {section.hasText ? <span className="inline-chip">Copy</span> : null}
                        {section.hasImage ? <span className="inline-chip">Image</span> : null}
                        {section.hasCaption ? <span className="inline-chip">Caption</span> : null}
                      </div>
                    </div>

                    {section.excerpt ? <p>{section.excerpt}</p> : <p className="muted">No copy yet.</p>}
                  </section>
                ))
              )}
            </div>
          </article>
        </div>

        <div className="stack">
          <div className="card card--padded">
            <p className="kicker">Publishing profile</p>
            <div className="blog-metadata-list">
              <div>
                <span>Status</span>
                <strong>{blog.status}</strong>
              </div>
              <div>
                <span>Brand</span>
                <strong>{blog.brand ?? "Not set"}</strong>
              </div>
              <div>
                <span>Websites</span>
                <strong>{blog.websites.length ? blog.websites.join(", ") : "Not set"}</strong>
              </div>
              <div>
                <span>Author</span>
                <strong>{blog.authorName ?? "Not set"}</strong>
              </div>
              <div>
                <span>Category</span>
                <strong>{blog.category ?? "Not set"}</strong>
              </div>
              <div>
                <span>Updated</span>
                <strong>
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(blog.updatedAt))}
                </strong>
              </div>
            </div>
          </div>

          <div className="card card--padded">
            <p className="kicker">Readiness</p>
            <h3>{readiness.ready ? "Ready for workflow" : "Needs attention"}</h3>
            <p className="muted">
              {readiness.ready
                ? "This article has the core metadata needed for scheduling and automation."
                : `Still missing ${readiness.reasons.join(", ")}.`}
            </p>
          </div>

          <div className="card card--padded">
            <p className="kicker">Section map</p>
            <div className="blog-section-map">
              {sectionStats.map((section) => (
                <div className="blog-section-map__item" key={section.index}>
                  <strong>Section {section.index}</strong>
                  <span>
                    {section.hasText || section.hasImage || section.hasCaption
                      ? [section.hasText ? "copy" : null, section.hasImage ? "image" : null, section.hasCaption ? "caption" : null]
                          .filter(Boolean)
                          .join(" • ")
                      : "empty"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
