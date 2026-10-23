import { memo } from 'react';
import type { LibrarySection, MasterCard } from '@iptv/shared';
import { useScreenHost } from './host';
import { PosterCard } from './ui/PosterCard';

/**
 * One deduplicated title's cover (web `MasterCard`): quality badge ("4K", or "CAM"/"TS" when only cinema copies, D-141),
 * "year · N versions", the "Watched" tag (D-081) and a bookmark when on My List (issue #157). It opens the details; its
 * menu (Go to details, My List, Mark as (not) watched) opens on hold OK, a long touch or a right-click (D-078).
 */
export const TitleCard = memo(function TitleCard({
  section,
  item,
  width,
  hasTVPreferredFocus,
}: {
  section: LibrarySection;
  item: MasterCard;
  width?: number;
  hasTVPreferredFocus?: boolean;
}) {
  const host = useScreenHost();
  const openDetails = () => host.openDetails(section, item.id);
  const card = host.hooks.useTitleCard(section, item, openDetails);
  return (
    <host.TitleMenu title={item.title} items={card.menuItems}>
      {(openMenu) => (
        <PosterCard
          title={item.title}
          posterUrl={item.posterUrl}
          width={width}
          hasTVPreferredFocus={hasTVPreferredFocus}
          reserveSubtitle
          badge={card.badge}
          watched={card.watched}
          onList={card.onList}
          subtitle={card.subtitle}
          onPress={openDetails}
          onLongPress={openMenu}
          onFocus={() => host.focusTitle?.(section, item)}
          onBlur={() => host.blurTitle?.(item.id)}
        />
      )}
    </host.TitleMenu>
  );
});
