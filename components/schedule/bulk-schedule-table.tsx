"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import type { ScheduleStatus } from "@prisma/client";
import { bulkUpdateScheduleAction } from "@/app/(app)/schedule/actions";
import { scheduleStatusOptions } from "@/lib/constants/options";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/forms/submit-button";

type ScheduleTableRow = {
  id: string;
  title: string;
  channel: string | null;
  platformAccount: string | null;
  scheduledFor: string;
  brand: string | null;
  approvalLabel: string;
  isReady: boolean;
  status: ScheduleStatus;
};

type BulkScheduleTableProps = {
  rows: ScheduleTableRow[];
  availableBrands: string[];
};

const initialState = {
  error: null,
  success: null,
};

export function BulkScheduleTable({ rows, availableBrands }: BulkScheduleTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [state, formAction] = useActionState(bulkUpdateScheduleAction, initialState);

  const allSelected = rows.length > 0 && selectedIds.length === rows.length;
  const hasSelection = selectedIds.length > 0;

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)),
    [rows, selectedIds],
  );

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : rows.map((row) => row.id));
  }

  return (
    <div className="stack">
      {hasSelection ? (
        <form action={formAction} className="card card--padded bulk-editor">
          {selectedIds.map((id) => (
            <input key={id} name="scheduleIds" type="hidden" value={id} />
          ))}

          <div className="bulk-editor__header">
            <div>
              <p className="kicker">Bulk update</p>
              <h3>{selectedIds.length} selected schedule entries</h3>
              <p className="muted" style={{ margin: 0 }}>
                Apply one or more changes across the selected rows, then save once.
              </p>
            </div>
            <button className="button button--secondary" onClick={() => setSelectedIds([])} type="button">
              Clear selection
            </button>
          </div>

          <div className="bulk-editor__chips">
            {selectedRows.slice(0, 5).map((row) => (
              <span className="inline-chip" key={row.id}>
                {row.title}
              </span>
            ))}
            {selectedRows.length > 5 ? (
              <span className="inline-chip">+{selectedRows.length - 5} more</span>
            ) : null}
          </div>

          <div className="form-grid form-grid--2">
            <label className="field">
              <span className="field__label field__label--checkbox">
                <input name="applyScheduledFor" type="checkbox" value="true" />
                <span>Scheduled for</span>
              </span>
              <input name="scheduledFor" type="datetime-local" />
              <span className="field__hint">Only applied if checked.</span>
            </label>

            <label className="field">
              <span className="field__label field__label--checkbox">
                <input name="applyStatus" type="checkbox" value="true" />
                <span>Status</span>
              </span>
              <select defaultValue="" name="status">
                <option value="">No change</option>
                {scheduleStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label field__label--checkbox">
                <input name="applyChannel" type="checkbox" value="true" />
                <span>Channel</span>
              </span>
              <input name="channel" placeholder="Leave blank to clear" />
            </label>

            <label className="field">
              <span className="field__label field__label--checkbox">
                <input name="applyPlatformAccount" type="checkbox" value="true" />
                <span>Platform account</span>
              </span>
              <input name="platformAccount" placeholder="e.g. Instagram / Facebook page" />
            </label>

            <label className="field">
              <span className="field__label field__label--checkbox">
                <input name="applyBrand" type="checkbox" value="true" />
                <span>Brand</span>
              </span>
              <select defaultValue="" name="brand">
                <option value="">No change</option>
                {availableBrands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Approval</span>
              <select defaultValue="none" name="approvalAction">
                <option value="none">No change</option>
                <option value="approve">Approve selected</option>
                <option value="clear">Clear approval</option>
              </select>
            </label>
          </div>

          {state.error ? <p className="bulk-editor__message bulk-editor__message--error">{state.error}</p> : null}
          {state.success ? (
            <p className="bulk-editor__message bulk-editor__message--success">{state.success}</p>
          ) : null}

          <div className="bulk-editor__actions">
            <SubmitButton label="Apply bulk update" pendingLabel="Updating schedule..." />
          </div>
        </form>
      ) : null}

      <div className="card table-shell">
        <table className="table">
          <thead>
            <tr>
              <th>
                <input aria-label="Select all schedule entries" checked={allSelected} onChange={toggleAll} type="checkbox" />
              </th>
              <th>Item</th>
              <th>Channel</th>
              <th>Platform</th>
              <th>Scheduled For</th>
              <th>Brand</th>
              <th>Approval</th>
              <th>Readiness</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr data-selected={selectedIds.includes(row.id)} key={row.id}>
                <td>
                  <input
                    aria-label={`Select ${row.title}`}
                    checked={selectedIds.includes(row.id)}
                    onChange={() => toggleSelection(row.id)}
                    type="checkbox"
                  />
                </td>
                <td>
                  <Link href={`/schedule/${row.id}`}>{row.title}</Link>
                </td>
                <td>{row.channel ?? "—"}</td>
                <td>{row.platformAccount ?? "—"}</td>
                <td>{new Date(row.scheduledFor).toLocaleString()}</td>
                <td>{row.brand ?? "—"}</td>
                <td>{row.approvalLabel}</td>
                <td>
                  <StatusBadge label={row.isReady ? "ready" : "warning"} />
                </td>
                <td>
                  <StatusBadge label={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
