import { expect, test } from '@playwright/test';
import { QORIKANCHA_PLACE } from '../../src/site/route';
import { addSpot, addedSpot, clearFixed, isFixed, markFixed, noteLangOf, ownNote, parseEdits, removeSpot, setNote, EDIT_KINDS, NOTE_LIMIT, NO_NOTE, type Edits } from '../../src/edits/store';
import { guessLanguage } from '../../src/destinations/copy';
import { addedFeature, fixedLine, noteForPassage, ownNoteLines, withEdits, type Locate } from '../../src/edits/place';

const empty: Edits = { schema: 'mercature-route-edits/1', place: 'cusco-qorikancha', added: [], fixed: {}, notes: {}, answers: {}, seq: 0 };
const at = '2026-10-04T12:00:00.000Z';
const locate: Locate = stretch => ({ from: stretch * 10, to: stretch * 10 + 10, landmark: 'Loreto' });

test('a removed spot never gives its id to another spot', () => {
  let edits = addSpot(empty, 21, 'steps', NO_NOTE, at);
  edits = addSpot(edits, 30, 'kerb', NO_NOTE, at);
  expect(edits.added.map(spot => spot.id)).toEqual(['added-1', 'added-2']);
  edits = removeSpot(edits, 'added-2');
  edits = addSpot(edits, 40, 'narrow', NO_NOTE, at);
  expect(edits.added.map(spot => spot.id)).toEqual(['added-1', 'added-3']);
  // A record saved before the counter existed still never repeats an id.
  const older = JSON.parse(JSON.stringify(edits)) as Record<string, unknown>;
  delete older.seq;
  expect(addSpot(parseEdits(JSON.stringify(older), 'cusco-qorikancha'), 50, 'other', NO_NOTE, at).added.at(-1)!.id).toBe('added-4');
});

test('her words are bounded and kept as typed, and removing a spot takes its note with it', () => {
  let edits = addSpot(empty, 21, 'steps', ownNote(` ${'x'.repeat(NOTE_LIMIT + 50)} `, 'es'), at);
  expect(addedSpot(edits, 'added-1')!.note).toEqual({ text: 'x'.repeat(NOTE_LIMIT), language: 'es' });
  edits = setNote(edits, 'added-1', ownNote('Hay una rampa nueva', 'es'));
  expect(edits.notes['added-1'].text).toBe('Hay una rampa nueva');
  edits = setNote(edits, 'added-1', ownNote('  ', 'es'));
  expect(edits.notes['added-1']).toBeUndefined();
  edits = setNote(edits, 'added-1', ownNote('Otra vez', 'es'));
  expect(removeSpot(edits, 'added-1').notes['added-1']).toBeUndefined();
});

test('a fix is kept by stretch, like a decision, and can be taken back', () => {
  const edits = markFixed(empty, [34], ownNote('Rampa instalada', 'es'), at);
  expect(isFixed(edits, [34])).toEqual({ stretches: [34], at, note: { text: 'Rampa instalada', language: 'es' } });
  expect(isFixed(edits, [13])).toBeNull();
  expect(isFixed(clearFixed(edits, [34]), [34])).toBeNull();
});

test('a saved record survives a round trip and a damaged one is refused', () => {
  const edits = setNote(markFixed(addSpot(empty, 21, 'steps', ownNote('Tres escalones', 'es'), at), [34], NO_NOTE, at), 'steps-130-140', ownNote('Loose stone', 'en'));
  expect(parseEdits(JSON.stringify(edits), 'cusco-qorikancha')).toEqual(edits);
  expect(() => parseEdits(JSON.stringify(edits), 'other-place')).toThrow();
  for (const damaged of [
    { ...edits, added: [{ ...edits.added[0], kind: 'lift' }] },
    { ...edits, added: [{ ...edits.added[0], stretch: -1 }] },
    { ...edits, added: [{ ...edits.added[0], note: { text: 'x', language: 'fr' } }] },
    { ...edits, added: [edits.added[0], edits.added[0]] },
    { ...edits, fixed: { 34: { stretches: [], at, note: NO_NOTE } } },
  ]) expect(() => parseEdits(JSON.stringify(damaged), 'cusco-qorikancha'), JSON.stringify(damaged.added)).toThrow();
});

test('an added spot reads like an authored one, with the landmark in every word list', () => {
  const edits = addSpot(empty, 21, 'steps', NO_NOTE, at);
  const spot = addedFeature(edits.added[0], locate);
  expect(spot.id).toBe('added-1');
  expect(spot.stretches).toEqual([21]);
  // Named by where it is, like every spot on the walk; the kind stays in the passage and the word lists.
  expect(spot.name.en).toBe('Loreto, 210 to 220 m');
  expect(spot.name.es).toBe('Loreto, 210 a 220 m');
  expect(addedFeature(addSpot(empty, 3, 'kerb', NO_NOTE, at).added[0], () => ({ from: 30, to: 40, landmark: '' })).name.en).toBe('30 to 40 m');
  expect(spot.description).toBe('Steps between 210 and 220 m of the walk, near Loreto, recorded by the tour operator.');
  expect(spot.description).not.toMatch(/wide|slope|passable|wheelchair/i);
  for (const language of ['en', 'es', 'ko']) expect(spot.aliases[language], language).toContain('Loreto');
  expect(spot.aliases.ko).toContain('계단');
});

