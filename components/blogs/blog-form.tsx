import { Blog, BlogStatus } from "@prisma/client";
import { blogStatusOptions } from "@/lib/constants/options";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";

type BlogFormProps = {
  action: (formData: FormData) => void;
  blog?: Blog | null;
};

const sectionIndexes = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function BlogForm({ action, blog }: BlogFormProps) {
  return (
    <form action={action} className="stack">
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

        <Field htmlFor="authorName" label="Author name">
          <input defaultValue={blog?.authorName ?? ""} id="authorName" name="authorName" />
        </Field>

        <Field htmlFor="authorImage" label="Author image URL">
          <input defaultValue={blog?.authorImage ?? ""} id="authorImage" name="authorImage" />
        </Field>

        <Field htmlFor="featureImage" label="Feature image URL">
          <input defaultValue={blog?.featureImage ?? ""} id="featureImage" name="featureImage" />
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

      <div className="form-grid form-grid--2">
        <Field htmlFor="tags" hint="Comma separated" label="Tags">
          <input defaultValue={blog?.tags.join(", ") ?? ""} id="tags" name="tags" />
        </Field>

        <Field htmlFor="websites" hint="Comma separated" label="Websites">
          <input defaultValue={blog?.websites.join(", ") ?? ""} id="websites" name="websites" />
        </Field>

        <Field htmlFor="sources" hint="Comma separated URLs or references" label="Sources">
          <input defaultValue={blog?.sources.join(", ") ?? ""} id="sources" name="sources" />
        </Field>
      </div>

      <Field htmlFor="sourcePrompt" label="Source prompt">
        <textarea defaultValue={blog?.sourcePrompt ?? ""} id="sourcePrompt" name="sourcePrompt" rows={4} />
      </Field>

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
