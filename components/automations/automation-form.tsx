import {
  AutomationFrequency,
  AutomationStatus,
  AutomationType,
  ContentStatus,
  type AutomationWorkflow,
} from "@prisma/client";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";

type AutomationFormProps = {
  action: (formData: FormData) => void;
  workflow?: AutomationWorkflow | null;
  brandProfiles: Array<{ id: string; brandName: string }>;
};

const weekdays = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

export function AutomationForm({ action, workflow, brandProfiles }: AutomationFormProps) {
  return (
    <form action={action} className="stack">
      <div className="form-grid form-grid--2">
        <Field htmlFor="name" label="Workflow name">
          <input defaultValue={workflow?.name ?? ""} id="name" name="name" required />
        </Field>

        <Field htmlFor="status" label="Status">
          <select defaultValue={workflow?.status ?? AutomationStatus.draft} id="status" name="status">
            {Object.values(AutomationStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="type" label="Automation type">
          <select defaultValue={workflow?.type ?? AutomationType.weekly_social_content} id="type" name="type">
            <option value={AutomationType.weekly_social_content}>weekly_social_content</option>
            <option value={AutomationType.blog_post_generation}>blog_post_generation</option>
          </select>
        </Field>

        <Field htmlFor="frequency" label="Frequency">
          <select
            defaultValue={workflow?.frequency ?? AutomationFrequency.weekly}
            id="frequency"
            name="frequency"
          >
            {Object.values(AutomationFrequency).map((frequency) => (
              <option key={frequency} value={frequency}>
                {frequency}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="brandProfileId" label="Brand profile">
          <select defaultValue={workflow?.brandProfileId ?? ""} id="brandProfileId" name="brandProfileId">
            <option value="">No linked profile</option>
            {brandProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.brandName}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="brandName" label="Brand override">
          <input defaultValue={workflow?.brandName ?? ""} id="brandName" name="brandName" />
        </Field>

        <Field htmlFor="itemCount" label="Items per run">
          <input
            defaultValue={workflow?.itemCount ?? 5}
            id="itemCount"
            min={1}
            max={12}
            name="itemCount"
            type="number"
          />
        </Field>

        <Field
          htmlFor="targetContentStatus"
          hint="Used by social content workflows. Blog workflows currently create draft blog records."
          label="Target content status"
        >
          <select
            defaultValue={workflow?.targetContentStatus ?? ContentStatus.draft}
            id="targetContentStatus"
            name="targetContentStatus"
          >
            {Object.values(ContentStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="dayOfWeek" label="Day of week">
          <select defaultValue={workflow?.dayOfWeek ?? 1} id="dayOfWeek" name="dayOfWeek">
            {weekdays.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="runTime" label="Run time">
          <input defaultValue={workflow?.runTime ?? "09:00"} id="runTime" name="runTime" type="time" />
        </Field>

        <Field htmlFor="timezone" label="Timezone">
          <input defaultValue={workflow?.timezone ?? "Asia/Bangkok"} id="timezone" name="timezone" />
        </Field>

        <Field htmlFor="platforms" hint="Comma separated" label="Platforms">
          <input defaultValue={workflow?.platforms.join(", ") ?? ""} id="platforms" name="platforms" />
        </Field>

        <Field htmlFor="channels" hint="Comma separated" label="Channels">
          <input defaultValue={workflow?.channels.join(", ") ?? ""} id="channels" name="channels" />
        </Field>

        <Field htmlFor="sport" label="Sport">
          <input defaultValue={workflow?.sport ?? ""} id="sport" name="sport" />
        </Field>

        <Field htmlFor="region" label="Region">
          <input defaultValue={workflow?.region ?? ""} id="region" name="region" />
        </Field>

        <Field htmlFor="country" label="Country">
          <input defaultValue={workflow?.country ?? ""} id="country" name="country" />
        </Field>
      </div>

      <Field
        htmlFor="description"
        hint="Use this for the operational goal of the workflow, such as the audience, cadence, or editorial purpose."
        label="Workflow description"
      >
        <textarea defaultValue={workflow?.description ?? ""} id="description" name="description" rows={3} />
      </Field>

      <Field
        htmlFor="promptTemplate"
        hint="Describe what should be generated here. For blog workflows, include the blog topics, angle, structure, and any section-level expectations."
        label="Prompt template"
      >
        <textarea
          defaultValue={workflow?.promptTemplate ?? ""}
          id="promptTemplate"
          name="promptTemplate"
          rows={6}
        />
      </Field>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <SubmitButton
          label={workflow ? "Save automation" : "Create automation"}
          pendingLabel={workflow ? "Saving automation..." : "Creating automation..."}
        />
      </div>
    </form>
  );
}
