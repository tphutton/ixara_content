import { NextResponse } from "next/server";
import { requireApprovedUserAccess } from "@/lib/auth/user-access";
import {
  generateAiContentPlanPreview,
  type GenerateAiContentPlanOptions,
} from "@/lib/planner/ai-plan-builder";

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function optionalDate(value: unknown) {
  const raw = optionalString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(optionalString).filter(Boolean) as string[];
  }

  const raw = optionalString(value);
  if (!raw) return [];

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function itemCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const raw = optionalString(value);
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getOptions(body: Record<string, unknown>): GenerateAiContentPlanOptions {
  return {
    planningMode: optionalString(body.planningMode),
    brand: optionalString(body.brand),
    campaignName: optionalString(body.campaignName),
    startDate: optionalDate(body.startDate),
    endDate: optionalDate(body.endDate),
    channels: stringArray(body.channels),
    itemCount: itemCount(body.itemCount),
    region: optionalString(body.region),
    country: optionalString(body.country),
    sport: optionalString(body.sport),
    goal: optionalString(body.goal),
    guidance: optionalString(body.guidance),
  };
}

export async function POST(request: Request) {
  await requireApprovedUserAccess();

  const body = (await request.json()) as Record<string, unknown>;
  const preview = await generateAiContentPlanPreview(getOptions(body));

  return NextResponse.json({ preview });
}
