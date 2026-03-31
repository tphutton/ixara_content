import { NextResponse } from "next/server";
import { listBlogsForApi } from "@/lib/blogs/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const items = await listBlogsForApi({
      brand: searchParams.get("brand"),
      status: searchParams.get("status"),
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : null,
    });

    return NextResponse.json({
      success: true,
      data: items,
      count: items.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load blogs.",
      },
      { status: 500 },
    );
  }
}
