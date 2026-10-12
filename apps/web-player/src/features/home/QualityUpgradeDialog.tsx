import { t, upgradeLine, type WatchlistDto } from '@iptv/shared';
import { uiStore } from '../../appContext';
import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { useQualityUpgrades } from '../../hooks/stores';

/**
 * Home: movies on My List that turned from a cinema copy (CAM, TS…) into a better one, as in the TV/phone app
 * (DECISIONS.md#d-176). Play, More info, OK or closing marks them all as shown.
 */
export function QualityUpgradeDialog() {
  const { upgrades, dismiss, playTarget } = useQualityUpgrades();
  if (upgrades.length === 0) return null;

  const play = (entry: WatchlistDto) => {
    dismiss();
    void playTarget(entry).then((target) =>
      target ? uiStore.getState().play(target) : uiStore.getState().openDetails({ section: 'movies', masterId: entry.masterId }),
    );
  };
  const details = (entry: WatchlistDto) => {
    dismiss();
    uiStore.getState().openDetails({ section: 'movies', masterId: entry.masterId });
  };

  return (
    <Modal label={t('Better quality on My List')} onClose={dismiss}>
      <div className="upgrades" data-testid="quality-upgrades">
        <h2>{t('Better quality on My List')}</h2>
        <ul className="upgrades__list">
          {upgrades.map((entry) => (
            <li key={entry.masterId} className="upgrades__entry" data-testid={`quality-upgrade-${entry.masterId}`}>
              {entry.posterUrl ? <img className="upgrades__poster" src={entry.posterUrl} alt="" loading="lazy" /> : null}
              <div className="upgrades__text">
                <strong>{entry.year ? `${entry.title} (${entry.year})` : entry.title}</strong>
                <span className="upgrades__line">{upgradeLine(entry)}</span>
                <div className="upgrades__actions">
                  <button type="button" className="button button--primary" onClick={() => play(entry)}>
                    <Icon name="play" /> {t('Play')}
                  </button>
                  <button type="button" className="button button--secondary" onClick={() => details(entry)}>
                    <Icon name="info" /> {t('More Info')}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className="button button--ghost" onClick={dismiss}>
          {t('OK')}
        </button>
      </div>
    </Modal>
  );
}
