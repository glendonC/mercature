/** One line icon set on a 24px grid with a 1.5 stroke; Outfit has no reliable symbol glyphs. */
type IconProps = { className?: string };
const base = { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true } as const;

export function SearchIcon({ className }: IconProps) {
  return <svg {...base} className={className}><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>;
}
export function UploadIcon({ className }: IconProps) {
  return <svg {...base} className={className}><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg>;
}
export function InfoIcon({ className }: IconProps) {
  return <svg {...base} className={className}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>;
}
/** An authored scene: a box standing on a plane. */
export function SceneIcon({ className }: IconProps) {
  return <svg {...base} className={className}><path d="m3 15 9 4.5 9-4.5-9-4.5z"/><path d="m9 9.5 3-1.5 3 1.5v4L12 15l-3-1.5z"/><path d="M12 11v4M9 9.5l3 1.5 3-1.5"/></svg>;
}
export function ExternalIcon({ className }: IconProps) {
  return <svg {...base} className={className}><path d="M9 6h9v9M18 6 6 18"/></svg>;
}
/** The destination a tour route leads to. */
export function TargetIcon({ className }: IconProps) {
  return <svg {...base} className={className}><path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/><circle cx="12" cy="12" r="2"/></svg>;
}
export function CloseIcon({ className }: IconProps) {
  return <svg {...base} className={className}><path d="M6 6l12 12M18 6 6 18"/></svg>;
}
export function BackIcon({ className }: IconProps) {
  return <svg {...base} className={className}><path d="M15 5l-7 7 7 7"/></svg>;
}