test('her words join the passage only in a language the model knows', () => {
  expect(noteForPassage(ownNote('Three high steps at the door', 'en'))).toBe('Three high steps at the door');
  expect(noteForPassage(ownNote('Hay tres escalones altos en la puerta', 'es'))).toBe('Hay tres escalones altos en la puerta');
  expect(noteForPassage(ownNote('Kimsa patatam punkupi kashan', 'other'))).toBe('');
  expect(noteForPassage(NO_NOTE)).toBe('');
  const quechua = addedFeature(addSpot(empty, 21, 'steps', ownNote('Kimsa patatam punkupi kashan', 'other'), at).added[0], locate);
  expect(quechua.description).not.toContain('Kimsa');
  const spanish = addedFeature(addSpot(empty, 21, 'steps', ownNote('Hay tres escalones altos', 'es'), at).added[0], locate);
  expect(spanish.description).toContain('The operator wrote: “Hay tres escalones altos”.');
});

test('the merged place keeps the authored spots and their order, and changes only with her records', () => {
  const edits = addSpot(empty, 21, 'steps', NO_NOTE, at);
  const merged = withEdits(QORIKANCHA_PLACE, edits, locate);
  expect(merged.id).toBe(QORIKANCHA_PLACE.id);
  expect(merged.features.slice(0, QORIKANCHA_PLACE.features.length)).toEqual(QORIKANCHA_PLACE.features);
  expect(merged.features).toHaveLength(QORIKANCHA_PLACE.features.length + 1);
  expect(withEdits(QORIKANCHA_PLACE, empty, locate)).toBe(QORIKANCHA_PLACE);
  expect(new Set(merged.features.map(feature => feature.id)).size).toBe(merged.features.length);
});

test('a fixed spot says she recorded it, never that the way is clear', () => {
  const where = { en: 'near Loreto', es: 'cerca de Loreto', ko: '로레토' };
  expect(fixedLine('steps', where, 215.4, at, 'en')).toBe('Update, October 4, 2026: we recorded the steps near Loreto, about 215 m along the walk, as fixed.');
  expect(fixedLine('kerb', where, 95, at, 'en')).toBe('Update, October 4, 2026: we recorded the kerb near Loreto, about 95 m along the walk, as fixed.');
  expect(fixedLine('steps', where, 215, at, 'es')).toBe('Actualización, 4 de octubre de 2026: anotamos como arreglados los escalones cerca de Loreto, a unos 215 m del inicio.');
  expect(fixedLine('kerb', where, 215, at, 'es')).toContain('anotamos como arreglado el bordillo cerca de Loreto');
  // "registrar" can read as "to search a place", so the record uses "anotar".
  for (const kind of EDIT_KINDS) expect(fixedLine(kind, where, 215, at, 'es'), kind).not.toContain('registramos');
  expect(fixedLine('steps', where, 215, at, 'ko')).toBe('업데이트 (2026년 10월 4일): 출발점에서 약 215m, 로레토 근처 계단을 수리 완료로 기록했습니다.');
  // Inside the first 10 m the line names the start of the walk, as the route note does, never "about 0 m".
  expect(fixedLine('steps', where, 4, at, 'en')).toBe('Update, October 4, 2026: we recorded the steps near Loreto, at the start of the walk, as fixed.');
  expect(fixedLine('steps', where, 4, at, 'es')).toBe('Actualización, 4 de octubre de 2026: anotamos como arreglados los escalones cerca de Loreto, al inicio del recorrido.');
  expect(fixedLine('steps', where, 4, at, 'ko')).toBe('업데이트 (2026년 10월 4일): 출발점, 로레토 근처 계단을 수리 완료로 기록했습니다.');
  for (const language of ['en', 'es', 'ko'] as const) expect(fixedLine('kerb', where, 0, at, language), language).not.toMatch(/\b0 m|0m/);
  // Every kind keeps its Korean object particle, and no line claims the way is clear.
  for (const kind of EDIT_KINDS) {
    expect(fixedLine(kind, where, 215, at, 'ko'), kind).not.toContain('은(는)');
    expect(fixedLine(kind, where, 215, at, 'ko'), kind).toMatch(/(을|를) 수리 완료로 기록했습니다\.$/);
    for (const language of ['en', 'es', 'ko'] as const) {
      expect(fixedLine(kind, where, 215, at, language), kind).not.toMatch(/we fixed|arreglamos|passable|accessible|safe|지나갈 수 있|안전/i);
    }
  }
});

test('her words reach only the note written in their own language', () => {
  const note = ownNote('Hay una rampa nueva', 'es');
  expect(ownNoteLines(note, 'es')).toEqual(['Hay una rampa nueva']);
  expect(ownNoteLines(note, 'en')).toEqual([]);
  expect(ownNoteLines(note, 'ko')).toEqual([]);
  expect(ownNoteLines(ownNote('Kimsa patatam', 'other'), 'en')).toEqual([]);
});

test('a note guessed as a language the visitor notes do not use is taken as another language, never English', () => {
  for (const language of ['en', 'es', 'ko', 'other'] as const) expect(noteLangOf(language)).toBe(language);
  expect(noteLangOf('qu')).toBe('other');
  expect(noteLangOf('fr')).toBe('other');
  const quechua = 'Manam kanchu allin ñan, rumikuna hatun kan';
  expect(guessLanguage(quechua)).toBe('qu');
  expect(noteLangOf(guessLanguage(quechua))).toBe('other');
  expect(ownNoteLines(ownNote(quechua, noteLangOf(guessLanguage(quechua))), 'en')).toEqual([]);
});
