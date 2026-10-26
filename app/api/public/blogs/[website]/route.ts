import { NextResponse } from "next/server";
import { websiteOptions } from "@/lib/constants/options";
import { listPublishedWebsiteBlogsForApi } from "@/lib/blogs/api";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ website: string }> }) {
  const { website } = await params;
  if (!(websiteOptions as readonly string[]).includes(website)) {
    return NextResponse.json({ error: "Website not found." }, { status: 404 });
  }
  const query = new URL(request.url).searchParams;
  try {
    const result = await listPublishedWebsiteBlogsForApi({ website, page: Number(query.get("page") ?? 1), limit: Number(query.get("limit") ?? 100) });
    return NextResponse.json(result, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } });
  } catch {
    return NextResponse.json({ error: "News is temporarily unavailable." }, { status: 503 });
  }
}
