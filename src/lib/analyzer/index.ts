import { parse as parseVue } from "@vue/compiler-sfc";
import { analyzeJavaScript } from "./javascript";
import { htmlScripts } from "./html";
import { analyzePython } from "./python";
import type { Finding, SourceFile } from "../types";
export function analyzeSources(sources: SourceFile[]) {
  const scripts: SourceFile[] = [],
    origins = new Map<string, string>(),
    findings: Finding[] = [],
    errors = new Set<string>(),
    warnings = new Set<string>();
  for (const source of sources) {
    if (/\.html?$/.test(source.path)) {
      warnings.add(
        "HTML의 인라인 JavaScript와 Jinja 조건 블록을 분석합니다. 템플릿은 실행하지 않으며 외부 script·이벤트 속성·블록 간 값 추적은 제외합니다.",
      );
      try {
        for (const script of htmlScripts(source)) {
          scripts.push(script);
          origins.set(script.path, source.path);
        }
      } catch {
        errors.add(source.path);
      }
    } else if (source.path.endsWith(".py")) {
      const result = analyzePython(source);
      findings.push(...result.findings);
      for (const e of result.parseErrors) errors.add(e);
      warnings.add(
        "Python은 requests·httpx·urllib의 지원 호출을 분석합니다. 다른 SDK와 파일 간 값 추적은 지원하지 않습니다.",
      );
    } else if (source.path.endsWith(".vue")) {
      warnings.add(
        "Vue는 script·script setup의 JavaScript·TypeScript를 분석합니다. 템플릿·스타일과 블록 간 값 추적은 지원하지 않습니다.",
      );
      try {
        const result = parseVue(source.content, { filename: source.path });
        if (result.errors.length) {
          errors.add(source.path);
          continue;
        }
        const blocks = [
          result.descriptor.script,
          result.descriptor.scriptSetup,
        ].filter((x) => x !== null);
        for (const [i, block] of blocks.entries()) {
          if (block.src) {
            warnings.add(
              "Vue의 외부 script src는 인라인으로 읽지 않습니다. 지원하는 소스 파일은 별도로 분석합니다.",
            );
            continue;
          }
          if (
            block.lang &&
            !["js", "ts", "jsx", "tsx", "javascript", "typescript"].includes(
              block.lang,
            )
          ) {
            errors.add(source.path);
            continue;
          }
          const virtual = i === 0 ? source.path : source.path + "#script-setup";
          origins.set(virtual, source.path);
          scripts.push({
            path: virtual,
            content:
              source.content
                .slice(0, block.loc.start.offset)
                .replace(/[^\r\n]/g, " ") + block.content,
          });
        }
      } catch {
        errors.add(source.path);
      }
    } else scripts.push(source);
  }
  const js = analyzeJavaScript(scripts);
  for (const file of js.parseErrors) errors.add(origins.get(file) ?? file);
  for (const f of js.findings) {
    const original = origins.get(f.file);
    findings.push(
      original
        ? {
            ...f,
            file: original,
            evidence: f.evidence.replace(f.file + ":", original + ":"),
          }
        : f,
    );
  }
  findings.sort(
    (a, b) =>
      a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
  );
  return {
    findings,
    parseErrors: [...errors],
    filesScanned: sources.length - errors.size,
    warnings: [...warnings],
  };
}
