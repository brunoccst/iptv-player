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
  actions,
  main,
  side,
  list,
}: {
  backdrop: string | null | undefined;
  title: string;
  watched?: boolean;
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
        <div className="details-split__left" data-testid="details-left">
          <h2 className="details__title">{title}</h2>
          {watched ? <WatchedTag className="details__watched" /> : null}
          <div className="details__actions">{actions}</div>
          <div className="details-split__main">{main}</div>
          {list ? <div className="details__side details-split__side">{side}</div> : null}
        </div>
        <div className={list ? 'details-split__right' : 'details-split__right details-split__right--centered'} data-testid="details-right">
          {list ?? <div className="details__side">{side}</div>}
        </div>
      </div>
    );
  return (
    <>
      <DetailsHero backdrop={backdrop} title={title} watched={watched}>
        {actions}
      </DetailsHero>
      <div className="details__body">
        <div>{main}</div>
        <div className="details__side">{side}</div>
      </div>
      {list}
    </>
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
        <div className="details__actions">{children}</div>
      </div>
    </div>
  );
}
