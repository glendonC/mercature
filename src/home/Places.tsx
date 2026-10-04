import type { ReactNode } from 'react';
import { List, Panel, Row } from '../ui';
import { ChevronIcon } from '../ui/icons';
import './Home.css';

export type PlacePhoto = {
  id: string;
  name: string;
  /** One quiet line under the name: where it is, how long the walk is, what it still flags. */
  meta: string;
  /** What a screen reader hears instead of the photo's own words. */
  label: string;
  image: string;
  onOpen: () => void;
};
export type SavedRow = { id: string; title: string; detail: string; onOpen: () => void };

/**
 * A place is its own photograph, cut to a squircle and quiet until you reach for it,
 * with a charcoal glass label resting on it. The whole shape is the control.
 */
export default function Places({ places, saved = [], label, savedLabel }: {
  places: readonly PlacePhoto[];
  saved?: readonly SavedRow[];
  label: string;
  savedLabel: string;
}) {
  return <>
    <div className="home-photos" aria-label={label}>
      {places.map(place => <button key={place.id} type="button" className="home-photo" aria-label={place.label} onClick={place.onOpen}>
        <span className="home-photo-frame"><img src={place.image} alt=""/></span>
        <span className="home-photo-label">
          <span className="home-photo-name">{place.name}</span>
          <span className="home-photo-meta">{place.meta}</span>
        </span>
      </button>)}
    </div>
    {saved.length > 0 && <Panel size="card" className="home-saved" aria-label={savedLabel}>
      <List>{saved.map(entry => <Row key={entry.id} label={entry.title} detail={entry.detail} trailing={<ChevronIcon/>} onClick={entry.onOpen}/>)}</List>
    </Panel>}
  </>;
}
