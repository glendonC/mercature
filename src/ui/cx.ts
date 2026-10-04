export type Tone = 'light' | 'dark';

export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');
