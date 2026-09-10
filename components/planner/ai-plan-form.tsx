"use client";

import { useMemo, useState, type FormEvent } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { BrandSelect } from "@/components/forms/brand-select";
import type { AiPlanItem, AiPlanPreview } from "@/lib/planner/ai-plan-builder";

type AiPlanFormProps = {
  action: (formData: FormData) => Promise<void>;
  brandProfiles: Array<{ brandName: string }>;
  campaigns: Array<{ campaign_name: string; brand: string[]; start_date?: string | null; end_date?: string | null }>;
};

const channelOptions = ["Instagram", "Facebook", "LinkedIn", "Email", "Blog", "Website", "YouTube", "TikTok"];
const itemTypes = ["content", "blog", "schedule", "asset_request", "automation"];
const itemStatuses = ["planned", "approved", "created", "scheduled", "published", "blocked", "cancelled"];

function emptyToNull(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toISOString().slice(0, 10);
}

function toDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 16) : date.toISOString().slice(0, 16);
}

function fromDateTimeInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function serializeBrief(form: HTMLFormElement) {
  const formData = new FormData(form);

  return {
    planningMode: emptyToNull(formData.get("planningMode")),
    itemCount: emptyToNull(formData.get("itemCount")),
    goal: emptyToNull(formData.get("goal")),
    brand: emptyToNull(formData.get("brand")),
    campaignName: emptyToNull(formData.get("campaignName")),
    startDate: emptyToNull(formData.get("startDate")),
    endDate: emptyToNull(formData.get("endDate")),
    channels: emptyToNull(formData.get("channels")),
    region: emptyToNull(formData.get("region")),
    country: emptyToNull(formData.get("country")),
    sport: emptyToNull(formData.get("sport")),
    guidance: emptyToNull(formData.get("guidance")),
  };
}

