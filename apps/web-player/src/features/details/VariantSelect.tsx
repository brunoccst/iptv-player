import type { VariantInfo } from '@iptv/shared';
import { t } from '@iptv/shared';

/** "Version / Stream Quality" dropdown. Variants arrive best-first. */
export function VariantSelect({ variants, value, onChange }: { variants: VariantInfo[]; value: string; onChange(streamId: string): void }) {
  if (variants.length < 2) return null;
  return (
    <div className="variant-select">
      <label htmlFor="variant-select">{t('Version / Stream Quality')}</label>
      <select id="variant-select" className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {variants.map((variant, index) => (
          <option key={variant.streamId} value={variant.streamId}>
            {variant.label}
            {index === 0 ? ` (${t('best')})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
