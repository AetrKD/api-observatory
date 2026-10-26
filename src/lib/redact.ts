const sensitive =
  /(?:key|secret|token|password|credential|signature|authorization|auth)/i;
export function redactUrl(input: string): string {
  try {
    const url = new URL(input);
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()])
      if (sensitive.test(key)) url.searchParams.set(key, "[비공개]");
    url.hash = "";
    return url.toString();
  } catch {
    const clean = input.split("#")[0],
      index = clean.indexOf("?");
    if (index < 0) return clean;
    const params = new URLSearchParams(clean.slice(index + 1));
    for (const key of [...params.keys()])
      if (sensitive.test(key)) params.set(key, "[비공개]");
    return clean.slice(0, index) + "?" + params.toString();
  }
}
export function redactExpression(value: string): string {
  return value
    .replace(/https?:\/\/[^\s"'`]+/g, redactUrl)
    .replace(/\b(?:sk|pk)_(?:live|test)_[\w-]+|\bsk-[\w-]{12,}/g, "[비공개]");
}
