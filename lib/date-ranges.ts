export type DateRange = { start: string; end: string };

export function subtractDateRanges(range: DateRange, covered: DateRange[]) {
  let fragments = [range];
  for (const cover of covered.sort((a, b) => a.start.localeCompare(b.start))) {
    fragments = fragments.flatMap((fragment) => {
      if (cover.end <= fragment.start || cover.start >= fragment.end) return [fragment];
      const next: DateRange[] = [];
      if (cover.start > fragment.start) next.push({ start: fragment.start, end: cover.start });
      if (cover.end < fragment.end) next.push({ start: cover.end, end: fragment.end });
      return next;
    });
  }
  return fragments.filter((fragment) => fragment.start < fragment.end);
}
