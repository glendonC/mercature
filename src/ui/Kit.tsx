import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { assetUrl, loadDestination, type Destination } from '../destinations/data';
import { loadReview } from '../decisions/store';
import { spotMarkers } from '../destinations/markers';
import RouteMap from '../destinations/RouteMap';
import { buildWalk } from '../destinations/walk';
import { BARRIER_KINDS, VisitorAvatar, ChangeRow, GlassButton, GlassCircle, Choice, Choices, Companion, GROUND_KINDS, KIND_ORDER, kindOf, Composer, CopyBox, Dialogue, IconButton, Kbd, Legend, MARK_ORDER, List, MapLabel, MarkerBadge, Panel, PanelHead, PrimaryAction, Row, Quote, ScrollFade, Segmented, Select, Tag, TextArea, TextButton, type Tone } from '.';
import * as I from './icons';
import './kit.css';

const HERO = 'cusco-qorikancha';
const ICONS: [string, I.Icon][] = [['Steps', I.StepsIcon], ['Kerb', I.KerbIcon], ['Crossing', I.CrossingIcon], ['Cobblestones', I.CobblestonesIcon], ['Footway', I.FootwayIcon], ['Bollard', I.BollardIcon],
  ['Broken pavement', I.BrokenPavementIcon], ['Road', I.RoadIcon], ['On the path', I.PathIcon], ['Landmark', I.LandmarkIcon], ['No photos', I.NoPhotosIcon], ['Photo', I.PhotoIcon], ['Fixed', I.FixedIcon], ['Added by you', I.AddedIcon],
  ['Message', I.MessageIcon], ['Your note', I.NoteIcon], ['Remove', I.RemoveIcon], ['Problem', I.ProblemIcon], ['Praise', I.PraiseIcon], ['Question', I.QuestionIcon], ['Copy', I.CopyIcon], ['Start over', I.RotateIcon], ['Undo', I.UndoIcon], ['Use without AI', I.PointerIcon], ['Filed on a spot', I.PinIcon], ['Download', I.DownloadIcon], ['Skip', I.SkipIcon], ['Enter', I.EnterIcon], ['Done', I.CheckIcon],
  ['Close', I.CloseIcon], ['Back', I.BackIcon], ['Next', I.ChevronIcon], ['Add', I.PlusIcon], ['Zoom out', I.MinusIcon], ['Whole route', I.FitIcon], ['Home', I.HomeIcon], ['Menu', I.MenuIcon], ['More', I.MoreIcon]];
const MARK_NAMES: Record<string, string> = { steps: 'Steps', kerb: 'Kerb', broken: 'Broken pavement', bollard: 'Bollard or post', crossing: 'Pedestrian crossing', footway: 'Pavement', cobblestones: 'Cobblestones', road: 'Road',
  steep: 'Steep slope', gate: 'Gate', handrail: 'Handrail', ramp: 'Ramp', bench: 'Bench', lighting: 'Street light', toilets: 'Toilets', wheelchair: 'Wheelchair access', tactile: 'Tactile paving' };
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

const SCENES = [
  { value: 'check', label: 'Check' },
  { value: 'message', label: 'Message' },
  { value: 'reply', label: 'Reply' },
  { value: 'note', label: 'Note' },
  { value: 'reading', label: 'Reading' },
  { value: 'long', label: 'Long' },
] as const;
type Scene = (typeof SCENES)[number]['value'];
const initialScene = (): Scene => { try { const scene = new URLSearchParams(location.search).get('scene'); return SCENES.some(item => item.value === scene) ? scene as Scene : 'check'; } catch { return 'check'; } };
const REPLY_KO = '코리칸차 가는 길, 로레토 거리 340 m 지점에 계단이 있다는 기록이 있습니다. 현장 확인은 아직 하지 않았습니다.';
const NOTE = 'Plaza de Armas to the Qorikancha ticket booth, 594 m.\nCalle Loreto, 340 m: steps recorded in a street photo and in OpenStreetMap. Not checked on site.\nHatunrumiyoq, 420 to 430 m: no street photos.\nTicket booth: a ramp was recorded on 3 Oct.\nThis note is made from street photos and OpenStreetMap. Ask staff before you go.';

