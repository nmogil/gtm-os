export function redactApiKey(key: string): string {
  if (!key || key.length < 8) return "***";
  return "..." + key.slice(-4);
}
