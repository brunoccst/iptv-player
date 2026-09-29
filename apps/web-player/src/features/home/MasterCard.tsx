import { memo, useState } from 'react';
import { type LibrarySection, type MasterCard as MasterCardData } from '@iptv/shared';
import { uiStore } from '../../appContext';
import { CardMenu, type MenuPosition } from '../../components/CardMenu';
import { PosterCard } from '../../components/PosterCard';
import { useTitleCard } from '../../hooks/stores';

/**
 * Poster card for one deduplicated title. Opens the details modal; a right-click opens its menu (Go to details, Mark as
 * (not) watched, D-081). Finished movies and fully watched series (D-082) carry the "Watched" tag.
 * Memoized: loading the next grid page then renders only the new cards, not the thousands already shown.
 */
export const MasterCard = memo(function MasterCard({ section, item }: { section: LibrarySection; item: MasterCardData }) {
  const [menu, setMenu] = useState<MenuPosition | null>(null);
  const openDetails = () => uiStore.getState().openDetails({ section, masterId: item.id });
  const card = useTitleCard(section, item, openDetails);
  return (
    <>
      <PosterCard
        title={item.title}
        posterUrl={item.posterUrl}
        badge={card.badge}
        watched={card.watched}
        subtitle={card.subtitle}
        onSelect={openDetails}
        onMenu={setMenu}
      />
      {menu ? (
        <CardMenu
          title={item.title}
          position={menu}
          onClose={() => setMenu(null)}
          actions={card.menuItems().map((entry) => ({ label: entry.label, onSelect: entry.run }))}
        />
      ) : null}
    </>
  );
});