/** The review page for the shared primitives: the guide's dialogue over the real walk, then each part on its own. */
export default function Kit() {
  const data = useHero();
  const narrow = useNarrow();
  const [tone] = useState<Tone>(initialTone);
  const [scene, setScene] = useState<Scene>(initialScene);
  const walk = useMemo(() => data && buildWalk(data), [data]);
  const markers = useMemo(() => walk ? spotMarkers(walk, loadReview(HERO).review) : [], [walk]);
  const lead = useMemo(() => {
    if (!data) return null;
    const finding = data.findings.find(f => f.barrier && f.viewId && /steps/.test(f.concept));
    const view = finding && data.views.find(v => v.id === finding.viewId);
    const photo = view && data.photos.find(p => p.id === view.photoId);
    return finding && view ? { finding, view, photo, marks: data.findings.filter(f => f.viewId === view.id && f.outline.length > 2) } : null;
  }, [data]);
  const insets = narrow ? { top: 84, right: 16, bottom: 300, left: 16 } : { top: 90, right: 60, bottom: 90, left: 620 };
  const words = { zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Whole route', credit: '© OpenStreetMap contributors' };

  const photoCard = lead && <Panel size="card" className="kit-above-card" aria-label="Calle Loreto">
    <PanelHead as="h3" title="Calle Loreto" meta="340 m · photo 1 of 2" actions={<IconButton label="Close"><I.CloseIcon /></IconButton>} />
    <figure className="kit-photo" style={{ '--ratio': lead.view.height / lead.view.width } as CSSProperties}>
      <div className="kit-photo-frame">
        <img src={assetUrl(data!, lead.view.file)} alt="Steps" />
        <svg viewBox={`0 0 ${lead.view.width} ${lead.view.height}`} preserveAspectRatio="none" aria-hidden="true">
          {lead.marks.sort((a, b) => Number(a.barrier) - Number(b.barrier)).map(f => { const points = f.outline.map(p => p.join(',')).join(' '), mark = kindOf(f.concept) ?? undefined; return <g key={f.id}>
            <polygon className="ui-mark-halo" data-barrier={f.barrier || undefined} points={points} /><polygon className="ui-mark" data-mark={mark} data-barrier={f.barrier || undefined} points={points} /></g>; })}
        </svg>
      </div>
      {lead.photo && <figcaption>{lead.photo.creator}. CC BY-SA 4.0 · Mapillary</figcaption>}
    </figure>
  </Panel>;
  const noteCard = <Panel size="card" className="kit-above-card" aria-label="Route note">
    <PanelHead as="h3" title="Route note" meta="Qorikancha · English" actions={<IconButton label="Close"><I.CloseIcon /></IconButton>} />
    <CopyBox className="kit-note" text={NOTE} copyLabel="Copy" copiedLabel="Copied" lead />
  </Panel>;

  const said = {
    check: 'When the walk was recorded, a model outlined steps here, on Calle Loreto. What is there now?',
    message: 'A visitor wrote in Korean. It seems to be about the steps on Calle Loreto. Is that right?',
    reply: 'Here is a reply in Korean, from what your map says.',
    note: 'Here is the route note.',
    reading: undefined,
    long: ['Let\u2019s go through your walk together.', 'It runs about 600 m from the Plaza de Armas to the Qorikancha ticket booth, past the cathedral and down Calle Loreto.', 'Street photos show five spots that might give visitors trouble, most of them steps.', 'We will look at each one, and you tell me what is there now.'],
  }[scene];
  const [talking, setTalking] = useState(false);
  const choices = {
    check: <Choices label="What is there now?"><Choice lead icon={<I.StepsIcon />}>Still there</Choice><Choice icon={<I.FixedIcon />}>Fixed</Choice><Choice icon={<I.RemoveIcon />}>Not a barrier</Choice><Choice icon={<I.MoreIcon />}>Something else</Choice></Choices>,
    message: <Choices label="Is that right?"><Choice lead icon={<I.PinIcon />}>Yes, that spot</Choice><Choice icon={<I.PointerIcon />}>Another spot</Choice><Choice icon={<I.CloseIcon />}>Not about a spot</Choice></Choices>,
    reply: <Choices label="Next"><Choice lead icon={<I.ChevronIcon />}>Next message</Choice><Choice icon={<I.NoteIcon />}>Route note</Choice></Choices>,
    note: null,
    reading: null,
    long: null,
  }[scene];
  const messageCard = <Panel size="card" className="kit-focus-card" aria-label="Visitor message">
    <PanelHead as="h3" title="Korean" meta="Message 1 of 4" />
    <Quote lang="ko">코리칸차 가는 길에 성당 옆 골목의 돌계단이 너무 가팔라서 어머니가 내려가시기 힘들었어요.</Quote>
  </Panel>;
  const replyCard = <Panel size="card" className="kit-focus-card" aria-label="Reply">
    <PanelHead as="h3" title="Reply" meta="Korean" />
    <CopyBox text={REPLY_KO} lang="ko" copyLabel="Copy" copiedLabel="Copied" className="kit-note" />
  </Panel>;
  const focus = { check: photoCard, message: messageCard, reply: replyCard, note: noteCard, reading: null, long: null }[scene];

  return <main className="kit" data-tone-demo={tone}>
    <div className="kit-stage">
      {data && walk && <RouteMap still data={data} walk={walk} photoView="" markers={markers} labels={[]} insets={insets} highlight={null}
        onMarker={() => {}} onMap={() => {}} clearBottom={0} words={words} ariaLabel="Qorikancha" />}
      <header className="kit-bar">
        <span className="kit-brand">mercature</span>
        <Segmented variant="tabs" caps label="Scene" value={scene} onChange={setScene} options={SCENES} />
        <span className="kit-keys"><Kbd>Esc</Kbd><span>Back</span></span>
      </header>
      <div className="kit-edit-bar"><GlassButton icon={<I.NoteIcon />}>Edit</GlassButton><BeforeNow /></div>
      <Companion className="kit-companion" working={scene === 'reading'} talking={talking} />
      {focus && <div className="kit-focus" data-scene={scene}>{focus}{choices}</div>}
      <Dialogue key={scene} label="Guide" say={said} back={scene === 'check' || scene === 'message' ? <GlassCircle label="Back"><I.BackIcon /></GlassCircle> : undefined}
        actions={scene === 'check' ? <TextButton muted icon={<I.SkipIcon />}>Skip for now</TextButton> : undefined} onTalking={setTalking} continueLabel="More" working={scene === 'reading'} workingLabel="Reading" meta={scene === 'check' ? '1 of 8' : undefined}
        composer={scene === 'long' ? undefined : <Composer label="In your words" sendLabel="Send" onSend={() => {}} disabled={scene === 'reading'} />} />
    </div>

    <div className="kit-sheet-body">
      <Specimen title="Visitors" note="Each visitor message gets its own bot from its id: the same face every time, never the guide's grey. Still at 28 in a row, idle at 40 in the message view.">
        <div data-tone="dark" className="kit-visitors">
          <div className="kit-row">{['m-ko-1', 'm-es-2', 'm-en-3', 'm-qu-4', 'm-ko-5', 'm-es-6', 'm-en-7', 'm-ka-8'].map(id => <VisitorAvatar key={id} id={id} size={40} />)}</div>
          <List inset>
            <Row icon={<VisitorAvatar id="m-ko-1" still />} label={<span lang="ko">코리칸차 가는 길에 돌계단이 너무 가팔라서</span>} detail="Korean · Calle Loreto" />
            <Row icon={<VisitorAvatar id="m-es-2" still />} label={<span lang="es">Algunas partes fueron duras para mi papá</span>} detail="Spanish · not filed" />
            <Row icon={<VisitorAvatar id="m-en-3" still />} label="Is the ticket booth step-free?" detail="English · Ticket booth" />
          </List>
        </div>
      </Specimen>

      <Specimen wide title="Editing" note="Always there over the map: the Edit pill, white while editing; Before and Now beside it, the state that is on in white. Her changes are rows with the kind's icon in its hue, one line, and a quiet Undo. A changed marker wears a dashed ink ring over a white halo; solid ink is the selection.">
        <div className="kit-editing">
          <div className="kit-row"><GlassButton icon={<I.NoteIcon />}>Edit</GlassButton><GlassButton icon={<I.NoteIcon />} pressed>Edit</GlassButton><BeforeNow /></div>
          <Panel size="card" className="kit-changes" aria-label="Your changes">
            <PanelHead as="h3" title="Your changes" meta="3 on this walk" />
            <ChangeRow kind="steps" label="Steps, Calle Loreto: still there" meta="340 m" onUndo={() => {}} undoLabel="Undo" onOpen={() => {}} />
            <ChangeRow kind="ramp" label="Ramp added by the ticket booth" meta="590 m" onUndo={() => {}} undoLabel="Undo" onOpen={() => {}} />
            <ChangeRow kind="kerb" label="Kerb, Calle Maruri: not a barrier" meta="180 m" onUndo={() => {}} undoLabel="Undo" onOpen={() => {}} />
          </Panel>
          <div className="kit-row kit-changed-demo"><span className="ui-marker ui-changed" data-tone="ink"><I.StepsIcon /></span><span>Changed</span><MarkerBadge icon={<I.StepsIcon />} tone="ink" selected /><span>Selected</span></div>
        </div>
      </Specimen>

      <Specimen wide title="Guide's dialogue" note="One clean line on its own at the bottom, her field under it. The guide floats in the map beside what it talks about; her choices are their own list beside the photo or message.">
        <div className="kit-dialogues">
          <div className="kit-row"><Companion /><Companion talking /><Companion working /></div>
          <Dialogue className="kit-static-dialogue" label="Guide, one line" say="Hi. I can help you check this walk and answer visitors." composer={<Composer label="In your words" sendLabel="Send" onSend={() => {}} />} />
          <Dialogue className="kit-static-dialogue" label="Guide, working" working workingLabel="Reading" />
          <Choices className="kit-choices-demo" label="What is there now?"><Choice selected icon={<I.CheckIcon />}>Still there</Choice><Choice disabled icon={<I.FixedIcon />}>Fixed</Choice><Choice disabled icon={<I.RemoveIcon />}>Not a barrier</Choice></Choices>
        </div>
      </Specimen>

      <Specimen wide title="Kinds" note="Every kind its own hue, on a dark casing, always with its icon and name. Ground kinds are dashed and quieter. A possible barrier is a clay badge and a heavier line, never a tint. No kind is blue, clay or mid grey.">
        <div className="kit-kinds">
          {KIND_ORDER.map(kind => { const Icon = I.iconOfKind(kind), barrier = kind === 'steps' || kind === 'kerb'; return <div key={kind} className="kit-kind" data-mark={kind}>
            <svg viewBox="0 0 120 36" aria-hidden="true"><path className="ui-mark-halo" data-barrier={barrier || undefined} d="M6 26C30 26 34 10 60 10s30 16 54 16" /><path className="ui-mark" data-mark={kind} data-barrier={barrier || undefined} d="M6 26C30 26 34 10 60 10s30 16 54 16" style={{ fill: 'none' }} /></svg>
            <span className="kit-kind-chip" data-tone="dark"><span className="kit-kind-dot" />{barrier && <span className="kit-kind-badge" />}<Icon size={16} /><span>{MARK_NAMES[kind]}</span></span>
            <small>{GROUND_KINDS.has(kind) ? 'ground, dashed' : barrier ? 'possible barrier' : 'feature'}</small>
          </div>; })}
        </div>
      </Specimen>

      <Specimen title="Dialogue type" note="One hierarchy: no labels over content, one muted meta line at most.">
        <ul className="kit-type">
          <li><span style={{ fontSize: 'var(--chat-text)' }}>What is there now?</span><small>15 · the line, her words</small></li>
          <li><span style={{ fontSize: 'var(--font-s)', fontWeight: 500 }}>Still there</span><small>14 · a choice</small></li>
          <li><span style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)' }}>1 of 8 · Korean</span><small>13 · meta</small></li>
        </ul>
        <dl className="kit-tokens kit-rhythm">
          <div><dt>Rhythm</dt><dd>8 between the line and her field · 4 between choices · 12 by 18 inside the line</dd></div>
          <div><dt>Width</dt><dd>640 centred on a wide screen, the full width less 12 on a phone</dd></div>
          <div><dt>Guide</dt><dd>a 44 disc in the map beside the spot it talks about; a thin arc turns only while it works</dd></div>
        </dl>
      </Specimen>

      <Specimen title="In your words" note="The send action sits inside the field. Enter sends; an input method's Enter never does.">
        <div className="kit-fields kit-on-map"><Composer label="In your words" sendLabel="Send" onSend={() => {}} /><Composer label="In your words" sendLabel="Send" value="There is a new ramp beside the steps" onChange={() => {}} onSend={() => {}} /></div>
      </Specimen>

      <Specimen title="Copy box" note="The Copy action sits inside the box it copies. Long words scroll inside it, faded at the clipped edge.">
        <div className="kit-fields" data-tone="dark" style={{ padding: 12, borderRadius: 16, background: 'var(--line-surface)' }}>
          <CopyBox text={REPLY_KO} lang="ko" meta="Korean" copyLabel="Copy" copiedLabel="Copied" />
          <CopyBox text={NOTE} copyLabel="Copy" copiedLabel="Copied" lead className="kit-note-short" />
        </div>
      </Specimen>

      <Specimen title="Scroll fade" note="Content that is cut off fades at the edge where more is hidden, never a hard cut.">
        <div data-tone="dark" className="kit-fade-demo"><ScrollFade className="kit-fade-box"><List inset>
          {MARK_ORDER.map(kind => { const Icon = I.iconOfMark(kind); return <Row key={kind} icon={<Icon />} label={MARK_NAMES[kind]} meta={kind.length} />; })}
        </List></ScrollFade></div>
      </Specimen>

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
        <div className="kit-row"><TrackChoice /><TabsChoice /></div>
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
function TrackChoice() {
  const [value, setValue] = useState('en');
  return <Segmented label="Route note" value={value} onChange={setValue} options={[{ value: 'en', label: 'EN' }, { value: 'es', label: 'ES' }, { value: 'ko', label: 'KO' }]} />;
}
function TabsChoice() {
  const [value, setValue] = useState('walk');
  return <Segmented variant="tabs" label="View" value={value} onChange={setValue} options={[{ value: 'walk', label: 'Walk' }, { value: 'messages', label: 'Messages' }, { value: 'note', label: 'Note' }]} />;
}

function BeforeNow() {
  const [value, setValue] = useState<'before' | 'now'>('now');
  return <Segmented surface="glass" label="Show the walk" value={value} onChange={setValue} options={[{ value: 'before', label: 'Before' }, { value: 'now', label: 'Now' }]} />;
}
