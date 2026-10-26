import { english } from "./translations";
export type Language = "ko" | "en";
export function translate(text: string, language: Language) {
  if (language === "ko" || !/[가-힣]/.test(text)) return text;
  const key = text.replace(/\s+/g, " ").trim();
  if (Object.hasOwn(english, key)) return english[key];
  let output = key;
  for (const source of Object.keys(english)
    .filter((k) => k.length > 2)
    .sort((a, b) => b.length - a.length))
    output = output.replaceAll(source, english[source]);
  return output;
}
