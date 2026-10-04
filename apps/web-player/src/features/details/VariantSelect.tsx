import type { VariantInfo } from '@iptv/shared';
import { bestVariant, t } from '@iptv/shared';
import { useLibrary } from '../../hooks/stores';

/** "Version / Stream Quality" dropdown. Variants arrive best-first; "(best)" only when one is (D-136). */
export function VariantSelect({ variants, value, onChange }: { variants: VariantInfo[]; value: string; onChange(streamId: string): void }) {
  const best = useLibrary((s) => bestVariant(variants, s.versionLanguages));
  if (variants.length < 2) return null;
  return (
    <div className="variant-select">
      <label htmlFor="variant-select">{t('Version / Stream Quality')}</label>
      <select id="variant-select" className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {variants.map((variant) => (
          <option key={variant.streamId} value={variant.streamId}>
            {variant.label}
            {variant === best ? ` (${t('best')})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
