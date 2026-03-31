import { Blog } from "@prisma/client";

type BlogPreviewProps = {
  blog: Blog;
};

const sectionIndexes = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function BlogPreview({ blog }: BlogPreviewProps) {
  return (
    <article className="card card--padded">
      <p className="kicker">Article preview</p>
      <h3 style={{ marginTop: 0 }}>{blog.title}</h3>
      <p className="muted">
        {blog.authorName || "Unassigned author"}
        {blog.postDate ? ` • ${new Date(blog.postDate).toLocaleString()}` : ""}
      </p>

      {blog.featureImage ? (
        <div className="preview-media">
          <strong>Feature image</strong>
          <p className="muted">{blog.featureImage}</p>
        </div>
      ) : null}

      <div className="stack">
        {sectionIndexes.map((index) => {
          const text = blog[`text${index}` as keyof Blog] as string | null;
          const image = blog[`image${index}` as keyof Blog] as string | null;
          const caption = blog[`image${index}Caption` as keyof Blog] as string | null;

          if (!text && !image && !caption) {
            return null;
          }

          return (
            <section className="card card--padded" key={index}>
              <strong>Section {index}</strong>
              {text ? <p style={{ whiteSpace: "pre-wrap" }}>{text}</p> : <p className="muted">No section copy yet.</p>}
              {image ? <p className="muted">Image: {image}</p> : null}
              {caption ? <p className="muted">Caption: {caption}</p> : null}
            </section>
          );
        })}
      </div>
    </article>
  );
}
