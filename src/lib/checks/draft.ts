import type { Finding } from "../types";
export function draftCheck(f: Finding) {
  if (f.method !== "GET" || f.service !== "HTTP") return null;
  const path =
    f.address?.startsWith("/") && !f.address.startsWith("//") ? f.address : "";
  return {
    label: ("GET " + (f.address ?? f.operation)).slice(0, 100),
    url:
      f.resolution === "resolved" && f.address?.startsWith("https://")
        ? f.address
        : "",
    path,
  };
}
export function resolveCheckAddress(path: string, base: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return "";
  try {
    const url = new URL(base);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.port && url.port !== "443")
    )
      return "";
    return new URL(path, url.origin).toString();
  } catch {
    return "";
  }
}
