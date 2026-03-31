import Link from "next/link";
import { BlogForm } from "@/components/blogs/blog-form";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { createBlogAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewBlogPage() {
  return (
    <section className="page-shell">
      <WorkspaceHeader
        title="New Blog"
        description="Create a structured article with author metadata, feature image, and up to 8 managed content sections."
      />

      <div className="stack">
        <Link className="button button--secondary" href="/blogs">
          Back to blogs
        </Link>
        <div className="card card--padded">
          <BlogForm action={createBlogAction} />
        </div>
      </div>
    </section>
  );
}
