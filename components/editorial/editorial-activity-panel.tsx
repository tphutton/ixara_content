import Link from "next/link";

type Version = {
  id: string;
  version: number;
  source: string;
  changeSummary: string | null;
  createdAt: Date;
  createdBy: { fullName: string | null; email: string } | null;
};

type Comment = {
  id: string;
  body: string;
  status: string;
  isChangeRequest: boolean;
  sectionKey: string | null;
  fieldKey: string | null;
  createdAt: Date;
  createdBy: { fullName: string | null; email: string };
};

export function EditorialActivityPanel({
  versions,
  comments,
  commentAction,
  resolveAction,
  href,
}: {
  versions: Version[];
  comments: Comment[];
  commentAction: (formData: FormData) => Promise<void>;
  resolveAction: (commentId: string) => Promise<void>;
  href: string;
}) {
  return (
    <section className="quiet-panel editorial-activity-panel">
      <div className="section-heading">
        <div>
          <p className="kicker">Editorial workspace</p>
          <h3>Review, discuss, and restore</h3>
        </div>
        <span className="inline-chip">{comments.filter((comment) => comment.status === "open").length} open</span>
      </div>
      <div className="editorial-activity-grid">
        <div>
          <div className="editorial-subheading"><strong>Comments and change requests</strong><span>{comments.length}</span></div>
          <div className="editorial-comment-list">
            {comments.length === 0 ? <p className="muted">No review notes yet.</p> : comments.map((comment) => (
              <article className={`editorial-comment ${comment.status !== "open" ? "editorial-comment--closed" : ""}`} key={comment.id}>
                <div className="editorial-comment__meta"><strong>{comment.isChangeRequest ? "Change request" : "Comment"}</strong><span>{comment.status}</span></div>
                <p>{comment.body}</p>
                <small>{comment.sectionKey ?? comment.fieldKey ?? "Record level"} · {comment.createdBy.fullName ?? comment.createdBy.email}</small>
                {comment.status === "open" ? <form action={resolveAction.bind(null, comment.id)}><button className="button button--quiet" type="submit">Resolve</button></form> : null}
              </article>
            ))}
          </div>
          <form action={commentAction} className="editorial-comment-form">
            <textarea name="body" placeholder="Add a review note or change request..." required rows={3} />
            <div className="editorial-comment-form__controls">
              <input name="sectionKey" placeholder="Section or shot (optional)" />
              <label><input name="isChangeRequest" type="checkbox" /> Change request</label>
              <button className="button button--primary" type="submit">Add note</button>
            </div>
          </form>
        </div>
        <div>
          <div className="editorial-subheading"><strong>Version history</strong><span>{versions.length}</span></div>
          <div className="editorial-version-list">
            {versions.length === 0 ? <p className="muted">Versions will appear after the next saved edit.</p> : versions.map((version) => (
              <div className="editorial-version" key={version.id}>
                <div><strong>Version {version.version}</strong><span>{version.source}</span></div>
                <p>{version.changeSummary ?? "Saved record snapshot"}</p>
                <small>{version.createdBy?.fullName ?? version.createdBy?.email ?? "System"} · {version.createdAt.toLocaleString()}</small>
              </div>
            ))}
          </div>
          <Link className="button button--secondary editorial-activity__link" href={href}>Refresh activity</Link>
        </div>
      </div>
    </section>
  );
}
