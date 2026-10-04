import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { assetUrl, loadDestination, type Destination } from '../destinations/data';
import { loadReview } from '../decisions/store';
import { spotMarkers } from '../destinations/markers';
import RouteMap from '../destinations/RouteMap';
import { buildWalk } from '../destinations/walk';
import { BARRIER_KINDS, Callout, IconButton, Kbd, Legend, MARK_ORDER, markOf, List, MapLabel, MarkerBadge, Panel, PanelHead, PrimaryAction, Row, Section, Quote, Segmented, Select, Sheet, Tag, TextArea, TextButton, type Tone } from '.';
import * as I from './icons';
import './kit.css';

const HERO = 'cusco-qorikancha';
const MESSAGES = [
  { lang: 'ko', text: '코리칸차 가는 길에 성당 옆 잉카 돌담 골목에 있는 돌계단이 너무 가팔라서 어머니가 내려가시기 힘들었어요.', spot: 'Calle Loreto', kind: I.ProblemIcon },
  { lang: 'es', text: 'Algunas partes del recorrido fueron bien duras para mi papá con su bastón.', spot: null, kind: I.ProblemIcon },
  { lang: 'en', text: 'Quick question: is the Qorikancha ticket booth step-free from the street?', spot: 'Ticket booth', kind: I.QuestionIcon },
  { lang: 'qu', text: 'Calle Loreto Maruriwan tupasqanpi kaq rumi patakuna sinchi sayaq.', spot: null, kind: null },
] as const;
const ICONS: [string, I.Icon][] = [['Steps', I.StepsIcon], ['Kerb', I.KerbIcon], ['Crossing', I.CrossingIcon], ['Cobblestones', I.CobblestonesIcon], ['Footway', I.FootwayIcon], ['Bollard', I.BollardIcon],
  ['Broken pavement', I.BrokenPavementIcon], ['Road', I.RoadIcon], ['On the path', I.PathIcon], ['Landmark', I.LandmarkIcon], ['No photos', I.NoPhotosIcon], ['Photo', I.PhotoIcon], ['Fixed', I.FixedIcon], ['Added by you', I.AddedIcon],
  ['Message', I.MessageIcon], ['Your note', I.NoteIcon], ['Remove', I.RemoveIcon], ['Problem', I.ProblemIcon], ['Praise', I.PraiseIcon], ['Question', I.QuestionIcon], ['Copy', I.CopyIcon], ['Start over', I.RotateIcon], ['Undo', I.UndoIcon], ['Use without AI', I.PointerIcon], ['Filed on a spot', I.PinIcon], ['Download', I.DownloadIcon], ['Skip', I.SkipIcon], ['Enter', I.EnterIcon], ['Done', I.CheckIcon],
  ['Close', I.CloseIcon], ['Back', I.BackIcon], ['Next', I.ChevronIcon], ['Add', I.PlusIcon], ['Zoom out', I.MinusIcon], ['Whole route', I.FitIcon], ['Home', I.HomeIcon], ['Menu', I.MenuIcon], ['More', I.MoreIcon]];
const MARK_NAMES: Record<string, string> = { steps: 'Steps', kerb: 'Kerb', broken: 'Broken pavement', bollard: 'Bollard or post', crossing: 'Pedestrian crossing', footway: 'Pavement', cobblestones: 'Cobblestones', road: 'Road' };
const initialTone = (): Tone => { try { return new URLSearchParams(location.search).get('tone') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } };

function useHero() {
  const [data, setData] = useState<Destination | null>(null);
  useEffect(() => { const controller = new AbortController(); loadDestination(HERO, controller.signal).then(setData).catch(() => undefined); return () => controller.abort(); }, []);
  return data;
}
function useNarrow() {
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 640px)').matches);
  useEffect(() => { const list = matchMedia('(max-width: 640px)'), change = () => setNarrow(list.matches); list.addEventListener('change', change); return () => list.removeEventListener('change', change); }, []);
  return narrow;
}

