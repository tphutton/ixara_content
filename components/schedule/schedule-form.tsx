import { Blog, Content, ContentSchedule, ScheduleStatus } from "@prisma/client";
import { scheduleStatusOptions } from "@/lib/constants/options";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";

type ScheduleFormProps = {
  action: (formData: FormData) => void;
  schedule?: ContentSchedule | null;
  contents: Pick<Content, "id" | "title">[];
  blogs: Pick<Blog, "id" | "title">[];
};

export function ScheduleForm({ action, schedule, contents, blogs }: ScheduleFormProps) {
  return (
    <form action={action} className="stack">
      <div className="form-grid form-grid--2">
        <Field htmlFor="scheduledFor" label="Scheduled for">
          <input
            defaultValue={schedule ? new Date(schedule.scheduledFor).toISOString().slice(0, 16) : ""}
            id="scheduledFor"
            name="scheduledFor"
            required
            type="datetime-local"
          />
        </Field>

        <Field htmlFor="status" label="Status">
          <select defaultValue={schedule?.status ?? ScheduleStatus.planned} id="status" name="status">
            {scheduleStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="contentId" label="Linked content">
          <select defaultValue={schedule?.contentId ?? ""} id="contentId" name="contentId">
            <option value="">No linked content</option>
            {contents.map((content) => (
              <option key={content.id} value={content.id}>
                {content.title}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="blogId" label="Linked blog">
          <select defaultValue={schedule?.blogId ?? ""} id="blogId" name="blogId">
            <option value="">No linked blog</option>
            {blogs.map((blog) => (
              <option key={blog.id} value={blog.id}>
                {blog.title}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="channel" label="Channel">
          <input defaultValue={schedule?.channel ?? ""} id="channel" name="channel" />
        </Field>

        <Field htmlFor="platformAccount" label="Platform account">
          <input defaultValue={schedule?.platformAccount ?? ""} id="platformAccount" name="platformAccount" />
        </Field>

        <Field htmlFor="campaignName" label="Campaign name">
          <input defaultValue={schedule?.campaignName ?? ""} id="campaignName" name="campaignName" />
        </Field>

        <Field htmlFor="priority" label="Priority">
          <input defaultValue={schedule?.priority ?? ""} id="priority" name="priority" />
        </Field>

        <Field htmlFor="brand" label="Brand">
          <input defaultValue={schedule?.brand ?? ""} id="brand" name="brand" />
        </Field>

        <Field htmlFor="sport" label="Sport">
          <input defaultValue={schedule?.sport ?? ""} id="sport" name="sport" />
        </Field>

        <Field htmlFor="region" label="Region">
          <input defaultValue={schedule?.region ?? ""} id="region" name="region" />
        </Field>

        <Field htmlFor="country" label="Country">
          <input defaultValue={schedule?.country ?? ""} id="country" name="country" />
        </Field>
      </div>

      <Field htmlFor="notes" label="Notes">
        <textarea defaultValue={schedule?.notes ?? ""} id="notes" name="notes" rows={5} />
      </Field>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <SubmitButton
          label={schedule ? "Save schedule entry" : "Create schedule entry"}
          pendingLabel={schedule ? "Saving schedule..." : "Creating schedule..."}
        />
      </div>
    </form>
  );
}
