import { parse } from "@babel/parser";
import traverseModule, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Finding, SourceFile } from "../types";
import { redactUrl, redactExpression } from "../redact";
const traverse =
  typeof traverseModule === "function"
    ? traverseModule
    : (traverseModule as unknown as { default: typeof traverseModule }).default;
type P = NodePath;
type Unit = {
  source: SourceFile;
  ast: ReturnType<typeof parse>;
  imports: Map<string, { source: string; imported: string }>;
  exports: Map<string, P>;
};
type Client = { service: string; base?: string; members: string[] };
const packages: Record<string, string> = {
  axios: "axios",
  openai: "OpenAI",
  "@supabase/supabase-js": "Supabase",
  stripe: "Stripe",
};
function name(n: t.Node | null | undefined): string | undefined {
  return t.isIdentifier(n)
    ? n.name
    : t.isStringLiteral(n)
      ? n.value
      : undefined;
}
function prop(p: P | undefined, key: string): P | undefined {
  if (!p?.isObjectExpression()) return;
  for (const item of p.get("properties") as P[])
    if (item.isObjectProperty() && name(item.node.key) === key)
      return item.get("value") as P;
}
function safeExpression(node: t.Node): string {
  if (t.isIdentifier(node)) return node.name;
  if (t.isStringLiteral(node)) return '"[문자열]"';
  if (t.isMemberExpression(node))
    return (
      safeExpression(node.object) +
      "." +
      (node.computed ? "[동적 키]" : (name(node.property) ?? "?"))
    );
  if (t.isBinaryExpression(node))
    return (
      safeExpression(node.left) +
      " " +
      node.operator +
      " " +
      safeExpression(node.right)
    );
  if (t.isTemplateLiteral(node))
    return (
      "[템플릿 문자열] " +
      node.expressions
        .map((x) => (t.isExpression(x) ? safeExpression(x) : "?"))
        .join(" + ")
    );
  if (t.isCallExpression(node))
    return safeExpression(node.callee) + "([인수 비공개])";
  return "[동적 표현식]";
}
export function analyzeJavaScript(sources: SourceFile[]) {
  const units = new Map<string, Unit>(),
    errors: string[] = [],
    findings: Finding[] = [];
  for (const source of sources) {
    try {
      const ast = parse(source.content, {
        sourceType: "unambiguous",
        plugins: ["typescript", "jsx"],
      });
      const unit: Unit = {
        source,
        ast,
        imports: new Map(),
        exports: new Map(),
      };
      traverse(ast, {
        ImportDeclaration(p) {
          for (const s of p.node.specifiers)
            unit.imports.set(s.local.name, {
              source: p.node.source.value,
              imported: t.isImportSpecifier(s)
                ? name(s.imported)!
                : t.isImportDefaultSpecifier(s)
                  ? "default"
                  : "*",
            });
        },
        ExportNamedDeclaration(p) {
          const d = p.get("declaration") as P;
          if (d?.isVariableDeclaration())
            for (const item of d.get("declarations") as P[]) {
              const n = item.node as t.VariableDeclarator;
              if (t.isIdentifier(n.id))
                unit.exports.set(n.id.name, item.get("init") as P);
            }
          for (const spec of p.get("specifiers") as P[])
            if (spec.isExportSpecifier()) {
              const b = p.scope.getBinding(spec.node.local.name);
              if (b?.path.isVariableDeclarator())
                unit.exports.set(
                  name(spec.node.exported)!,
                  b.path.get("init") as P,
                );
            }
        },
        ExportDefaultDeclaration(p) {
          unit.exports.set("default", p.get("declaration") as P);
        },
      });
      units.set(source.path, unit);
    } catch {
      errors.push(source.path);
    }
  }
  function local(from: Unit, source: string) {
    if (!source.startsWith(".")) return;
    const base = path.posix.normalize(
      path.posix.join(path.posix.dirname(from.source.path), source),
    );
    for (const candidate of [
      base,
      ...[
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mjs",
        ".cjs",
        ".mts",
        ".cts",
        ".vue",
      ].map((x) => base + x),
      ...[".ts", ".js", ".tsx", ".jsx"].map((x) => base + "/index" + x),
    ])
      if (units.has(candidate)) return units.get(candidate);
  }
  function bound(p: P, unit: Unit): { value: P; unit: Unit } | undefined {
    if (!p.isIdentifier()) return;
    const b = p.scope.getBinding(p.node.name);
    if (!b || !b.constant) return;
    if (b.path.isVariableDeclarator() && t.isIdentifier(b.path.node.id)) {
      const init = b.path.get("init") as P;
      if (init?.node) return { value: init, unit };
    }
    if (b.path.isImportSpecifier() || b.path.isImportDefaultSpecifier()) {
      const imp = unit.imports.get(p.node.name);
      const target = imp && local(unit, imp.source);
      const v = target?.exports.get(imp!.imported);
      if (v) return { value: v, unit: target! };
    }
  }
  function value(
    p: P | undefined,
    unit: Unit,
    depth = 0,
    seen = new Set<t.Node>(),
  ): string | undefined {
    if (!p?.node || depth > 5 || seen.has(p.node)) return;
    if (
      unit.source.templateRanges?.some(
        (r) => r.start < (p.node.end ?? 0) && r.end > (p.node.start ?? 0),
      )
    )
      return;
    const next = new Set(seen).add(p.node);
    if (p.isStringLiteral()) return p.node.value;
    if (p.isIdentifier()) {
      const b = bound(p, unit);
      return b ? value(b.value, b.unit, depth + 1, next) : undefined;
    }
    if (
      p.isTSAsExpression() ||
      p.isTSNonNullExpression() ||
      p.isParenthesizedExpression()
    )
      return value(p.get("expression") as P, unit, depth + 1, next);
    if (p.isBinaryExpression({ operator: "+" })) {
      const l = value(p.get("left") as P, unit, depth + 1, next),
        r = value(p.get("right") as P, unit, depth + 1, next);
      if (l !== undefined && r !== undefined) return l + r;
    }
    if (p.isTemplateLiteral()) {
      let out = p.node.quasis[0].value.cooked ?? "";
      const exp = p.get("expressions") as P[];
      for (let i = 0; i < exp.length; i++) {
        const v = value(exp[i], unit, depth + 1, next);
        if (v === undefined) return;
        out += v + (p.node.quasis[i + 1].value.cooked ?? "");
      }
      return out;
    }
  }
  function imported(
    p: P,
    unit: Unit,
  ): { pkg: string; imported: string } | undefined {
    if (!p.isIdentifier()) return;
    const b = p.scope.getBinding(p.node.name);
    if (!b) return;
    if (
      b.path.isImportSpecifier() ||
      b.path.isImportDefaultSpecifier() ||
      b.path.isImportNamespaceSpecifier()
    ) {
      const imp = unit.imports.get(p.node.name);
      if (imp && packages[imp.source])
        return { pkg: imp.source, imported: imp.imported };
    }
    if (b.constant && b.path.isVariableDeclarator()) {
      const init = b.path.get("init") as P;
      if (
        init.isCallExpression() &&
        t.isIdentifier(init.node.callee, { name: "require" }) &&
        !init.scope.getBinding("require") &&
        t.isStringLiteral(init.node.arguments[0])
      ) {
        const pkg = init.node.arguments[0].value;
        if (!packages[pkg]) return;
        const id = b.path.node.id;
        if (t.isIdentifier(id)) return { pkg, imported: "default" };
        if (t.isObjectPattern(id))
          for (const item of id.properties)
            if (
              t.isObjectProperty(item) &&
              t.isIdentifier(item.value, { name: p.node.name })
            )
              return { pkg, imported: name(item.key)! };
      }
    }
  }
  function client(p: P, unit: Unit, depth = 0): Client | undefined {
    if (!p?.node || depth > 8) return;
    const imp = imported(p, unit);
    if (imp?.pkg === "axios") return { service: "axios", members: [] };
    if (p.isIdentifier()) {
      const b = bound(p, unit);
      return b ? client(b.value, b.unit, depth + 1) : undefined;
    }
    if (p.isMemberExpression()) {
      if (p.node.computed && !t.isStringLiteral(p.node.property)) return;
      const base = client(p.get("object") as P, unit, depth + 1),
        key = name(p.node.property);
      if (base && key) return { ...base, members: [...base.members, key] };
    }
    if (p.isNewExpression() || p.isCallExpression()) {
      const callee = p.get("callee") as P,
        args = p.get("arguments") as P[],
        pkg = imported(callee, unit);
      if (
        pkg &&
        ((pkg.pkg === "openai" &&
          ["default", "OpenAI"].includes(pkg.imported)) ||
          (pkg.pkg === "stripe" &&
            ["default", "Stripe"].includes(pkg.imported)) ||
          (pkg.pkg === "@supabase/supabase-js" &&
            pkg.imported === "createClient"))
      ) {
        const service = packages[pkg.pkg];
        return {
          service,
          members: [],
          base:
            service === "Supabase"
              ? value(args[0], unit)
              : service === "OpenAI"
                ? prop(args[0], "baseURL")
                  ? value(prop(args[0], "baseURL"), unit)
                  : "https://api.openai.com"
                : "https://api.stripe.com",
        };
      }
      const c = client(callee, unit, depth + 1);
      if (c?.service === "axios" && c.members.join(".") === "create")
        return {
          service: "axios",
          members: [],
          base: value(prop(args[0], "baseURL"), unit),
        };
      if (c?.service === "Supabase") return c;
    }
  }
  for (const unit of units.values())
    traverse(unit.ast, {
      "CallExpression|NewExpression"(p: P) {
        const callee = p.get("callee") as P,
          args = p.get("arguments") as P[];
        let service = "",
          method = "",
          operation = "",
          url: string | undefined,
          addressPath: P | undefined;
        const websocket =
          p.isNewExpression() &&
          callee.isIdentifier({ name: "WebSocket" }) &&
          !p.scope.getBinding("WebSocket");
        if (p.isNewExpression() && !websocket) return;
        if (websocket) {
          service = "WebSocket";
          method = "WS";
          operation = "new WebSocket";
          addressPath = args[0];
          url = value(addressPath, unit);
          if (
            !url &&
            addressPath?.isTemplateLiteral() &&
            addressPath.node.expressions.length === 1
          ) {
            const expr = addressPath.get("expressions")[0] as P;
            const start = addressPath.node.quasis[0].value.cooked,
              end = addressPath.node.quasis[1].value.cooked;
            if (
              start &&
              /^wss?:\/\/$/.test(start) &&
              expr.isMemberExpression() &&
              !expr.node.computed &&
              t.isIdentifier(expr.node.object, { name: "location" }) &&
              t.isIdentifier(expr.node.property, { name: "host" }) &&
              !expr.scope.getBinding("location") &&
              end?.startsWith("/") &&
              !unit.source.templateRanges?.some(
                (r) =>
                  r.start < (addressPath!.node.end ?? 0) &&
                  r.end > (addressPath!.node.start ?? 0),
              )
            )
              url = end;
          }
        } else if (
          callee.isIdentifier({ name: "fetch" }) &&
          !p.scope.getBinding("fetch")
        ) {
          service = "HTTP";
          method = value(prop(args[1], "method"), unit) ?? "GET";
          operation = "fetch";
          addressPath = args[0];
          url = value(addressPath, unit);
        } else {
          const c = client(callee, unit);
          if (!c) return;
          if (c.service === "axios") {
            const member = c.members.join(".");
            if (
              ![
                "",
                "get",
                "post",
                "put",
                "patch",
                "delete",
                "head",
                "options",
                "request",
              ].includes(member)
            )
              return;
            service = "HTTP";
            operation = "axios" + (member ? "." + member : "");
            const config = args[0]?.isObjectExpression() ? args[0] : undefined;
            method =
              value(prop(config, "method"), unit) ??
              (["", "request"].includes(member) ? "GET" : member.toUpperCase());
            addressPath = config ? prop(config, "url") : args[0];
            url = value(addressPath, unit);
            const base = value(prop(config, "baseURL"), unit) ?? c.base;
            if (url && base && !/^https?:/i.test(url))
              url = base.replace(/\/$/, "") + "/" + url.replace(/^\//, "");
          } else {
            if (!c.members.length) return;
            service = c.service;
            operation = c.members.join(".");
            method = "SDK";
            url = c.base;
            if (
              service === "Supabase" &&
              ["from", "schema"].includes(operation)
            )
              return;
            if (
              service === "OpenAI" &&
              ![
                "responses.create",
                "responses.retrieve",
                "chat.completions.create",
                "embeddings.create",
                "models.list",
                "models.retrieve",
              ].includes(operation)
            )
              return;
            if (service === "Stripe" && c.members.length < 2) return;
          }
        }
        const line = p.node.loc?.start.line ?? 1;
        let functionName = "최상위 호출";
        const fn = p.getFunctionParent();
        if (fn) {
          const n = fn.node;
          if ((t.isFunctionDeclaration(n) || t.isFunctionExpression(n)) && n.id)
            functionName = n.id.name;
          else if (t.isObjectMethod(n) || t.isClassMethod(n))
            functionName = name(n.key) ?? "익명 함수";
          else if (
            fn.parentPath?.isVariableDeclarator() &&
            t.isIdentifier(fn.parentPath.node.id)
          )
            functionName = fn.parentPath.node.id.name;
          else functionName = "익명 함수";
        }
        // Source arguments may contain credentials. Display only URL expressions, never request configs.
        const raw = url
          ? redactUrl(url)
          : addressPath?.node
            ? safeExpression(addressPath.node)
            : operation;
        const resolution = url
          ? /^(?:https?|wss?):\/\//i.test(url)
            ? "resolved"
            : "internal"
          : "unresolved";
        findings.push({
          id: createHash("sha256")
            .update(unit.source.path + ":" + p.node.start)
            .digest("hex")
            .slice(0, 16),
          service,
          method: method.toUpperCase(),
          operation,
          file: unit.source.path,
          line,
          column: (p.node.loc?.start.column ?? 0) + 1,
          functionName,
          address: url ? redactUrl(url) : null,
          expression: redactExpression(raw).slice(0, 400),
          resolution,
          evidence:
            operation +
            " · " +
            functionName +
            " · " +
            unit.source.path +
            ":" +
            line,
        });
      },
    });
  return { findings, parseErrors: errors, filesScanned: units.size };
}
