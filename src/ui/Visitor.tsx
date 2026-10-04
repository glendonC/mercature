import { BotAvatar, botAvatarTypes, type BotAvatarType } from 'bot-avatars';

/*
 * Visitors each get their own bot, so a list of messages reads as different people from different places.
 * The look (a shape and a muted colour) comes from the message's id alone, so a visitor keeps the same face on every screen and every visit.
 * The guide's grey blob is never used for a visitor.
 */
const VISITOR_TYPES: readonly BotAvatarType[] = botAvatarTypes.filter(type => type !== 'blob');
/** Muted hues that sit on charcoal and mean nothing on the map: no blue (the way), no clay or red (a possible barrier), no mid grey (the guide, unknown). */
const VISITOR_COLOURS = ['#a9bba3', '#b9adcf', '#cdbd97', '#c9a7b2', '#97b8b2', '#d3c895', '#c4b3d6', '#aab68f', '#d2b7a0', '#a4bcc4'] as const;

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** The look a visitor's message id gives: one of the library's shapes in its own colour, and a seed for its blinks. */
export function visitorLook(id: string): { type: BotAvatarType; color: string; seed: number } {
  const h = hash(id), g = hash(`${id}:colour`);
  return { type: VISITOR_TYPES[h % VISITOR_TYPES.length], color: VISITOR_COLOURS[g % VISITOR_COLOURS.length], seed: ((h >>> 8) % 1000) / 1000 };
}

/**
 * A visitor's avatar: about 28 px in a message row, still; about 40 px in the message view, idle (it looks around and blinks).
 * Its colours are muted to sit on charcoal.
 */
export function VisitorAvatar({ id, size = 28, still, className }: { id: string; size?: number; still?: boolean; className?: string }) {
  const { type, color, seed } = visitorLook(id);
  return <span className={className ? `ui-visitor ${className}` : 'ui-visitor'} aria-hidden="true">
    <BotAvatar type={type} color={color} seed={seed} size={size} paused={still} state="default" saturation={1} shading="plastic" jumpEvery={0} interactive={false} theme="dark" speed={0.4} turn={0.2} />
  </span>;
}
