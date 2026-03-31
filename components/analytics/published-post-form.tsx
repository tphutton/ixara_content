import { PublishedPostStatus, SocialPlatform } from "@prisma/client";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";

type PublishedPostFormProps = {
  action: (formData: FormData) => void;
  connectedAccounts: Array<{ id: string; accountName: string; platform: SocialPlatform }>;
  contentOptions: Array<{ id: string; title: string }>;
  blogOptions: Array<{ id: string; title: string }>;
  scheduleOptions: Array<{ id: string; title: string }>;
};

export function PublishedPostForm({
  action,
  connectedAccounts,
  contentOptions,
  blogOptions,
  scheduleOptions,
}: PublishedPostFormProps) {
  return (
    <form action={action} className="stack">
      <div className="form-grid form-grid--2">
        <Field htmlFor="platform" label="Platform">
          <select defaultValue={SocialPlatform.instagram} id="platform" name="platform">
            {Object.values(SocialPlatform).map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="status" label="Post status">
          <select defaultValue={PublishedPostStatus.imported} id="status" name="status">
            {Object.values(PublishedPostStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="connectedAccountId" label="Connected account">
          <select defaultValue="" id="connectedAccountId" name="connectedAccountId">
            <option value="">No linked account</option>
            {connectedAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.accountName} ({account.platform})
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="platformAccountName" label="Platform account name">
          <input id="platformAccountName" name="platformAccountName" />
        </Field>

        <Field htmlFor="contentId" label="Linked content">
          <select defaultValue="" id="contentId" name="contentId">
            <option value="">No linked content</option>
            {contentOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="blogId" label="Linked blog">
          <select defaultValue="" id="blogId" name="blogId">
            <option value="">No linked blog</option>
            {blogOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="scheduleId" label="Linked schedule">
          <select defaultValue="" id="scheduleId" name="scheduleId">
            <option value="">No linked schedule</option>
            {scheduleOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="externalPostId" label="External post ID">
          <input id="externalPostId" name="externalPostId" />
        </Field>

        <Field htmlFor="externalPostUrl" label="External post URL">
          <input id="externalPostUrl" name="externalPostUrl" />
        </Field>

        <Field htmlFor="publishedAt" label="Published at">
          <input id="publishedAt" name="publishedAt" type="datetime-local" />
        </Field>

        <Field htmlFor="importedAt" label="Imported at">
          <input id="importedAt" name="importedAt" type="datetime-local" />
        </Field>

        <Field htmlFor="impressions" label="Impressions">
          <input id="impressions" min={0} name="impressions" type="number" />
        </Field>

        <Field htmlFor="engagements" label="Engagements">
          <input id="engagements" min={0} name="engagements" type="number" />
        </Field>

        <Field htmlFor="likes" label="Likes">
          <input id="likes" min={0} name="likes" type="number" />
        </Field>

        <Field htmlFor="comments" label="Comments">
          <input id="comments" min={0} name="comments" type="number" />
        </Field>

        <Field htmlFor="shares" label="Shares">
          <input id="shares" min={0} name="shares" type="number" />
        </Field>

        <Field htmlFor="clicks" label="Clicks">
          <input id="clicks" min={0} name="clicks" type="number" />
        </Field>
      </div>

      <Field htmlFor="titleSnapshot" label="Title snapshot">
        <input id="titleSnapshot" name="titleSnapshot" />
      </Field>

      <Field htmlFor="captionSnapshot" label="Caption snapshot">
        <textarea id="captionSnapshot" name="captionSnapshot" rows={4} />
      </Field>

      <SubmitButton label="Create imported post" pendingLabel="Saving imported post..." />
    </form>
  );
}
