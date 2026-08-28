export function parseSenderAddress(value: string) {
  const trimmed = value.trim();
  const named = /^(.+?)\s*<([^>]+)>$/u.exec(trimmed);
  if (named) {
    return { name: named[1].trim(), email: named[2].trim() };
  }
  return { name: "Leerkrachtentools", email: trimmed };
}
