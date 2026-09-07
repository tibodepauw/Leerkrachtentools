export function normalizeEmail(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}
