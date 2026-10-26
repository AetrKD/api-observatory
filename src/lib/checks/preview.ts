import { redactExpression } from "../redact";
export type ResponsePreview = {
  body: string;
  format: "json" | "text" | "binary";
  contentType: string | null;
  truncated: boolean;
};
const sensitive =
  /password|passwd|secret|token|authorization|api.?key|cookie|session|credential|private.?key|signature/i;
const hidden = "[비공개]";
function mask(text: string, secrets: string[]) {
  for (const secret of secrets)
    if (secret) text = text.split(secret).join(hidden);
  return redactExpression(text)
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer " + hidden)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, hidden)
    .replace(
      /\bsk-[A-Za-z0-9_-]{12,}|\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]+/g,
      hidden,
    )
    .replace(
      /(["']?\b(?:[\w-]{0,60}(?:password|passwd|secret|token|authorization|api[_-]?key|cookie|session|credential|signature)[\w-]{0,60})["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;&<>]+)/gi,
      (_match, key: string) => key + hidden,
    );
}
export function responsePreview(
  text: string,
  contentType: string | null = null,
  secrets: string[] = [],
): ResponsePreview {
  const type = contentType ? mask(contentType, secrets).slice(0, 200) : null;
  if (
    type &&
    !/^(?:text\/|application\/(?:[\w.+-]*json|[\w.+-]*xml|javascript|x-www-form-urlencoded))(?:\b|;)/i.test(
      type,
    )
  )
    return { body: "", format: "binary", contentType: type, truncated: false };
  let body = text,
    format: ResponsePreview["format"] = "text";
  try {
    const input: unknown = JSON.parse(text);
    function clean(value: unknown, depth = 0): unknown {
      if (depth > 20) return "[생략]";
      if (Array.isArray(value)) return value.map((x) => clean(x, depth + 1));
      if (value && typeof value === "object")
        return Object.fromEntries(
          Object.entries(value).map(([key, value]) => [
            mask(key, secrets),
            sensitive.test(key) ? hidden : clean(value, depth + 1),
          ]),
        );
      return typeof value === "string" ? mask(value, secrets) : value;
    }
    body = JSON.stringify(clean(input), null, 2);
    format = "json";
  } catch {
    body = mask(text, secrets);
  }
  const max = 16 * 1024,
    truncated = Buffer.byteLength(body, "utf8") > max;
  if (truncated) {
    const bytes = Buffer.from(body, "utf8");
    let end = max;
    while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--;
    body = bytes.subarray(0, end).toString("utf8");
  }
  return { body, format, contentType: type, truncated };
}
