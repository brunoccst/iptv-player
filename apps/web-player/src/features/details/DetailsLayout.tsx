import { createContext, useContext, type ReactNode } from 'react';
import { WatchedTag } from '../../components/WatchedTag';

/**
 * Wide landscape windows show the details in two columns over the whole window: title, buttons and description fixed
 * on the left, the episodes (movies: cast and the other facts) on the right, which alone scrolls (issue #186, D-158),
 * as on the TV and phone app. Narrower or portrait windows keep the panel that scrolls as a whole.
 */
export const SPLIT_QUERY = '(orientation: landscape) and (min-width: 700px)';
export const SplitLayout = createContext(false);

/** The details' parts, stacked in the panel, or in two columns on a wide landscape window (D-158). */
export function DetailsLayout({
  backdrop,
  title,
  watched,
  play,
  actions,
  main,
  side,
  list,
}: {
  backdrop: string | null | undefined;
  title: string;
  watched?: boolean;
  /** The Play/Resume button. */
  play: ReactNode;
  /** The icon buttons beside it. */
  actions: ReactNode;
  main: ReactNode;
  side: ReactNode;
  /** Series: the episodes, under the rest in the panel, the right column in two columns. */
  list?: ReactNode;
}) {
  if (useContext(SplitLayout))
    return (
      <div className="details-split">
        {backdrop ? <img className="details-split__backdrop" src={backdrop} alt="" /> : null}
        <div className={list ? 'details-split__left' : 'details-split__left details-split__left--single'} data-testid="details-left">
          <h2 className="details__title">{title}</h2>
          {watched ? <WatchedTag className="details__watched" /> : null}
          <Actions play={play} actions={actions} />
          <div className="details-split__main">{main}</div>
          <div className="details__side details-split__side">{side}</div>
        </div>
        {/* A movie leaves the right side to the backdrop: its facts in the middle of a big window read as lost. */}
        {list ? (
          <div className="details-split__right" data-testid="details-right">
            {list}
          </div>
        ) : null}
      </div>
    );
  return (
    <>
      <DetailsHero backdrop={backdrop} title={title} watched={watched}>
        <Actions play={play} actions={actions} />
      </DetailsHero>
      <div className="details__body">
        <div>{main}</div>
        <div className="details__side">{side}</div>
      </div>
      {list}
    </>
  );
}

/**
 * Play/Resume, then the icon buttons in a group of their own that wraps: an icon that does not fit goes under the
 * other icons, not under Play (DECISIONS.md#d-183).
 */
function Actions({ play, actions }: { play: ReactNode; actions: ReactNode }) {
  return (
    <div className="details__actions">
      {play}
      <div className="details__icon-actions" data-testid="details-icon-actions">
        {actions}
      </div>
    </div>
  );
}

function DetailsHero({
  backdrop,
  title,
  watched,
  children,
}: {
  backdrop: string | null | undefined;
  title: string;
  /** "Watched" tag next to the title (D-081). */
  watched?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="details__hero">
      {backdrop ? <img src={backdrop} alt="" /> : null}
      <div className="details__heading">
        <h2 className="details__title">{title}</h2>
        {watched ? <WatchedTag className="details__watched" /> : null}
        {children}
      </div>
    </div>
  );
}
