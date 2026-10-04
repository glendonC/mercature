import type { ReactNode } from 'react';
import { List, Panel, Row, Tag } from '../ui';
import { ChevronIcon } from '../ui/icons';
import './Home.css';

export type PlaceRow = {
  id: string;
  /** The name as the place itself gives it. */
  name: string;
  /** Where it is, or what it is: one short line under the name. */
  detail: string;
  /** A count or a tag at the end of the row. */
  meta?: ReactNode;
  /** What a screen reader hears instead of the row's own words. */
  label?: string;
  thumb: ReactNode;
  onOpen: () => void;
  example?: boolean;
};

/** The places this device can open, as one charcoal surface with a row each. */
export default function Places({ rows, label }: { rows: readonly PlaceRow[]; label: string }) {
  return <Panel size="card" className="home-places" aria-label={label}>
    <List>
      {rows.map(row => <Row key={row.id} icon={row.thumb} label={row.name} detail={row.detail}
        meta={row.example ? <Tag tone="example">{row.meta}</Tag> : row.meta}
        trailing={<ChevronIcon/>} aria-label={row.label} onClick={row.onOpen}/>)}
    </List>
  </Panel>;
}
