"use client";

import { useEffect } from "react";

export function DeleteConfirmationGuard() {
  useEffect(() => {
    function confirmDelete(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.dataset.deleteConfirmed === "true") return;

      const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
      const submitLabel = submitter?.textContent?.trim().toLowerCase() ?? "";
      const bulkAction = form.elements.namedItem("action");
      const isBulkDelete = bulkAction instanceof HTMLSelectElement && bulkAction.value === "delete";
      const isDelete = submitLabel.includes("delete") || isBulkDelete || form.dataset.deleteConfirmation === "true";
      if (!isDelete) return;

      if (!window.confirm("Delete this record from Content? This cannot be undone. Upstream TSADB and WordPress media will not be deleted.")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      form.dataset.deleteConfirmed = "true";
    }

    document.addEventListener("submit", confirmDelete, true);
    return () => document.removeEventListener("submit", confirmDelete, true);
  }, []);

  return null;
}