export function AiPlanForm({ action, brandProfiles, campaigns }: AiPlanFormProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AiPlanPreview | null>(null);

  const previewJson = useMemo(() => JSON.stringify(preview), [preview]);

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/planner/ai-plan-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializeBrief(event.currentTarget)),
      });

      if (!response.ok) {
        throw new Error("Quill could not generate a plan from that brief.");
      }

      const payload = (await response.json()) as { preview?: AiPlanPreview };
      if (!payload.preview) {
        throw new Error("Quill returned an empty plan.");
      }

      setPreview(payload.preview);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Plan generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  function updatePreview(values: Partial<AiPlanPreview>) {
    setPreview((current) => (current ? { ...current, ...values } : current));
  }

  function updateItem(index: number, values: Partial<AiPlanItem>) {
    setPreview((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...values } : item)),
      };
    });
  }

  function removeItem(index: number) {
    setPreview((current) => {
      if (!current) return current;
      return { ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) };
    });
  }

  if (preview) {
    return (
      <div className="ai-plan-review">
        <div className="card card--padded ai-plan-review__summary">
          <div className="section-heading">
            <div>
              <p className="kicker">Review draft</p>
              <h3>Edit before saving</h3>
              <p className="muted">
                This draft is not saved yet. Adjust the plan, remove weak items, then save it into Plans.
              </p>
            </div>
            <button className="button button--secondary" onClick={() => setPreview(null)} type="button">
              Back to brief
            </button>
          </div>

          <div className="form-grid form-grid--2">
            <label className="field">
              <span className="field__label">Plan title</span>
              <input value={preview.title} onChange={(event) => updatePreview({ title: event.target.value })} />
            </label>

            <label className="field">
              <span className="field__label">Brand</span>
              <BrandSelect
                options={brandProfiles}
                placeholder="No brand"
                value={preview.brand}
                onChange={(event) => updatePreview({ brand: event.target.value || null })}
              />
            </label>
          </div>

          <label className="field">
            <span className="field__label">Goal</span>
            <input value={preview.goal ?? ""} onChange={(event) => updatePreview({ goal: event.target.value || null })} />
          </label>

          <label className="field">
            <span className="field__label">Description</span>
            <textarea
              rows={3}
              value={preview.description ?? ""}
              onChange={(event) => updatePreview({ description: event.target.value || null })}
            />
          </label>

          <div className="form-grid form-grid--2">
            <label className="field">
              <span className="field__label">Campaign</span>
              <input
                list="campaign-options-review"
                value={preview.campaignName ?? ""}
                onChange={(event) => updatePreview({ campaignName: event.target.value || null })}
              />
            </label>

            <label className="field">
              <span className="field__label">Date range</span>
              <div className="inline-fields">
                <input
                  aria-label="Start date"
                  type="date"
                  value={toDateInput(preview.startDate)}
                  onChange={(event) => updatePreview({ startDate: event.target.value || null })}
                />
                <input
                  aria-label="End date"
                  type="date"
                  value={toDateInput(preview.endDate)}
                  onChange={(event) => updatePreview({ endDate: event.target.value || null })}
                />
              </div>
            </label>
          </div>
        </div>

        <datalist id="campaign-options-review">
          {campaigns.map((campaign) => (
            <option key={campaign.campaign_name} value={campaign.campaign_name} />
          ))}
        </datalist>

        <div className="ai-plan-review__items">
          {preview.items.map((item, index) => (
            <article className="card card--padded ai-plan-item-editor" key={`${item.title}-${index}`}>
              <div className="section-heading">
                <div>
                  <p className="kicker">Item {index + 1}</p>
                  <input
                    aria-label="Item title"
                    className="ai-plan-item-editor__title"
                    value={item.title ?? ""}
                    onChange={(event) => updateItem(index, { title: event.target.value })}
                  />
                </div>
                <button className="button button--secondary" onClick={() => removeItem(index)} type="button">
                  Remove
                </button>
              </div>

              <div className="form-grid form-grid--2">
                <label className="field">
                  <span className="field__label">Type</span>
                  <select value={item.itemType ?? "content"} onChange={(event) => updateItem(index, { itemType: event.target.value })}>
                    {itemTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field__label">Status</span>
                  <select value={item.status ?? "planned"} onChange={(event) => updateItem(index, { status: event.target.value })}>
                    {itemStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <span className="field__label">Brief</span>
                <textarea rows={4} value={item.brief ?? ""} onChange={(event) => updateItem(index, { brief: event.target.value || null })} />
              </label>

              <div className="form-grid form-grid--2">
                <label className="field">
                  <span className="field__label">Channel</span>
                  <input value={item.channel ?? ""} onChange={(event) => updateItem(index, { channel: event.target.value || null })} />
                </label>

                <label className="field">
                  <span className="field__label">Scheduled for</span>
                  <input
                    type="datetime-local"
                    value={toDateTimeInput(item.scheduledFor)}
                    onChange={(event) => updateItem(index, { scheduledFor: fromDateTimeInput(event.target.value) })}
                  />
                </label>
              </div>

              <div className="form-grid form-grid--2">
                <label className="field">
                  <span className="field__label">Brand</span>
                  <BrandSelect
                    options={brandProfiles}
                    placeholder="Use plan brand"
                    value={item.brand ?? ""}
                    onChange={(event) => updateItem(index, { brand: event.target.value || null })}
                  />
                </label>

                <label className="field">
                  <span className="field__label">Campaign</span>
                  <input
                    list="campaign-options-review"
                    value={item.campaignName ?? ""}
                    onChange={(event) => updateItem(index, { campaignName: event.target.value || null })}
                  />
                </label>
              </div>

              <div className="form-grid form-grid--2">
                <label className="field">
                  <span className="field__label">Region</span>
                  <input value={item.region ?? ""} onChange={(event) => updateItem(index, { region: event.target.value || null })} />
                </label>
                <label className="field">
                  <span className="field__label">Country</span>
                  <input value={item.country ?? ""} onChange={(event) => updateItem(index, { country: event.target.value || null })} />
                </label>
              </div>

              <label className="field">
                <span className="field__label">Sport/category</span>
                <input value={item.sport ?? ""} onChange={(event) => updateItem(index, { sport: event.target.value || null })} />
              </label>

              <label className="field">
                <span className="field__label">Asset request</span>
                <textarea
                  rows={2}
                  value={item.assetRequest ?? ""}
                  onChange={(event) => updateItem(index, { assetRequest: event.target.value || null })}
                />
              </label>
            </article>
          ))}
        </div>

        <form action={action} className="form-actions">
          <input name="previewJson" type="hidden" value={previewJson} />
          <SubmitButton label="Save reviewed plan" pendingLabel="Saving plan..." />
        </form>
      </div>
    );
  }

  return (
    <form className="quiet-form" onSubmit={handleGenerate}>
      {error ? <div className="form-error">{error}</div> : null}

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Planning mode</span>
          <select name="planningMode" defaultValue="new_content">
            <option value="new_content">New content ideas</option>
            <option value="balanced">Balanced plan</option>
            <option value="cleanup">Clean up existing work</option>
            <option value="campaign_launch">Campaign launch</option>
            <option value="calendar_gaps">Fill calendar gaps</option>
            <option value="variants">Create channel variants</option>
          </select>
        </label>

        <label className="field">
          <span className="field__label">Number of items</span>
          <input defaultValue="8" max="20" min="3" name="itemCount" type="number" />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Goal</span>
        <input name="goal" placeholder="Launch the campaign, grow enquiries, fill next week, improve quality..." />
      </label>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Brand</span>
          <BrandSelect options={brandProfiles} placeholder="Auto-select if blank" />
        </label>

        <label className="field">
          <span className="field__label">Campaign</span>
          <input list="campaign-options" name="campaignName" placeholder="Auto-select if blank" />
          <datalist id="campaign-options">
            {campaigns.map((campaign) => (
              <option key={campaign.campaign_name} value={campaign.campaign_name} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Start date</span>
          <input name="startDate" type="date" />
        </label>

        <label className="field">
          <span className="field__label">End date</span>
          <input name="endDate" type="date" />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Channels</span>
        <input name="channels" placeholder="Instagram, Facebook, LinkedIn, Blog" />
        <span className="field__hint">Comma-separated. Leave blank and Quill will choose from current signals.</span>
      </label>

      <div className="quiet-meta">
        {channelOptions.map((channel) => (
          <span key={channel}>{channel}</span>
        ))}
      </div>

      <div className="form-grid form-grid--2">
        <label className="field">
          <span className="field__label">Region</span>
          <input name="region" />
        </label>
        <label className="field">
          <span className="field__label">Country</span>
          <input name="country" />
        </label>
      </div>

      <label className="field">
        <span className="field__label">Sport/category</span>
        <input name="sport" />
      </label>

      <label className="field">
        <span className="field__label">Extra guidance</span>
        <textarea name="guidance" rows={4} placeholder="Anything Quill should strongly prefer, avoid, or explain in the plan." />
      </label>

      <div className="form-actions">
        <button className="button button--primary" disabled={isGenerating} type="submit">
          {isGenerating ? "Building draft..." : "Generate draft"}
        </button>
      </div>
    </form>
  );
}