/** The review page for the shared primitives: the parts in place over the real walk, then each part on its own. */
export default function Kit() {
  const data = useHero();
  const narrow = useNarrow();
  const [tone, setTone] = useState<Tone>(initialTone);
  const walk = useMemo(() => data && buildWalk(data), [data]);
  const markers = useMemo(() => walk ? spotMarkers(walk, loadReview(HERO).review) : [], [walk]);
  const lead = useMemo(() => {
    if (!data) return null;
    const finding = data.findings.find(f => f.barrier && f.viewId && /steps/.test(f.concept));
    const view = finding && data.views.find(v => v.id === finding.viewId);
    const photo = view && data.photos.find(p => p.id === view.photoId);
    return finding && view ? { finding, view, photo, marks: data.findings.filter(f => f.viewId === view.id && f.outline.length > 2) } : null;
  }, [data]);
  const insets = narrow ? { top: 84, right: 16, bottom: 330, left: 16 } : { top: 90, right: 430, bottom: 70, left: 380 };
  const words = { zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Whole route', credit: '© OpenStreetMap contributors' };

  const inbox = <>
    <PanelHead title="Messages" meta="Qorikancha · 4 waiting" actions={<IconButton label="More"><I.MoreIcon /></IconButton>} />
    <Section title="Found along the walk" action={<TextButton icon={<I.CopyIcon />}>Route note</TextButton>}>
      <Legend items={[{ kind: 'possible', label: 'Steps 4' }, { kind: 'added', label: 'Kerb 1' }, { kind: 'no-photos', label: 'No photos 1' }, { kind: 'fixed', label: 'Fixed 0' }]} />
    </Section>
    <Section title="Messages">
      <List inset>
        {MESSAGES.map((message, index) => {
          const Kind = message.kind;
          return <Row key={index} selected={index === 0} icon={<Tag tone="solid" lang={message.lang}>{message.lang.toUpperCase()}</Tag>}
            label={<span lang={message.lang}>{message.text}</span>} detail={message.spot ? `On ${message.spot}` : 'Not filed'}
            meta={index < 2 ? <Tag tone="example">Example</Tag> : null} trailing={Kind ? <Kind size={16} /> : null} />;
        })}
      </List>
    </Section>
    <div className="kit-foot"><TextButton icon={<I.PlusIcon />}>Add a message</TextButton><TextButton muted icon={<I.RotateIcon />}>Start over</TextButton></div>
  </>;

  const card = lead && <Panel size="card" tone={tone} className="kit-card" enter aria-label="Calle Loreto">
    <PanelHead as="h3" title="Calle Loreto" meta="340 to 350 m · 2 messages" actions={<IconButton label="Close"><I.CloseIcon /></IconButton>} />
    <figure className="kit-photo" style={{ '--ratio': lead.view.height / lead.view.width } as CSSProperties}>
      <div className="kit-photo-frame">
        <img src={assetUrl(data!, lead.view.file)} alt="Steps" />
        <svg viewBox={`0 0 ${lead.view.width} ${lead.view.height}`} preserveAspectRatio="none" aria-hidden="true">
          {lead.marks.sort((a, b) => Number(a.barrier) - Number(b.barrier)).map(f => { const points = f.outline.map(p => p.join(',')).join(' '), mark = markOf(f.concept) ?? undefined; return <g key={f.id}>
            <polygon className="ui-mark-halo" data-barrier={f.barrier || undefined} points={points} /><polygon className="ui-mark" data-mark={mark} data-barrier={f.barrier || undefined} points={points} /></g>; })}
        </svg>
      </div>
      {lead.photo && <figcaption>{lead.photo.creator}. CC BY-SA 4.0 · Mapillary</figcaption>}
    </figure>
    <Legend items={[{ mark: 'steps', barrier: true, icon: <I.StepsIcon />, label: 'Steps' }, { mark: 'kerb', icon: <I.KerbIcon />, label: 'Kerb' }]} />
    <div className="kit-tools"><TextButton icon={<I.FixedIcon />}>Mark fixed</TextButton><TextButton icon={<I.NoteIcon />}>Note</TextButton><TextButton muted icon={<I.RemoveIcon />}>Remove</TextButton></div>
    <div className="kit-reply">
      <Segmented label="Reply in" value="ko" onChange={() => {}} options={[{ value: 'en', label: 'English' }, { value: 'es', label: 'Español', lang: 'es' }, { value: 'ko', label: '한국어', lang: 'ko' }]} />
      <Callout lang="ko">코리칸차 가는 길, 로레토 거리 340 m 지점에 계단이 있다는 기록이 있습니다.</Callout>
      <PrimaryAction icon={<I.CopyIcon />} shortcut="mod+enter" onClick={() => {}}>Copy reply</PrimaryAction>
    </div>
  </Panel>;

  return <main className="kit" data-tone-demo={tone}>
    <div className="kit-stage">
      {data && walk && <RouteMap still data={data} walk={walk} photoView="" markers={markers} labels={[]} insets={insets} highlight={null}
        onMarker={() => {}} onMap={() => {}} clearBottom={0} words={words} ariaLabel="Qorikancha" />}
      <header className="kit-bar">
        <span className="kit-brand">mercature</span>
        <Segmented variant="tabs" caps label="Surface" value={tone} onChange={setTone} options={[{ value: 'dark', label: 'Charcoal glass' }, { value: 'light', label: 'Light glass' }]} />
        <span className="kit-keys"><Kbd>Esc</Kbd><span>Back</span></span>
      </header>
      {!narrow && card}
      {!narrow && <div className="kit-pins" aria-hidden="true">
        <span style={{ left: '43%', top: '31%' }}><MapLabel icon={<I.StepsIcon />} title="Steps" meta="Calle Loreto · 2" selected /></span>
        <span style={{ left: '53%', top: '57%' }}><MapLabel icon={<I.FixedIcon />} tone="route" title="Fixed" meta="Ramp, 3 Oct" /></span>
      </div>}
      {narrow
        ? <Sheet tone={tone} className="kit-sheet" aria-label="Messages">{inbox}</Sheet>
        : <Panel as="aside" tone={tone} scroll className="kit-inbox" aria-label="Messages">{inbox}</Panel>}
    </div>

    <div className="kit-sheet-body">
      <Specimen title="Type" note="Outfit 300, 400, 500. Nothing below 13 px.">
        <ul className="kit-type">
          <li><span style={{ fontSize: 'var(--font-xl)', letterSpacing: 'var(--tracking-title)' }}>Qorikancha</span><small>22 · a screen</small></li>
          <li><span style={{ fontSize: 'var(--font-l)', fontWeight: 500 }}>Calle Loreto</span><small>17 · a card</small></li>
          <li><span style={{ fontSize: 'var(--font-m)' }}>The steps by the cathedral were steep.</span><small>15 · reading, a panel title</small></li>
          <li><span style={{ fontSize: 'var(--font-s)' }}>Add a message</span><small>14 · rows, buttons</small></li>
          <li><span style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)' }}>340 to 350 m · Mapillary, CC BY-SA 4.0</span><small>13 · meta, credits, hints</small></li>
        </ul>
      </Specimen>

      <Specimen title="Meaning" note="Colour, then shape, then a word.">
        <Legend className="kit-meaning" items={[{ kind: 'route', label: 'The walk, the way' }, { kind: 'possible', label: 'Possible barrier' }, { kind: 'added', label: 'Added by you' }, { kind: 'fixed', label: 'Fixed' },
          { kind: 'removed', label: 'Dismissed' }, { kind: 'no-photos', label: 'No photos' }, { kind: 'landmark', label: 'Landmark' }, { kind: 'selected', label: 'Selected' }, { kind: 'outline', label: 'Model outline' }, { kind: 'mark', label: 'Other mark' }]} />
      </Specimen>

      <Specimen title="Icons" note="24 px grid, round 1.4 px line at any size.">
        <ul className="kit-icons">{ICONS.map(([name, Icon]) => <li key={name}><Icon size={20} /><span>{name}</span></li>)}</ul>
      </Specimen>

      <Specimen title="Photo marks" note="One hue per kind with its icon. Clay for kinds that can be barriers, quiet hues for the ground, never blue. A possible barrier is drawn heavier.">
        <Legend className="kit-meaning" items={MARK_ORDER.map(kind => ({ mark: kind, barrier: kind === 'steps', icon: (() => { const Icon = I.iconOfMark(kind); return <Icon />; })(), label: MARK_NAMES[kind] + (kind === 'steps' ? ', possible barrier' : BARRIER_KINDS.has(kind) ? '' : '') }))} />
      </Specimen>

      <Specimen wide title="Map labels" note="Icon and colour for the kind and its state, a short title, a smaller meta line, a halo.">
        <div className="kit-ground">
          <svg className="kit-ground-art" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
            <rect x="40" y="18" width="190" height="74" rx="2" /><rect x="300" y="124" width="210" height="76" rx="2" /><rect x="610" y="16" width="250" height="66" rx="2" /><rect x="700" y="132" width="200" height="70" rx="2" />
            <path className="kit-ground-street" d="M0 108 H1000 M560 0 V220" /><path className="kit-ground-halo" d="M20 170 C180 170 200 60 400 60 S640 150 980 110" /><path className="kit-ground-route" d="M20 170 C180 170 200 60 400 60 S640 150 980 110" />
          </svg>
          <span style={{ left: '12%', top: '72%' }}><MapLabel icon={<I.StepsIcon />} title="Steps" meta="Calle Loreto · 340 m" /></span>
          <span style={{ left: '33%', top: '30%' }}><MapLabel icon={<I.KerbIcon />} title="Kerb" meta="2 messages" selected /></span>
          <span style={{ left: '60%', top: '54%' }}><MapLabel icon={<I.FixedIcon />} tone="route" title="Fixed" meta="Ramp, 3 Oct" /></span>
          <span style={{ left: '82%', top: '44%' }}><MapLabel icon={<I.NoPhotosIcon />} tone="unknown" title="No photos" meta="420 to 430 m" /></span>
          <span style={{ left: '40%', top: '86%' }}><MapLabel icon={<I.AddedIcon />} title="Added by you" meta="Loose slab" /></span>
          <span style={{ left: '76%', top: '14%' }}><MapLabel icon={<I.LandmarkIcon />} tone="ink" title="Qorikancha" meta="Ticket booth" /></span>
        </div>
        <div className="kit-badges">
          <MarkerBadge icon={<I.StepsIcon />} /><MarkerBadge icon={<I.KerbIcon />} count={2} /><MarkerBadge icon={<I.StepsIcon />} selected /><MarkerBadge icon={<I.FixedIcon />} tone="route" />
          <MarkerBadge icon={<I.NoPhotosIcon />} tone="unknown" /><MarkerBadge icon={<I.StepsIcon />} quiet /><MarkerBadge icon={<I.LandmarkIcon />} tone="ink" /><MarkerBadge icon={<I.MessageIcon />} tone="ink" count={3} />
        </div>
      </Specimen>

      <Specimen title="Buttons" note="Three kinds. Primary: one slim pill per panel, a key hint only where its shortcut is wired. Secondary: an icon and a label, quiet. Reset and remove: the same shape in muted ink. Text links only for credits.">
        <p className="kit-caption">Primary</p>
        <div className="kit-row"><PrimaryAction icon={<I.CopyIcon />}>Copy reply</PrimaryAction><PrimaryAction icon={<I.DownloadIcon />}>Download 84 MB</PrimaryAction><PrimaryAction icon={<I.MessageIcon />} disabled>Read message</PrimaryAction></div>
        <p className="kit-caption">Secondary</p>
        <div className="kit-row"><TextButton icon={<I.PlusIcon />}>Add a message</TextButton><TextButton icon={<I.FixedIcon />}>Mark fixed</TextButton><TextButton icon={<I.NoteIcon />}>Your note</TextButton><TextButton icon={<I.CopyIcon />}>Route note</TextButton><TextButton icon={<I.PointerIcon />}>Use without AI</TextButton><TextButton icon={<I.PinIcon />}>Filed on Calle Loreto</TextButton></div>
        <p className="kit-caption">Reset and remove</p>
        <div className="kit-row"><TextButton muted icon={<I.BackIcon />}>All messages</TextButton><TextButton muted icon={<I.RotateIcon />}>Start over</TextButton><TextButton muted icon={<I.RemoveIcon />}>Remove</TextButton><TextButton muted icon={<I.UndoIcon />}>Undo fix</TextButton><TextButton muted icon={<I.CloseIcon />}>Cancel</TextButton><TextButton muted icon={<I.CopyIcon />} disabled>Copy</TextButton></div>
        <p className="kit-caption">Icon only</p>
        <div className="kit-row"><IconButton label="Back"><I.BackIcon /></IconButton><IconButton label="Close"><I.CloseIcon /></IconButton><IconButton label="Zoom in" surface="glass"><I.PlusIcon /></IconButton><IconButton label="Zoom out" surface="glass"><I.MinusIcon /></IconButton><IconButton label="Whole route" surface="glass"><I.FitIcon /></IconButton></div>
      </Specimen>

      <Specimen title="Tags and choices">
        <div className="kit-row"><Tag tone="solid" lang="ko">KO</Tag><Tag tone="solid">ES</Tag><Tag tone="example">Example</Tag><Tag>Not read yet</Tag><Tag tone="barrier"><I.StepsIcon />Steps</Tag><Tag tone="route"><I.FixedIcon />Fixed</Tag><Tag tone="unknown">Dismissed</Tag></div>
        <div className="kit-row"><Choice /><TabsChoice /></div>
      </Specimen>

      <Specimen title="Rows">
        <div className="kit-rows">
          <List inset>
            <Row icon={<I.StepsIcon />} label="Steps" meta="4" />
            <Row icon={<I.MessageIcon />} label="Calle Loreto, 340 to 350 m" detail="2 messages · Possible barrier" trailing={<I.ChevronIcon size={16} />} />
            <Row icon={<I.FixedIcon />} label="Ramp at the ticket booth" detail="Fixed, 3 Oct" selected />
            <Row static icon={<I.NoPhotosIcon />} label="No photos on this stretch" meta="420 m" />
          </List>
        </div>
      </Specimen>

      <Specimen title="Fields">
        <Quote lang="es">Algunas partes del recorrido fueron bien duras para mi papá con su bastón.</Quote>
        <div className="kit-fields"><TextArea placeholder="Paste a visitor's message" aria-label="Visitor message" /><div className="kit-row"><Select aria-label="Language" defaultValue="es"><option value="en">English</option><option value="es">Español</option><option value="ko">한국어</option></Select><PrimaryAction icon={<I.MessageIcon />}>Read message</PrimaryAction></div></div>
      </Specimen>

      <Specimen title="Surfaces" note="Charcoal glass for every surface over the map or a photo. Light glass only where a page asks for it.">
        <div className="kit-surfaces">{(['light', 'dark'] as const).map(surface => <Panel key={surface} tone={surface} size="card" className="kit-mini">
          <PanelHead as="h3" title={surface === 'light' ? 'Light glass' : 'Charcoal glass'} meta="Calle Loreto · 340 m" actions={<IconButton label="Close"><I.CloseIcon /></IconButton>} />
          <Legend items={[{ kind: 'route', label: 'Walk' }, { kind: 'possible', label: 'Possible barrier' }, { kind: 'removed', label: 'Dismissed' }]} />
          <div className="kit-row kit-ends"><TextButton icon={<I.FixedIcon />}>Mark fixed</TextButton><PrimaryAction icon={<I.CopyIcon />}>Copy reply</PrimaryAction></div>
        </Panel>)}</div>
      </Specimen>

      <Specimen title="Notice" note="A plain error, on a small charcoal surface.">
        <div className="app-error kit-static" role="presentation">This device could not keep your change.<button type="button" aria-label="Dismiss">×</button></div>
      </Specimen>

      <Specimen title="Tokens">
        <dl className="kit-tokens">
          <div><dt>Radius</dt><dd>6 tag · 8 button · 12 photo, card · 14 panel · 16 sheet</dd></div>
          <div><dt>Hairline</dt><dd>0.5 px on dense screens, 10% ink</dd></div>
          <div><dt>Motion</dt><dd>120 ms hover · 160 ms choice · 240 ms panel · 400 ms camera</dd></div>
          <div><dt>Targets</dt><dd>44 px box; 30 px fill, 32 px pill</dd></div>
        </dl>
      </Specimen>
    </div>
  </main>;
}

function Specimen({ title, note, wide, children }: { title: string; note?: string; wide?: boolean; children: ReactNode }) {
  return <section className={wide ? 'kit-specimen kit-wide' : 'kit-specimen'}><header><h2>{title}</h2>{note && <p>{note}</p>}</header>{children}</section>;
}
function Choice() {
  const [value, setValue] = useState('en');
  return <Segmented label="Route note" value={value} onChange={setValue} options={[{ value: 'en', label: 'EN' }, { value: 'es', label: 'ES' }, { value: 'ko', label: 'KO' }]} />;
}
function TabsChoice() {
  const [value, setValue] = useState('walk');
  return <Segmented variant="tabs" label="View" value={value} onChange={setValue} options={[{ value: 'walk', label: 'Walk' }, { value: 'messages', label: 'Messages' }, { value: 'note', label: 'Note' }]} />;
}

