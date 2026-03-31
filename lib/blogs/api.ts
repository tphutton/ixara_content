import { BlogStatus, Prisma, type Blog } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type BlogApiShape = {
  id: number | string;
  title: string;
  post_date: string | null;
  author_name: string | null;
  author_image: string | null;
  feature_image: string | null;
  text_1: string | null;
  image_1: string | null;
  image_1_caption: string | null;
  text_2: string | null;
  image_2: string | null;
  image_2_caption: string | null;
  text_3: string | null;
  image_3: string | null;
  image_3_caption: string | null;
  text_4: string | null;
  image_4: string | null;
  image_4_caption: string | null;
  text_5: string | null;
  image_5: string | null;
  image_5_caption: string | null;
  text_6: string | null;
  image_6: string | null;
  image_6_caption: string | null;
  text_7: string | null;
  image_7: string | null;
  image_7_caption: string | null;
  text_8: string | null;
  image_8: string | null;
  image_8_caption: string | null;
  websites: string;
  zoho_id: string | null;
  category: string | null;
  tags: string[];
  author_bio: string | null;
  status: string;
  sport: string | null;
  region: string | null;
  country: string | null;
  blog_id: string;
  sources: string[] | null;
  created_at: string;
  updated_at: string;
};

function formatLegacyArray(values: string[]) {
  if (!values.length) {
    return "{}";
  }

  const escaped = values.map((value) => `"${value.replaceAll("\\", "\\\\").replaceAll("\"", '\\"')}"`);
  return `{${escaped.join(",")}}`;
}

function mapStatusToLegacy(status: BlogStatus) {
  switch (status) {
    case BlogStatus.published:
      return "Live";
    case BlogStatus.review:
      return "Review";
    case BlogStatus.approved:
      return "Approved";
    case BlogStatus.archived:
      return "Archived";
    case BlogStatus.idea:
    case BlogStatus.draft:
    default:
      return "Draft";
  }
}

function mapApiStatusToCurrent(status: string | null | undefined) {
  if (!status) {
    return BlogStatus.published;
  }

  if (Object.values(BlogStatus).includes(status as BlogStatus)) {
    return status as BlogStatus;
  }

  switch (status.toLowerCase()) {
    case "live":
    case "published":
      return BlogStatus.published;
    case "review":
      return BlogStatus.review;
    case "approved":
      return BlogStatus.approved;
    case "archived":
      return BlogStatus.archived;
    case "idea":
      return BlogStatus.idea;
    case "draft":
      return BlogStatus.draft;
    default:
      return undefined;
  }
}

function mapBlogToApiShape(blog: Blog): BlogApiShape {
  return {
    id: blog.legacyExternalId ?? blog.id,
    title: blog.title,
    post_date: blog.postDate?.toISOString() ?? null,
    author_name: blog.authorName,
    author_image: blog.authorImage,
    feature_image: blog.featureImage,
    text_1: blog.text1,
    image_1: blog.image1,
    image_1_caption: blog.image1Caption,
    text_2: blog.text2,
    image_2: blog.image2,
    image_2_caption: blog.image2Caption,
    text_3: blog.text3,
    image_3: blog.image3,
    image_3_caption: blog.image3Caption,
    text_4: blog.text4,
    image_4: blog.image4,
    image_4_caption: blog.image4Caption,
    text_5: blog.text5,
    image_5: blog.image5,
    image_5_caption: blog.image5Caption,
    text_6: blog.text6,
    image_6: blog.image6,
    image_6_caption: blog.image6Caption,
    text_7: blog.text7,
    image_7: blog.image7,
    image_7_caption: blog.image7Caption,
    text_8: blog.text8,
    image_8: blog.image8,
    image_8_caption: blog.image8Caption,
    websites: formatLegacyArray(blog.websites),
    zoho_id: blog.legacyZohoId,
    category: blog.category,
    tags: blog.tags,
    author_bio: blog.authorBio,
    status: mapStatusToLegacy(blog.status),
    sport: blog.sport,
    region: blog.region,
    country: blog.country,
    blog_id: blog.legacyBlogId ?? blog.id,
    sources: blog.sources.length ? blog.sources : null,
    created_at: blog.createdAt.toISOString(),
    updated_at: blog.updatedAt.toISOString(),
  };
}

export async function listBlogsForApi(input: {
  brand?: string | null;
  status?: string | null;
  limit?: number | null;
}) {
  const brand = input.brand?.trim() ?? "";
  const where = {
    OR: brand
      ? [
          {
            brand: {
              equals: brand,
              mode: "insensitive" as const,
            },
          },
          {
            websites: {
              has: brand,
            },
          },
        ]
      : undefined,
    status: mapApiStatusToCurrent(input.status),
  };

  const blogs = await prisma.blog.findMany({
    where,
    orderBy: [{ postDate: "desc" }, { createdAt: "desc" }],
    take: input.limit ? Math.min(Math.max(input.limit, 1), 100) : 50,
  });

  return blogs.map(mapBlogToApiShape);
}

export async function getBlogForApi(id: string) {
  const legacyExternalId = Number.isInteger(Number(id)) ? Number(id) : null;
  const orWhere: Prisma.BlogWhereInput[] = [{ id }, { legacyBlogId: id }];

  if (legacyExternalId !== null) {
    orWhere.push({ legacyExternalId });
  }

  const blog = await prisma.blog.findFirst({
    where: {
      OR: orWhere,
    },
  });

  if (!blog) {
    return null;
  }

  return mapBlogToApiShape(blog);
}
