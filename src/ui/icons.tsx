import type { ReactNode, SVGProps } from 'react';
import { kindOf, markOf, type Kind, type MarkKind } from './kinds';

/** Thin line icons on a 24 px grid. The stroke stays near 1.4 px on screen at any size, so a 14 px marker glyph reads as well as a 20 px row icon. */
export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number; title?: string };
export type Icon = ((props: IconProps) => ReactNode) & { displayName?: string };

const strokeFor = (size: number) => Math.min(2.25, Math.max(1.5, (1.4 * 24) / size));

function make(name: string, body: ReactNode): Icon {
  const icon: Icon = ({ size = 18, title, className, strokeWidth, ...rest }: IconProps) => (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth ?? strokeFor(size)}
      strokeLinecap="round" strokeLinejoin="round" className={className ? `ui-icon ${className}` : 'ui-icon'}
      aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} focusable="false" {...rest}>
      {title && <title>{title}</title>}
      {body}
    </svg>
  );
  icon.displayName = name;
  return icon;
}

const camera = <path d="M4.5 8h2.6l1.5-2.2h6.8L16.9 8h2.6a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />;

/* What is on the walk */
export const StepsIcon = make('StepsIcon', <path d="M3 19.5h4.5V15H12v-4.5h4.5V6H21" />);
export const KerbIcon = make('KerbIcon', <path d="M3 8.5h8a1 1 0 0 1 1 1v5a1 1 0 0 0 1 1h8M14.5 19.5h2M19 19.5h2" />);
export const CrossingIcon = make('CrossingIcon', <><path d="M3 5.5h18M3 18.5h18" /><rect x="4" y="9" width="2.5" height="6" rx="0.6" /><rect x="8.5" y="9" width="2.5" height="6" rx="0.6" /><rect x="13" y="9" width="2.5" height="6" rx="0.6" /><rect x="17.5" y="9" width="2.5" height="6" rx="0.6" /></>);
export const CobblestonesIcon = make('CobblestonesIcon', <><rect x="3.5" y="5" width="8" height="6" rx="2.2" /><rect x="12.5" y="5" width="8" height="6" rx="2.2" /><rect x="8" y="13" width="8" height="6" rx="2.2" /><path d="M3.5 13.5a.5.5 0 0 1 .5-.5h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H4a.5.5 0 0 1-.5-.5ZM20.5 13.5a.5.5 0 0 0-.5-.5h-1a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1a.5.5 0 0 0 .5-.5Z" /></>);
export const FootwayIcon = make('FootwayIcon', <><circle cx="13.5" cy="4.3" r="1.8" /><path d="M12.8 7.6 11.2 13l2.3 3.5.9 4M11.2 13l-1.5 3.8-2.2 3.7M12.5 8.8 15 11l2 .5M12.5 8.8 10 10.8 8.6 13" /></>);
export const BollardIcon = make('BollardIcon', <path d="M9 20.5V8a3 3 0 0 1 6 0v12.5M9 11.5h6M6.5 20.5h11" />);
export const BrokenPavementIcon = make('BrokenPavementIcon', <><rect x="3.5" y="6" width="17" height="12" rx="1.5" /><path d="m10.5 6 2 4-2.5 2.5 2.5 5.5" /></>);
export const RoadIcon = make('RoadIcon', <path d="M6.5 20.5 10 3.5M17.5 20.5 14 3.5M12 6v1.5M12 11v2M12 16.5v2.5" />);
/** A rail beside the way, on its posts. */
export const HandrailIcon = make('HandrailIcon', <path d="M3.5 11 20.5 5M7 9.8V20M17 6.2V20M3.5 20h17" />);
/** A gentle wedge to wheel up. */
export const RampIcon = make('RampIcon', <><path d="M3.5 19.5h17v-7.5Z" /><circle cx="8" cy="9" r="2.2" /></>);
/** A slope too steep to be easy: a sharp wedge and its angle. */
export const SteepIcon = make('SteepIcon', <path d="M3.5 19.5h17V5.5ZM15.5 19.5a4 4 0 0 0-1.1-2.9" />);
/** Two posts and the bars between them. */
export const GateIcon = make('GateIcon', <path d="M5 20.5V4.5M19 20.5V4.5M5 8.5h14M5 14h14M9.7 8.5V14M14.3 8.5V14" />);
/** A seat, its back and legs. */
export const BenchIcon = make('BenchIcon', <path d="M5 7.5h14M3.5 12.5h17M6 12.5v6M18 12.5v6M6 7.5v5M18 7.5v5" />);
/** A street lamp. */
export const LightingIcon = make('LightingIcon', <path d="M8 20.5V7a3 3 0 0 1 3-3h4.5M13.5 7h4l-2-3M6 20.5h4" />);
/** Toilets: a seat and its tank, seen from the side. */
export const ToiletsIcon = make('ToiletsIcon', <path d="M6.5 4h4.5v7.5H6.5ZM4 11.5h15.5a6 6 0 0 1-6 6h-.5l.7 3H8.3l.6-3.2A6 6 0 0 1 4 11.5Z" />);
/** Tactile paving: a slab of raised dots. */
export const TactileIcon = make('TactileIcon', <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.5 8.5h.01M12 8.5h.01M15.5 8.5h.01M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5h.01" strokeWidth={2.6} /></>);
/** Wheelchair access, as OpenStreetMap records it. */
export const WheelchairIcon = make('WheelchairIcon', <><circle cx="10" cy="4.6" r="1.6" /><path d="M10 7.5v6h5.5l2.5 5M10 10.5h4.5" /><path d="M8 11.2a5 5 0 1 0 6.6 6.3" /></>);
/** Something on the walking path, of no named kind: a spot on a winding way. */
export const PathIcon = make('PathIcon', <><path d="M7 21c0-3.6 10-4.6 10-9S7 6.6 7 3" /><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" /></>);
export const LandmarkIcon = make('LandmarkIcon', <path d="M12 3.5 4 8h16ZM5.5 10.5v7M10 10.5v7M14 10.5v7M18.5 10.5v7M3.5 20.5h17" />);

/* What happened to a spot */
export const FixedIcon = make('FixedIcon', <path d="m5 12.5 4.5 4.5L19 7" />);
export const AddedIcon = make('AddedIcon', <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11ZM12 7v6M9 10h6" />);
export const PhotoIcon = make('PhotoIcon', <>{camera}<circle cx="12" cy="13" r="3.2" /></>);
export const NoPhotosIcon = make('NoPhotosIcon', <>{camera}<circle cx="12" cy="13" r="3.2" /><path d="m3.5 3.5 17 17" /></>);
export const MessageIcon = make('MessageIcon', <path d="M5.5 5h13A1.5 1.5 0 0 1 20 6.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3.5V16h-.5A1.5 1.5 0 0 1 4 14.5v-8A1.5 1.5 0 0 1 5.5 5Z" />);
export const NoteIcon = make('NoteIcon', <path d="M4.5 19.5 5.5 15 15.8 4.7a2 2 0 0 1 2.9 2.9L8.4 17.9ZM13.8 6.7l3.5 3.5" />);
export const RemoveIcon = make('RemoveIcon', <><circle cx="12" cy="12" r="8.5" /><path d="m6 6 12 12" /></>);

/* What a visitor wrote */
export const ProblemIcon = make('ProblemIcon', <path d="M12 4 21 19.5H3ZM12 10v4M12 16.8v.2" />);
export const PraiseIcon = make('PraiseIcon', <path d="m12 4 2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.3 6.9 19l1.2-5.6L4 9.6l5.6-.6Z" />);
export const QuestionIcon = make('QuestionIcon', <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.2 1-1.2 1.8v.4M12 16.8v.2" /></>);

/* Actions */
export const CheckIcon = make('CheckIcon', <path d="m5 12.5 4.5 4.5L19 7" />);
/** Start over: a full turn back to the beginning. */
export const RotateIcon = make('RotateIcon', <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9" />);
/** Undo one record: an arrow turning back. */
export const UndoIcon = make('UndoIcon', <path d="M9 14 4.5 9.5 9 5M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3" />);
/** Do it by hand: she taps the spot herself. */
export const PointerIcon = make('PointerIcon', <path d="M6 3.5 18.5 10l-5.4 1.8L11 17.5Z M13.1 11.8l5 5" />);
export const PinIcon = make('PinIcon', <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>);
export const DownloadIcon = make('DownloadIcon', <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />);
/** Skip ahead, as on the build replay. */
export const SkipIcon = make('SkipIcon', <path d="m5.5 6 6 6-6 6M12.5 6l6 6-6 6" />);
/** Send her words: an arrow up, inside the field it sends. */
export const SendIcon = make('SendIcon', <path d="M12 19V5.5M6 11.5l6-6 6 6" />);
/** Go in: open a place or a prepared scene. */
export const EnterIcon = make('EnterIcon', <path d="M14 4h4.5a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H14M9.5 16.5 14 12 9.5 7.5M14 12H3.5" />);

/* Controls */
export const CloseIcon = make('CloseIcon', <path d="M6 6l12 12M18 6 6 18" />);
export const BackIcon = make('BackIcon', <path d="m15 5-7 7 7 7" />);
export const ChevronIcon = make('ChevronIcon', <path d="m9 5 7 7-7 7" />);
export const PlusIcon = make('PlusIcon', <path d="M12 5v14M5 12h14" />);
export const MinusIcon = make('MinusIcon', <path d="M5 12h14" />);
export const FitIcon = make('FitIcon', <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />);
export const CopyIcon = make('CopyIcon', <><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" /><path d="M15.5 8.5V5.5a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5h3" /></>);
export const HomeIcon = make('HomeIcon', <path d="M4 10 12 3.5l8 6.5v10a.5.5 0 0 1-.5.5H15v-6.5H9V20.5H4.5A.5.5 0 0 1 4 20Z" />);
/** The menu: Home, the places, the language and the sources. */
export const MenuIcon = make('MenuIcon', <path d="M4.5 7h15M4.5 12h15M4.5 17h15" />);
export const MoreIcon = make('MoreIcon', <path d="M5.5 12h.01M12 12h.01M18.5 12h.01" strokeWidth={3} />);

const MARK_ICONS: Record<Kind, Icon> = { steps: StepsIcon, kerb: KerbIcon, broken: BrokenPavementIcon, bollard: BollardIcon, crossing: CrossingIcon, footway: FootwayIcon, cobblestones: CobblestonesIcon, road: RoadIcon,
  steep: SteepIcon, gate: GateIcon, handrail: HandrailIcon, ramp: RampIcon, bench: BenchIcon, lighting: LightingIcon, toilets: ToiletsIcon, wheelchair: WheelchairIcon, tactile: TactileIcon };
/** The icon for a mark kind. */
export const iconOfMark = (kind: MarkKind): Icon => MARK_ICONS[kind];
/** The icon for any kind a place names. */
export const iconOfKind = (kind: Kind): Icon => MARK_ICONS[kind];
/** The icon for a finding's concept, as the place package names it ('steps', 'highway=steps', 'kerb', ...). */
export function iconFor(concept: string): Icon | null {
  const kind = kindOf(concept);
  return kind ? MARK_ICONS[kind] : null;
}
