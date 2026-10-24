import { parseJson } from '../utils/bytes';
import { KEEP_REMOVALS_MS } from './removals';
import type { LibraryKind, TitleRule } from './sqlLibrary';

/**
 * The account's splits and merges (issue #243) with when each was made or undone (issue #267, DECISIONS.md#d-223):
 * kept beside the library database so pairing, automatic sync and backups carry them like My List. The database's
 * `title_rules` stay what the grouping reads; this record is what devices exchange. A rule undone stays as `removed`
 * for `KEEP_REMOVALS_MS`, so it does not come back from a device that still has it.
 */
export interface RecordedRule extends TitleRule {
  kind: LibraryKind;
  /** ISO time it was made, or undone. */
  at: string;
  removed?: boolean;
}

export const titleRulesKey = (accountId: string) => `direct.titleRules.${accountId}`;

const ruleId = (rule: Pick<RecordedRule, 'kind' | 'rule' | 'src'>) => `${rule.kind}|${rule.rule}|${rule.src}`;

export function readTitleRules(text: string | null | undefined): RecordedRule[] {
  const value = parseJson<unknown>(text ?? null);
  if (!Array.isArray(value)) return [];
  return value.filter(
    (rule): rule is RecordedRule =>
      !!rule &&
      typeof rule === 'object' &&
      ((rule as RecordedRule).kind === 'movie' || (rule as RecordedRule).kind === 'series') &&
      ((rule as RecordedRule).rule === 'split' || (rule as RecordedRule).rule === 'merge') &&
      typeof (rule as RecordedRule).src === 'string' &&
      typeof (rule as RecordedRule).dst === 'string' &&
      typeof (rule as RecordedRule).at === 'string',
  );
}

const pruned = (rules: RecordedRule[], now: Date) => {
  const oldest = new Date(now.getTime() - KEEP_REMOVALS_MS).toISOString();
  return rules.filter((rule) => !rule.removed || rule.at >= oldest).sort((a, b) => (ruleId(a) < ruleId(b) ? -1 : 1));
};

/**
 * The record after the device's rules of `kind` became `current` (a split, merge or undo here): new or changed rules
 * are dated `now`, rules no longer there are marked removed.
 */
export function recordRules(
  record: readonly RecordedRule[],
  kind: LibraryKind,
  current: readonly TitleRule[],
  now = new Date(),
): RecordedRule[] {
  const at = now.toISOString();
  const byId = new Map(record.map((rule) => [ruleId(rule), rule]));
  const wanted = new Set<string>();
  for (const rule of current) {
    const id = ruleId({ ...rule, kind });
    wanted.add(id);
    const known = byId.get(id);
    if (!known || known.removed || known.dst !== rule.dst) byId.set(id, { kind, rule: rule.rule, src: rule.src, dst: rule.dst, at });
  }
  for (const [id, rule] of byId) if (rule.kind === kind && !rule.removed && !wanted.has(id)) byId.set(id, { ...rule, removed: true, at });
  return pruned([...byId.values()], now);
}

/** Both devices' records: per rule, the latest change wins (on a tie, `a`'s). */
export function mergeTitleRules(a: readonly RecordedRule[], b: readonly RecordedRule[], now = new Date()): RecordedRule[] {
  const byId = new Map(a.map((rule) => [ruleId(rule), rule]));
  for (const rule of b) {
    const known = byId.get(ruleId(rule));
    if (!known || rule.at > known.at) byId.set(ruleId(rule), rule);
  }
  return pruned([...byId.values()], now);
}

/**
 * The rules of `kind` the database should hold, in its order (rule, then src). Merges are applied oldest first the way
 * a device makes them (`changeRules`), so two devices' merges never chain or loop: a merge into a title merged
 * elsewhere goes to where that one went, and the titles merged into one that moves move along.
 */
export function liveRules(record: readonly RecordedRule[], kind: LibraryKind): TitleRule[] {
  const live = record.filter((rule) => rule.kind === kind && !rule.removed);
  const merges = new Map<string, string>();
  for (const rule of live.filter((r) => r.rule === 'merge').sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0))) {
    let dst = rule.dst;
    for (let hops = 0; merges.has(dst) && hops <= merges.size; hops++) dst = merges.get(dst)!;
    if (dst === rule.src) continue;
    for (const [src, to] of merges) if (to === rule.src) merges.set(src, dst);
    merges.set(rule.src, dst);
  }
  const rules: TitleRule[] = [
    ...[...merges].map(([src, dst]): TitleRule => ({ rule: 'merge', src, dst })),
    ...live.filter((rule) => rule.rule === 'split').map(({ src }): TitleRule => ({ rule: 'split', src, dst: '' })),
  ];
  return rules.sort((x, y) => (x.rule !== y.rule ? (x.rule < y.rule ? -1 : 1) : x.src < y.src ? -1 : x.src > y.src ? 1 : 0));
}
