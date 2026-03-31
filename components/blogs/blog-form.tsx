import { Blog, BlogStatus } from "@prisma/client";
import { blogStatusOptions, websiteOptions } from "@/lib/constants/options";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";

type BlogFormProps = {
  action: (formData: FormData) => void;
  blog?: Blog | null;
  assets?: Array<{ id: string; title: string }>;
  brandProfiles?: Array<{ id: string; brandName: string }>;
};

const sectionIndexes = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function BlogForm({
  action,
  blog,
  assets = [],
  brandProfiles = [],
}: BlogFormProps) {
  const selectedWebsites = new Set(blog?.websites ?? []);

  return (
    <form action={action} className="stack">
      <datalist id="brand-profile-options">
        {brandProfiles.map((profile) => (
          <option key={profile.id} value={profile.brandName} />
        ))}
      </datalist>

      <section className="card card--padded">
        <div className="section-heading">
          <div>
            <p className="kicker">Article setup</p>
            <h3>Core metadata</h3>
          </div>
          <span className="inline-chip">Required for a clean editorial record</span>
        </div>

      <div className="form-grid form-grid--2">
        <Field htmlFor="title" label="Title">
          <input defaultValue={blog?.title ?? ""} id="title" name="title" required />
        </Field>

        <Field htmlFor="status" label="Status">
          <select defaultValue={blog?.status ?? BlogStatus.idea} id="status" name="status">
            {blogStatusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="postDate" label="Post date">
          <input
            defaultValue={blog?.postDate ? new Date(blog.postDate).toISOString().slice(0, 16) : ""}
            id="postDate"
            name="postDate"
            type="datetime-local"
          />
        </Field>

        <Field htmlFor="category" label="Category">
          <input defaultValue={blog?.category ?? ""} id="category" name="category" />
        </Field>

        <Field htmlFor="brand" hint="Matches a saved brand profile when available" label="Brand">
          <input
            defaultValue={blog?.brand ?? ""}
            id="brand"
            list="brand-profile-options"
            name="brand"
          />
        </Field>

        <Field htmlFor="authorName" label="Author name">
          <input defaultValue={blog?.authorName ?? ""} id="authorName" name="authorName" />
        </Field>

        <Field htmlFor="authorImage" label="Author image URL">
          <input defaultValue={blog?.authorImage ?? ""} id="authorImage" name="authorImage" />
        </Field>

        <Field htmlFor="featureImage" label="Feature image URL">
          <input defaultValue={blog?.featureImage ?? ""} id="featureImage" name="featureImage" />
        </Field>

        <Field htmlFor="featureAssetId" label="Linked feature asset">
          <select defaultValue={blog?.featureAssetId ?? ""} id="featureAssetId" name="featureAssetId">
            <option value="">No linked asset</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.title}
              </option>
            ))}
          </select>
        </Field>

        <Field htmlFor="sport" label="Sport">
          <input defaultValue={blog?.sport ?? ""} id="sport" name="sport" />
        </Field>

        <Field htmlFor="region" label="Region">
          <input defaultValue={blog?.region ?? ""} id="region" name="region" />
        </Field>

        <Field htmlFor="country" label="Country">
          <input defaultValue={blog?.country ?? ""} id="country" name="country" />
        </Field>

        <Field htmlFor="aiGenerated" label="AI generated">
          <select defaultValue={String(blog?.aiGenerated ?? false)} id="aiGenerated" name="aiGenerated">
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </Field>

        <Field htmlFor="authorBio" label="Author bio">
          <textarea defaultValue={blog?.authorBio ?? ""} id="authorBio" name="authorBio" rows={4} />
        </Field>
      </div>
      </section>

      <section className="card card--padded">
        <div className="section-heading">
          <div>
            <p className="kicker">Distribution</p>
            <h3>Publishing metadata</h3>
          </div>
          <span className="inline-chip">Websites, tags, and source context</span>
        </div>

      <div className="form-grid form-grid--2">
        <Field htmlFor="tags" hint="Comma separated" label="Tags">
          <input defaultValue={blog?.tags.join(", ") ?? ""} id="tags" name="tags" />
        </Field>

        <Field hint="Select one or more destinations" label="Websites">
          <div className="card card--padded" style={{ display: "grid", gap: 10 }}>
            {websiteOptions.map((website) => (
              <label
                key={website}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: "0.95rem",
                  color: "var(--muted-foreground)",
                }}
              >
                <input
                  defaultChecked={selectedWebsites.has(website)}
                  name="websites"
                  type="checkbox"
                  value={website}
                />
                <span>{website}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field htmlFor="sources" hint="Comma separated URLs or references" label="Sources">
          <input defaultValue={blog?.sources.join(", ") ?? ""} id="sources" name="sources" />
        </Field>
      </div>
      </section>

      <section className="card card--padded">
        <Field htmlFor="sourcePrompt" label="Source prompt">
          <textarea
            defaultValue={blog?.sourcePrompt ?? ""}
            id="sourcePrompt"
            name="sourcePrompt"
            rows={4}
          />
        </Field>
      </section>

      {sectionIndexes.map((index) => {
        const textKey = `text${index}` as keyof Blog;
        const imageKey = `image${index}` as keyof Blog;
        const captionKey = `image${index}Caption` as keyof Blog;

        return (
          <section className="card card--padded" key={index}>
            <p className="kicker">Section {index}</p>
            <div className="stack">
              <Field htmlFor={`text${index}`} label={`Text ${index}`}>
                <textarea
                  defaultValue={(blog?.[textKey] as string | null | undefined) ?? ""}
                  id={`text${index}`}
                  name={`text${index}`}
                  rows={6}
                />
              </Field>

              <div className="form-grid form-grid--2">
                <Field htmlFor={`image${index}`} label={`Image ${index} URL`}>
                  <input
                    defaultValue={(blog?.[imageKey] as string | null | undefined) ?? ""}
                    id={`image${index}`}
                    name={`image${index}`}
                  />
                </Field>

                <Field htmlFor={`image${index}Caption`} label={`Image ${index} caption`}>
                  <input
                    defaultValue={(blog?.[captionKey] as string | null | undefined) ?? ""}
                    id={`image${index}Caption`}
                    name={`image${index}Caption`}
                  />
                </Field>
              </div>
            </div>
          </section>
        );
      })}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <SubmitButton
          label={blog ? "Save blog" : "Create blog"}
          pendingLabel={blog ? "Saving blog..." : "Creating blog..."}
        />
      </div>
    </form>
  );
}
