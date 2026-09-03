export function setIndexedValue(
  current: string[],
  index: number,
  value: string,
): string[] {
  const next = current.slice();
  while (next.length <= index) {
    next.push("");
  }
  next[index] = value;
  return next;
}
