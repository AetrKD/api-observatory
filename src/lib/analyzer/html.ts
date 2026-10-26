import { parse, type DefaultTreeAdapterTypes } from "parse5";
import type { SourceFile } from "../types";
const pad = (value: string) => value.replace(/[^\r\n]/g, " ");
/** Remove template syntax for parsing only; every UTF-16 offset and newline stays in place. */
export function maskHtmlTemplate(code: string) {
  const fill = (tag: string, replacement: string) => {
    let i = 0;
    return pad(tag).replace(/ /g, () => replacement[i++] ?? " ");
  };
  return code.replace(
    /\{#[\s\S]*?#\}|\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/g,
    (tag) => {
      if (tag.startsWith("{#")) return pad(tag);
      if (tag.startsWith("{{")) return fill(tag, "$J$");
      const word = /^\{%-?\s*(\w+)/.exec(tag)?.[1];
      return fill(
        tag,
        word === "if" || word === "for"
          ? "{"
          : word === "else" || word === "elif"
            ? "}{"
            : word === "endif" || word === "endfor"
              ? "}"
              : "",
      );
    },
  );
}
export function htmlScripts(source: SourceFile): SourceFile[] {
  const document = parse(source.content, { sourceCodeLocationInfo: true }),
    scripts: SourceFile[] = [];
  const queue: DefaultTreeAdapterTypes.Node[] = [document];
  while (queue.length) {
    const node = queue.pop()!;
    if ("tagName" in node && node.tagName === "script") {
      const type =
        node.attrs
          .find((a) => a.name === "type")
          ?.value.trim()
          .toLowerCase()
          .split(";")[0] ?? "";
      if (
        node.attrs.some((a) => a.name === "src") ||
        ![
          "",
          "module",
          "text/javascript",
          "application/javascript",
          "text/ecmascript",
          "application/ecmascript",
        ].includes(type)
      )
        continue;
      const start = node.sourceCodeLocation?.startTag?.endOffset,
        end =
          node.sourceCodeLocation?.endTag?.startOffset ?? source.content.length;
      if (start === undefined) continue;
      scripts.push({
        path: source.path + "#html-script-" + scripts.length,
        templateRanges: [
          ...source.content
            .slice(start, end)
            .matchAll(/\{#[\s\S]*?#\}|\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}/g),
        ].map((m) => ({
          start: start + m.index!,
          end: start + m.index! + m[0].length,
        })),
        content:
          pad(source.content.slice(0, start)) +
          maskHtmlTemplate(source.content.slice(start, end)),
      });
    } else if ("childNodes" in node)
      queue.push(...[...node.childNodes].reverse());
  }
  return scripts;
}
