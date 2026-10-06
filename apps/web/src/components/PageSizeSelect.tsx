import { FormField } from './FormField.tsx';
import { PAGE_SIZES } from './list-controls.ts';

export interface PageSizeSelectProps {
  value: number;
  onChange: (size: number) => void;
}

/** «Por página» selector (20, 50, 100). */
export function PageSizeSelect({ value, onChange }: PageSizeSelectProps) {
  return (
    <FormField id="page-size" label="Por página">
      {(control) => (
        <select
          {...control}
          name="pageSize"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}
