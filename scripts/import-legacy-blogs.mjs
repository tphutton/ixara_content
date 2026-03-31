import { BlogStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEGACY_BLOGS_API_URL =
  process.env.LEGACY_BLOGS_API_URL ?? "https://data.techsport.asia/api/tables/blogs";
const LEGACY_BLOGS_API_KEY = process.env.LEGACY_BLOGS_API_KEY;

function normalizeOptionalText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseLegacyArrayLiteral(value) {
  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return trimmed ? [trimmed] : [];
  }

  const content = trimmed.slice(1, -1).trim();

  if (!content) {
    return [];
  }

  const matches = content.match(/"((?:\\.|[^"])*)"|([^,]+)/g) ?? [];

  return matches
    .map((entry) => {
      const normalized = entry.trim();

      if (normalized.startsWith("\"") && normalized.endsWith("\"")) {
        return normalized
          .slice(1, -1)
          .replaceAll("\\\"", "\"")
          .replaceAll("\\\\", "\\")
          .trim();
      }

      return normalized;
    })
    .filter(Boolean);
}

function parseDate(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapLegacyStatus(value) {
  switch ((value ?? "").toLowerCase()) {
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
    default:
      return BlogStatus.draft;
  }
}

function mapLegacyBlog(record) {
  const websites = parseLegacyArrayLiteral(record.websites);
  const createdAt = parseDate(record.created_at) ?? new Date();
  const updatedAt = parseDate(record.updated_at) ?? createdAt;

  return {
    legacyExternalId: typeof record.id === "number" ? record.id : null,
    legacyBlogId: normalizeOptionalText(record.blog_id),
    legacyZohoId: normalizeOptionalText(record.zoho_id),
    title: record.title?.trim() || "Untitled legacy blog",
    brand: websites[0] ?? null,
    postDate: parseDate(record.post_date),
    authorName: normalizeOptionalText(record.author_name),
    authorImage: normalizeOptionalText(record.author_image),
    featureImage: normalizeOptionalText(record.feature_image),
    text1: normalizeOptionalText(record.text_1),
    image1: normalizeOptionalText(record.image_1),
    image1Caption: normalizeOptionalText(record.image_1_caption),
    text2: normalizeOptionalText(record.text_2),
    image2: normalizeOptionalText(record.image_2),
    image2Caption: normalizeOptionalText(record.image_2_caption),
    text3: normalizeOptionalText(record.text_3),
    image3: normalizeOptionalText(record.image_3),
    image3Caption: normalizeOptionalText(record.image_3_caption),
    text4: normalizeOptionalText(record.text_4),
    image4: normalizeOptionalText(record.image_4),
    image4Caption: normalizeOptionalText(record.image_4_caption),
    text5: normalizeOptionalText(record.text_5),
    image5: normalizeOptionalText(record.image_5),
    image5Caption: normalizeOptionalText(record.image_5_caption),
    text6: normalizeOptionalText(record.text_6),
    image6: normalizeOptionalText(record.image_6),
    image6Caption: normalizeOptionalText(record.image_6_caption),
    text7: normalizeOptionalText(record.text_7),
    image7: normalizeOptionalText(record.image_7),
    image7Caption: normalizeOptionalText(record.image_7_caption),
    text8: normalizeOptionalText(record.text_8),
    image8: normalizeOptionalText(record.image_8),
    image8Caption: normalizeOptionalText(record.image_8_caption),
    websites,
    category: normalizeOptionalText(record.category),
    tags: normalizeStringArray(record.tags),
    authorBio: normalizeOptionalText(record.author_bio),
    status: mapLegacyStatus(record.status),
    sport: normalizeOptionalText(record.sport),
    region: normalizeOptionalText(record.region),
    country: normalizeOptionalText(record.country),
    sources: normalizeStringArray(record.sources),
    createdAt,
    updatedAt,
    sourcePrompt: "Imported from legacy TechSport blogs API.",
  };
}

async function fetchLegacyBlogs() {
  if (!LEGACY_BLOGS_API_KEY) {
    throw new Error("LEGACY_BLOGS_API_KEY is required.");
  }

  const response = await fetch(LEGACY_BLOGS_API_URL, {
    headers: {
      "X-API-Key": LEGACY_BLOGS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Legacy blogs fetch failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();

  if (!Array.isArray(payload)) {
    throw new Error("Legacy blogs payload was not an array.");
  }

  return payload;
}

async function main() {
  const legacyBlogs = await fetchLegacyBlogs();

  let imported = 0;

  for (const record of legacyBlogs) {
    const data = mapLegacyBlog(record);

    if (data.legacyExternalId === null) {
      console.warn("Skipping legacy blog without numeric id:", record.title ?? "Untitled");
      continue;
    }

    await prisma.blog.upsert({
      where: {
        legacyExternalId: data.legacyExternalId,
      },
      create: data,
      update: data,
    });

    imported += 1;
  }

  console.log(`Imported ${imported} legacy blogs from ${LEGACY_BLOGS_API_URL}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
