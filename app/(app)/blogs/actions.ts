"use server";

import { BlogStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createActionLog } from "@/lib/actions/action-log";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import {
  parseBoolean,
  parseNullableDate,
  parseOptionalString,
  parseStringArray,
} from "@/lib/forms/parsers";
import { prisma } from "@/lib/prisma";

const sectionIndexes = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function parseBlogStatus(value: FormDataEntryValue | null) {
  return Object.values(BlogStatus).includes(value as BlogStatus)
    ? (value as BlogStatus)
    : BlogStatus.idea;
}

function getBlogInput(formData: FormData) {
  const sections = Object.fromEntries(
    sectionIndexes.flatMap((index) => [
      [`text${index}`, parseOptionalString(formData.get(`text${index}`))],
      [`image${index}`, parseOptionalString(formData.get(`image${index}`))],
      [`image${index}Caption`, parseOptionalString(formData.get(`image${index}Caption`))],
    ]),
  );

  return {
    title: String(formData.get("title") ?? "").trim(),
    postDate: parseNullableDate(formData.get("postDate")),
    authorName: parseOptionalString(formData.get("authorName")),
    authorImage: parseOptionalString(formData.get("authorImage")),
    featureImage: parseOptionalString(formData.get("featureImage")),
    ...sections,
    websites: parseStringArray(formData.get("websites")),
    category: parseOptionalString(formData.get("category")),
    tags: parseStringArray(formData.get("tags")),
    authorBio: parseOptionalString(formData.get("authorBio")),
    status: parseBlogStatus(formData.get("status")),
    sport: parseOptionalString(formData.get("sport")),
    region: parseOptionalString(formData.get("region")),
    country: parseOptionalString(formData.get("country")),
    sources: parseStringArray(formData.get("sources")),
    aiGenerated: parseBoolean(formData.get("aiGenerated")),
    sourcePrompt: parseOptionalString(formData.get("sourcePrompt")),
  };
}

export async function createBlogAction(formData: FormData) {
  const access = await requireApprovedUserAccess();
  const data = getBlogInput(formData);

  if (!data.title) {
    throw new Error("Title is required.");
  }

  const blog = await prisma.blog.create({
    data: {
      ...data,
      createdById: access.id,
      updatedById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "create",
    targetType: "blog",
    targetId: blog.id,
    summary: `Created blog "${blog.title}"`,
    afterData: blog,
    source: "manual",
  });

  revalidatePath("/blogs");
  redirect(`/blogs/${blog.id}`);
}

export async function updateBlogAction(id: string, formData: FormData) {
  const access = await requireApprovedUserAccess();
  const before = await prisma.blog.findUniqueOrThrow({ where: { id } });
  const data = getBlogInput(formData);

  if (!data.title) {
    throw new Error("Title is required.");
  }

  const blog = await prisma.blog.update({
    where: { id },
    data: {
      ...data,
      updatedById: access.id,
    },
  });

  await createActionLog({
    userId: access.id,
    actionType: "update",
    targetType: "blog",
    targetId: blog.id,
    summary: `Updated blog "${blog.title}"`,
    beforeData: before,
    afterData: blog,
    source: "manual",
  });

  revalidatePath("/blogs");
  revalidatePath(`/blogs/${id}`);
}

export async function deleteBlogAction(id: string) {
  const access = await requireApprovedUserAccess();
  const before = await prisma.blog.findUniqueOrThrow({ where: { id } });

  await prisma.blog.delete({ where: { id } });

  await createActionLog({
    userId: access.id,
    actionType: "delete",
    targetType: "blog",
    targetId: id,
    summary: `Deleted blog "${before.title}"`,
    beforeData: before,
    source: "manual",
  });

  revalidatePath("/blogs");
  redirect("/blogs");
}
