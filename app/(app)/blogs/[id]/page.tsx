import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogForm } from "@/components/blogs/blog-form";
import { BlogPreview } from "@/components/blogs/blog-preview";
import { SubmitButton } from "@/components/forms/submit-button";
import { WorkspaceHeader } from "@/components/layout/workspace-header";
import { prisma } from "@/lib/prisma";
import { deleteBlogAction, updateBlogAction } from "../actions";

export const dynamic = "force-dynamic";

type BlogDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { id } = await params;
  const blog = await prisma.blog.findUnique({ where: { id } });

  if (!blog) {
    notFound();
  }

  const updateAction = updateBlogAction.bind(null, id);
  const deleteAction = deleteBlogAction.bind(null, id);

  return (
    <section className="page-shell">
      <WorkspaceHeader
        title={blog.title}
        description="Manage article metadata and the structured 8-block editorial body."
      />

      <div className="grid" style={{ gridTemplateColumns: "1.25fr 0.85fr", alignItems: "start" }}>
        <div className="stack">
          <Link className="button button--secondary" href="/blogs">
            Back to blogs
          </Link>
          <div className="card card--padded">
            <BlogForm action={updateAction} blog={blog} />
          </div>
          <form action={deleteAction}>
            <SubmitButton label="Delete blog" pendingLabel="Deleting..." variant="secondary" />
          </form>
        </div>

        <BlogPreview blog={blog} />
      </div>
    </section>
  );
}
