type BrandOption = {
  id?: string;
  brandName: string;
};

type BrandSelectProps = {
  id?: string;
  name?: string;
  value?: string | null;
  options: BrandOption[];
  placeholder?: string;
  allowBlank?: boolean;
  required?: boolean;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
};

export function BrandSelect({
  id = "brand",
  name = "brand",
  value,
  options,
  placeholder = "Select brand",
  allowBlank = true,
  required = false,
  onChange,
}: BrandSelectProps) {
  const valueProps = onChange
    ? { value: value ?? "", onChange }
    : { defaultValue: value ?? "" };

  return (
    <select id={id} name={name} required={required} {...valueProps}>
      {allowBlank ? <option value="">{placeholder}</option> : null}
      {options.map((profile) => (
        <option key={profile.id ?? profile.brandName} value={profile.brandName}>
          {profile.brandName}
        </option>
      ))}
    </select>
  );
}

export function BrandMultiSelect({
  id = "brand",
  name = "brand",
  values = [],
  options,
}: {
  id?: string;
  name?: string;
  values?: string[];
  options: BrandOption[];
}) {
  return (
    <select defaultValue={values} id={id} multiple name={name} size={Math.min(Math.max(options.length, 3), 6)}>
      {options.map((profile) => (
        <option key={profile.id ?? profile.brandName} value={profile.brandName}>
          {profile.brandName}
        </option>
      ))}
    </select>
  );
}
import type { ChangeEvent } from "react";
