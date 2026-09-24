import { memo } from 'react';
import type { LibrarySection, MasterCard as MasterCardData } from '@iptv/shared';
import { uiStore } from '../../appContext';
import { PosterCard } from '../../components/PosterCard';

/**
 * Poster card for one deduplicated title. Opens the details modal.
 * Memoized: loading the next grid page then renders only the new cards, not the thousands already shown.
 */
export const MasterCard = memo(function MasterCard({ section, item }: { section: LibrarySection; item: MasterCardData }) {
  const versions = item.variantCount > 1 ? `${item.variantCount} versions` : null;
  return (
    <PosterCard
      title={item.title}
      posterUrl={item.posterUrl}
      badge={item.bestQuality === '4K' ? '4K' : null}
      subtitle={[item.year, versions].filter(Boolean).join(' · ') || null}
      onSelect={() => uiStore.getState().openDetails({ section, masterId: item.id })}
    />
  );
});
