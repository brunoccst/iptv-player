import type { VariantInfo } from '@iptv/shared';

/** "Version / Stream Quality" dropdown. Variants arrive best-first from the backend. */
export function VariantSelect({ variants, value, onChange }: { variants: VariantInfo[]; value: string; onChange(streamId: string): void }) {
  if (variants.length < 2) return null;
  return (
    <div className="variant-select">
      <label htmlFor="variant-select">Version / Stream Quality</label>
      <select id="variant-select" className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {variants.map((variant, index) => (
          <option key={variant.streamId} value={variant.streamId}>
            {variant.label}
            {index === 0 ? ' (best)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
