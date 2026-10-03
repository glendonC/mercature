import type { Profile, Scene, Vec2 } from '../spatial/contracts';

/** Interface languages with authored site text. */
export type UiLanguage = 'es' | 'en';

/** The only message kinds the understanding model may report. */
export const MESSAGE_KINDS = ['problem', 'praise', 'question'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

/** The only issue types the understanding model may report for a problem. */
export const ISSUE_CATEGORIES = ['path-blocked', 'steps-or-slope', 'seating-or-shade', 'signs-or-language', 'facilities', 'other'] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

/** A named part of the site. Its id is also the id of exactly one feature in the site's scene. */
export type SiteFeature = {
  readonly id: string;
  readonly name: Readonly<Record<UiLanguage, string>>;
  /** One plain English sentence describing the feature, used as the matching passage. */
  readonly description: string;
  /** Other words visitors may use, keyed by BCP 47 language code. */
  readonly aliases: Readonly<Record<string, readonly string[]>>;
};

/** An authored spot where a movable feature may be placed; the solver still checks the result. */
export type Placement = {
  readonly featureId: string;
  readonly to: Vec2;
  readonly name: Readonly<Record<UiLanguage, string>>;
};

export type Site = {
  readonly id: string;
  readonly name: Readonly<Record<UiLanguage, string>>;
  readonly place: string;
  readonly provenance: 'synthetic';
  readonly scene: Scene;
  readonly profile: Profile;
  readonly features: readonly SiteFeature[];
  readonly placements: readonly Placement[];
};
