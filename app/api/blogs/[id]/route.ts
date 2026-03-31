import { NextResponse } from "next/server";
import { getBlogForApi } from "@/lib/blogs/api";

export const runtime = "nodejs";

type BlogByIdRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: BlogByIdRouteProps) {
  const { id } = await params;

  try {
    const blog = await getBlogForApi(id);

    if (!blog) {
      return NextResponse.json(
        {
          success: false,
          error: "Blog not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: blog,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load blog.",
      },
      { status: 500 },
    );
  }
}
