/** Message limits and normalization shared with understand(), and the exact-alias baseline the model is compared against. */
export interface FeatureRecord {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly aliases?: readonly string[];
}

export interface FeatureSuggestion {
  readonly id: string;
  /** Similarity or exact alias match, never a calibrated probability. */
  readonly score: number;
}

export const LANGUAGE_LIMITS = Object.freeze({
  messageCodePoints: 500,
  inventoryEntries: 32,
  labelCodePoints: 200,
  descriptionCodePoints: 800,
  aliasesPerFeature: 16,
  aliasCodePoints: 80,
});

const count = (text: string) => Array.from(text).length;
const forbiddenControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

/** Used only for comparison; callers retain the original message unchanged. */
export function normalizeLanguageText(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase('en').replace(/\s+/gu, ' ').trim();
}

function validText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && count(value) <= maximum &&
    !forbiddenControls.test(value) && normalizeLanguageText(value).length > 0;
}

function validateInventory(inventory: readonly FeatureRecord[]): string | null {
  if (!Array.isArray(inventory) || inventory.length < 1 || inventory.length > LANGUAGE_LIMITS.inventoryEntries) {
    return 'Choose a site with between 1 and 32 known features.';
  }
  const seen = new Set<string>();
  for (const item of inventory) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' ||
        !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/u.test(item.id) || seen.has(item.id)) {
      return 'The feature inventory has an invalid or repeated identifier.';
    }
    seen.add(item.id);
    if (!validText(item.label, LANGUAGE_LIMITS.labelCodePoints) ||
        (item.description !== undefined && !validText(item.description, LANGUAGE_LIMITS.descriptionCodePoints))) {
      return 'A known feature has an invalid description.';
    }
    if (item.aliases !== undefined && (!Array.isArray(item.aliases) ||
        item.aliases.length > LANGUAGE_LIMITS.aliasesPerFeature ||
        item.aliases.some((alias: unknown) => !validText(alias, LANGUAGE_LIMITS.aliasCodePoints)))) {
      return 'A known feature has invalid search aliases.';
    }
  }
  return null;
}

function validateInput(message: string, inventory: readonly FeatureRecord[]): string | null {
  if (!validText(message, LANGUAGE_LIMITS.messageCodePoints)) {
    return 'Enter a concern of 1 to 500 characters without control characters.';
  }
  return validateInventory(inventory);
}

/** Lexical comparison for evaluation or explicitly labeled search. It does not interpret a concern. */
export function aliasBaseline(message: string, inventory: readonly FeatureRecord[]): {
  status: 'baseline' | 'invalid'; method: 'exact-alias'; suggestions: readonly FeatureSuggestion[]; reason?: string;
} {
  const reason = validateInput(message, inventory);
  if (reason) return { status: 'invalid', method: 'exact-alias', suggestions: [], reason };
  const text = normalizeLanguageText(message);
  const suggestions = inventory.filter(item => [item.label, ...(item.aliases ?? [])].some(value => {
    const alias = normalizeLanguageText(value);
    // Latin aliases match whole words; Korean particles may attach directly to the noun.
    if (/^[\p{Script=Latin}\p{N}\s'-]+$/u.test(alias)) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, 'u').test(text);
    }
    return text.includes(alias);
  })).map(item => ({ id: item.id, score: 1 }));
  return { status: 'baseline', method: 'exact-alias', suggestions };
}
