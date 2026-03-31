import {
  ConnectedAccountStatus,
  SocialPlatform,
  type ConnectedAccount,
} from "@prisma/client";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";

type ConnectedAccountFormProps = {
  action: (formData: FormData) => void;
  brandProfiles: Array<{ id: string; brandName: string }>;
  account?: ConnectedAccount | null;
};

export function ConnectedAccountForm({
  action,
  brandProfiles,
  account,
}: ConnectedAccountFormProps) {
  return (
    <form action={action} className="stack">
      <div className="form-grid form-grid--2">
        <Field htmlFor="platform" label="Platform">
          <select
            defaultValue={account?.platform ?? SocialPlatform.facebook}
            id="platform"
            name="platform"
          >
            {Object.values(SocialPlatform).map((platform) => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="status" label="Connection status">
          <select
            defaultValue={account?.status ?? ConnectedAccountStatus.pending_setup}
            id="status"
            name="status"
          >
            {Object.values(ConnectedAccountStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="accountName" label="Account name">
          <input defaultValue={account?.accountName ?? ""} id="accountName" name="accountName" required />
        </Field>

        <Field htmlFor="accountHandle" label="Account handle">
          <input defaultValue={account?.accountHandle ?? ""} id="accountHandle" name="accountHandle" />
        </Field>

        <Field htmlFor="externalAccountId" hint="Optional until OAuth is connected" label="External account ID">
          <input
            defaultValue={account?.externalAccountId ?? ""}
            id="externalAccountId"
            name="externalAccountId"
          />
        </Field>

        <Field htmlFor="brandProfileId" label="Brand profile">
          <select defaultValue={account?.brandProfileId ?? ""} id="brandProfileId" name="brandProfileId">
            <option value="">No linked profile</option>
            {brandProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.brandName}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="brandName" label="Brand override">
          <input defaultValue={account?.brandName ?? ""} id="brandName" name="brandName" />
        </Field>

        <Field htmlFor="scopes" hint="Comma separated" label="Scopes">
          <input defaultValue={account?.scopes.join(", ") ?? ""} id="scopes" name="scopes" />
        </Field>

        <Field htmlFor="region" label="Region">
          <input defaultValue={account?.region ?? ""} id="region" name="region" />
        </Field>

        <Field htmlFor="country" label="Country">
          <input defaultValue={account?.country ?? ""} id="country" name="country" />
        </Field>
      </div>

      <Field
        htmlFor="lastSyncStatus"
        hint="Use this to note sync state, API readiness, or connection issues until live OAuth is enabled."
        label="Sync notes"
      >
        <textarea
          defaultValue={account?.lastSyncStatus ?? ""}
          id="lastSyncStatus"
          name="lastSyncStatus"
          rows={3}
        />
      </Field>

      <SubmitButton
        label={account ? "Save account" : "Create account"}
        pendingLabel={account ? "Saving account..." : "Creating account..."}
      />
    </form>
  );
}
