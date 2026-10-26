"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  calendarDay,
  calendarTime,
  type CalendarEntry,
} from "@/lib/schedule/calendar";
import { linkImportedPublicationAction } from "@/app/(app)/schedule/actions";

type CampaignWindow = {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  brands: string[];
  status: string;
};
function validDay(value: string | undefined, fallback: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : fallback;
}
const dayDate = (key: string) => new Date(`${key}T12:00:00Z`);
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const shift = (key: string, days: number) => {
  const d = dayDate(key);
  d.setUTCDate(d.getUTCDate() + days);
  return dayKey(d);
};
const label = (key: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(
    dayDate(key),
  );
const isVideo = (url: string | null) =>
  !!url && /\.(mp4|webm|mov)(?:\?|$)/i.test(url);
function Media({
  entry,
  small = false,
}: {
  entry: CalendarEntry;
  small?: boolean;
}) {
  const image =
    entry.thumbnail ?? (!isVideo(entry.mediaUrl) ? entry.mediaUrl : null);
  if (!small && entry.mediaUrl && isVideo(entry.mediaUrl))
    return (
      <video
        className="publishing-preview"
        src={entry.mediaUrl}
        poster={image ?? undefined}
        controls
        playsInline
        preload="metadata"
      />
    );
  return image ? (
    <img
      className={small ? "publishing-thumb" : "publishing-preview"}
      src={image}
      alt=""
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  ) : (
    <div className="publishing-placeholder" aria-hidden="true">
      {entry.platform.toLowerCase().includes("instagram")
        ? "IG"
        : entry.platform.toLowerCase().includes("facebook")
          ? "FB"
          : "Post"}
    </div>
  );
}
export function PublishingCalendar({
  entries,
  campaigns,
  contentOptions,
  initialBrand,
  initialMonth,
  initialWeek,
  initialView,
  initialPlatform,
  initialStatus,
}: {
  entries: CalendarEntry[];
  campaigns: CampaignWindow[];
  contentOptions: { id: string; title: string; brand: string | null }[];
  initialBrand?: string;
  initialMonth?: string;
  initialWeek?: string;
  initialView?: string;
  initialPlatform?: string;
  initialStatus?: string;
}) {
  const today = calendarDay(new Date());
  const [anchor, setAnchor] = useState(
    validDay(
      initialView === "week"
        ? initialWeek
        : initialMonth
          ? `${initialMonth}-01`
          : undefined,
      today,
    ),
  );
  const [view, setView] = useState(
    initialView === "week"
      ? "week"
      : initialView === "agenda"
        ? "agenda"
        : "month",
  );
  const [brand, setBrand] = useState(initialBrand ?? "all");
  const [platform, setPlatform] = useState(initialPlatform ?? "all");
  const [status, setStatus] = useState(initialStatus ?? "all");
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [matchContent, setMatchContent] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const query = new URLSearchParams({
      view,
      month: anchor.slice(0, 7),
      week: anchor,
      brand,
      platform,
      status,
    });
    window.history.replaceState(null, "", `/schedule?${query}`);
  }, [view, anchor, brand, platform, status]);
  const brands = [...new Set(entries.map((e) => e.brand))].sort();
  const monthStart = anchor.slice(0, 7) + "-01";
  const monday = (key: string) =>
    shift(key, -(dayDate(key).getUTCDay() + 6) % 7);
  const start = view === "week" ? monday(anchor) : monday(monthStart);
  const lastMonthDate = new Date(
    Date.UTC(
      dayDate(monthStart).getUTCFullYear(),
      dayDate(monthStart).getUTCMonth() + 1,
      0,
    ),
  );
  const end =
    view === "week" ? shift(start, 6) : shift(monday(dayKey(lastMonthDate)), 6);
  const days: string[] = [];
  for (let key = start; key <= end; key = shift(key, 1)) days.push(key);
  const visible = entries.filter(
    (e) =>
      (brand === "all" || e.brand === brand) &&
      (platform === "all" || e.platform.toLowerCase().includes(platform)) &&
      (status === "all"
        ? e.status !== "cancelled"
        : status === "attention"
          ? ["missed", "failed"].includes(e.status)
          : e.status === status) &&
      calendarDay(e.date) >= start &&
      calendarDay(e.date) <= end,
  );
  const activeCampaigns = campaigns.filter(
    (c) =>
      c.start &&
      calendarDay(c.start) <= end &&
      calendarDay(c.end ?? c.start) >= start &&
      (brand === "all" || c.brands.includes(brand)),
  );
  function navigate(amount: number) {
    if (view === "week") setAnchor(shift(anchor, amount * 7));
    else {
      const d = dayDate(monthStart);
      d.setUTCMonth(d.getUTCMonth() + amount);
      setAnchor(dayKey(d));
    }
  }
  function open(entry: CalendarEntry) {
    setSelected(entry);
    setError("");
    setMatchContent("");
    dialog.current?.showModal();
  }
  const card = (e: CalendarEntry) => (
    <button
      type="button"
      className="publishing-card"
      data-status={e.status}
      key={`${e.kind}-${e.id}`}
      onClick={() => open(e)}
    >
      <Media entry={e} small />
      <span className="publishing-card__body">
        <span className="publishing-card__meta">
          {calendarTime(e.date)} · {e.platform}
        </span>
        <strong>{e.title}</strong>
        <span className="publishing-card__meta">
          {e.status} · {e.brand}
        </span>
        {e.kind === "published" && (
          <span className="publishing-card__meta">
            {e.metrics?.Views != null
              ? `${e.metrics.Views.toLocaleString()} views`
              : "View post details"}
          </span>
        )}
      </span>
    </button>
  );
  return (
    <div className="stack publishing-calendar">
      <div className="quiet-panel">
        <div className="publishing-toolbar">
          <div className="toolbar__group">
            {["month", "week", "agenda"].map((v) => (
              <button
                type="button"
                className="button button--secondary"
                aria-pressed={view === v}
                key={v}
                onClick={() => setView(v)}
              >
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <div className="toolbar__group">
            <label>
              Brand
              <select value={brand} onChange={(e) => setBrand(e.target.value)}>
                <option value="all">All brands</option>
                {brands.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            <label>
              Platform
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="all">All platforms</option>
                <option value="instagram">Instagram</option>
                <option value="facebook">Facebook</option>
              </select>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {[
                  "all",
                  "planned",
                  "ready",
                  "scheduled",
                  "published",
                  "attention",
                  "cancelled",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "All active entries" : s}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="publishing-toolbar">
          <div>
            <h2>
              {view === "week"
                ? `${label(start, { day: "numeric", month: "short" })} – ${label(end, { day: "numeric", month: "short", year: "numeric" })}`
                : label(monthStart, { month: "long", year: "numeric" })}
            </h2>
            <p className="muted">
              {visible.length} posts in this view · Asia/Bangkok
            </p>
          </div>
          <div className="toolbar__group">
            <button
              className="button button--secondary"
              onClick={() => navigate(-1)}
              aria-label="Previous period"
            >
              ←
            </button>
            <button
              className="button button--secondary"
              onClick={() => setAnchor(today)}
            >
              Today
            </button>
            <button
              className="button button--secondary"
              onClick={() => navigate(1)}
              aria-label="Next period"
            >
              →
            </button>
          </div>
        </div>
      </div>
      {activeCampaigns.length > 0 && (
        <section className="publishing-campaigns" aria-label="Campaign windows">
          {activeCampaigns.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="inline-chip"
            >
              {c.title} · {c.status}
            </Link>
          ))}
        </section>
      )}
      {view === "agenda" ? (
        <div className="quiet-panel">
          {visible.length === 0 ? (
            <p>No posts in this period.</p>
          ) : (
            days.map((day) => {
              const posts = visible.filter((e) => calendarDay(e.date) === day);
              return posts.length > 0 ? (
                <section key={day}>
                  <h3>
                    {label(day, {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                    })}
                  </h3>
                  <div className="publishing-agenda">{posts.map(card)}</div>
                </section>
              ) : null;
            })
          )}
        </div>
      ) : (
        <div className="publishing-grid-scroll">
          <div className="publishing-grid" data-view={view}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div className="publishing-weekday" key={d}>
                {d}
              </div>
            ))}
            {days.map((day) => {
              const posts = visible.filter((e) => calendarDay(e.date) === day);
              return (
                <section
                  className="publishing-day"
                  data-today={day === today}
                  data-outside={
                    view !== "week" && day.slice(0, 7) !== anchor.slice(0, 7)
                  }
                  key={day}
                >
                  <header>
                    <time dateTime={day}>
                      {label(day, {
                        day: "numeric",
                        ...(view === "week" ? { month: "short" } : {}),
                      })}
                    </time>
                    <span>{posts.length || ""}</span>
                  </header>
                  {posts.slice(0, 3).map(card)}
                  {posts.length > 3 && (
                    <details>
                      <summary>+{posts.length - 3} more posts</summary>
                      {posts.slice(3).map(card)}
                    </details>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
      <dialog
        ref={dialog}
        className="publishing-dialog"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
      >
        <div className="publishing-dialog__inner">
          {selected && (
            <>
              <div className="publishing-toolbar">
                <span className="inline-chip">
                  {selected.status} · {selected.platform}
                </span>
                <button
                  className="button button--secondary"
                  onClick={() => dialog.current?.close()}
                >
                  Close
                </button>
              </div>
              <h2>{selected.title}</h2>
              <p className="muted">
                {label(calendarDay(selected.date), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}{" "}
                · {calendarTime(selected.date)} Bangkok ·{" "}
                {selected.account || selected.brand}
              </p>
              <Media entry={selected} />
              <p className="publishing-caption">
                {selected.caption ||
                  "No caption imported. Open the original post to view it."}
              </p>
              {selected.campaign && <p>Campaign: {selected.campaign}</p>}
              <div className="toolbar__group">
                {selected.externalUrl && (
                  <a
                    className="button button--primary"
                    href={selected.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View original post ↗
                  </a>
                )}
                {selected.contentId && (
                  <Link
                    className="button button--secondary"
                    href={`/content/${selected.contentId}`}
                  >
                    View content
                  </Link>
                )}
                {selected.scheduleId && (
                  <Link
                    className="button button--secondary"
                    href={`/schedule/${selected.scheduleId}`}
                  >
                    Schedule details
                  </Link>
                )}
              </div>
              {selected.kind === "published" && (
                <section>
                  <h3>Post analytics</h3>
                  <p className="muted">
                    {selected.syncedAt
                      ? `Last synced ${label(calendarDay(selected.syncedAt), { day: "numeric", month: "short" })}, ${calendarTime(selected.syncedAt)} Bangkok`
                      : "Not synced yet"}
                    . Unavailable metrics are shown as —.
                  </p>
                  <div className="publishing-metrics">
                    {Object.entries(
                      selected.metrics ?? {
                        Views: null,
                        Reach: null,
                        Engagements: null,
                      },
                    ).map(([key, value]) => (
                      <div key={key}>
                        <span>{key}</span>
                        <strong>
                          {value == null ? "—" : value.toLocaleString()}
                        </strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {selected.kind === "published" && !selected.contentId && (
                <form
                  action={async (form) => {
                    setSaving(true);
                    setError("");
                    try {
                      await linkImportedPublicationAction(form);
                      dialog.current?.close();
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Unable to link post.",
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="stack"
                >
                  <h3>Match to editorial content</h3>
                  <p className="muted">
                    Links this publication and its analytics to your content.
                    Creates verified history; does not publish again.
                  </p>
                  <input
                    type="hidden"
                    name="publishedPostId"
                    value={selected.id}
                  />
                  <label>
                    Content
                    <select
                      name="contentId"
                      required
                      value={matchContent}
                      onChange={(e) => setMatchContent(e.target.value)}
                    >
                      <option value="">Choose content</option>
                      {contentOptions
                        .filter(
                          (c) =>
                            c.brand?.toLowerCase() ===
                            selected.brand.toLowerCase(),
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Calendar entry
                    <select name="scheduleId">
                      <option value="">Create publication history</option>
                      {entries
                        .filter(
                          (e) =>
                            e.kind === "schedule" &&
                            e.contentId === matchContent &&
                            e.platform.toLowerCase() ===
                              selected.platform.toLowerCase() &&
                            e.status !== "cancelled",
                        )
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {calendarDay(e.date)} · {e.title}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Creative variant (optional)
                    <input
                      name="variantLabel"
                      maxLength={120}
                      placeholder="e.g. Golf-first"
                    />
                  </label>
                  {error && <p role="alert">{error}</p>}
                  <button className="button button--primary" disabled={saving}>
                    {saving ? "Linking…" : "Link publication"}
                  </button>
                </form>
              )}
              {selected.notes && (
                <details>
                  <summary>Production notes</summary>
                  <p className="publishing-caption">{selected.notes}</p>
                </details>
              )}
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
