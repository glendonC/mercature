import { Fragment, createElement, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { en, type Key } from './en';
import { es } from './es';

export type { Key } from './en';
export type Lang = 'en' | 'es';
export const LANGS: readonly Lang[] = ['en', 'es'];
/** Each language named in itself, for the switch and for screen readers. */
export const LANG_NAMES: Readonly<Record<Lang, string>> = { en: 'English', es: 'Español' };
/** Number and date formats: neutral Latin American Spanish. */
export const LOCALES: Readonly<Record<Lang, string>> = { en: 'en', es: 'es-419' };

/** Spanish may lag behind English: a key it lacks shows the English text. */
const dictionaries: Readonly<Record<Lang, Readonly<Partial<Record<Key, string>>>>> = { en, es };
export const STORAGE_KEY = 'mercature.language.v1';

/** The {name} placeholders in a template. */
type Params<S extends string> = S extends `${string}{${infer P}}${infer Rest}` ? P | Params<Rest> : never;
export type Values<K extends Key> = Record<Params<(typeof en)[K]>, string | number>;
/** Keys without placeholders take no values; keys with placeholders require all of them. */
export type Args<K extends Key> = [Params<(typeof en)[K]>] extends [never] ? [] : [values: Values<K>];

/** Every Spanish string keeps exactly the placeholders of its English one. */
type Mismatch<K extends string> = `Placeholders differ from en.ts for "${K}"`;
type Same<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;
type SamePlaceholders<D extends Partial<Record<Key, string>>> = {
  [K in keyof D]: K extends Key ? D[K] extends string ? Same<Params<D[K]>, Params<(typeof en)[K]>> extends true ? D[K] : Mismatch<K> : D[K] : never;
};
const checked: SamePlaceholders<typeof es> = es;
void checked;

function stored(): Lang {
  try { return localStorage.getItem(STORAGE_KEY) === 'es' ? 'es' : 'en'; } catch { return 'en'; }
}

let current: Lang = stored();
const listeners = new Set<() => void>();
const mark = () => { if (typeof document !== 'undefined') document.documentElement.lang = current; };
mark();

export function getLang(): Lang { return current; }

/** Applies everywhere at once and is remembered on this device. English is the default. */
export function setLang(next: Lang) {
  if (next === current) return;
  current = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* The choice still applies until the page closes. */ }
  mark();
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const lookup = (lang: Lang, key: Key): string => dictionaries[lang][key] ?? en[key];

function fill(template: string, values?: Record<string, unknown>): string {
  return values ? template.replace(/\{(\w+)\}/g, (match, name: string) => name in values ? String(values[name]) : match) : template;
}

/** A string in the given language. Outside components, pass getLang(). */
export function translate<K extends Key>(lang: Lang, key: K, ...[values]: Args<K>): string {
  return fill(lookup(lang, key), values);
}

/** Like translate, but placeholders may hold elements, for example a bold count. */
export function translateRich<K extends Key>(lang: Lang, key: K, values: Record<Params<(typeof en)[K]>, ReactNode>): ReactNode {
  const parts = lookup(lang, key).split(/\{(\w+)\}/);
  return createElement(Fragment, null, ...parts.map((part, i) => i % 2 ? (values as Record<string, ReactNode>)[part] : part));
}

/** The current language and its strings. Components that call it re-render when the language changes. */
export function useLanguage() {
  const lang = useSyncExternalStore(subscribe, getLang, () => 'en' as Lang);
  return useMemo(() => ({
    lang,
    setLang,
    locale: LOCALES[lang],
    t: <K extends Key>(key: K, ...values: Args<K>) => translate(lang, key, ...values),
    rich: <K extends Key>(key: K, values: Record<Params<(typeof en)[K]>, ReactNode>) => translateRich(lang, key, values),
  }), [lang]);
}
