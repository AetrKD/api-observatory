import { parser } from "@lezer/python";
import type { SyntaxNode } from "@lezer/common";
import { createHash } from "node:crypto";
import type { Finding, SourceFile } from "../types";
import { redactUrl } from "../redact";

type Binding = {
  canonical?: string;
  value?: SyntaxNode;
  scope: Scope;
  conditional: boolean;
  from: number;
};
type Scope = {
  parent?: Scope;
  bindings: Map<string, Binding[]>;
  functionName: string;
  className?: string;
  opaque?: boolean;
};
type Symbol = { canonical: string; base?: string; configuredBase?: boolean };
const verbs = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
]);
const children = (node: SyntaxNode) => {
  const out: SyntaxNode[] = [];
  for (let c = node.firstChild; c; c = c.nextSibling) out.push(c);
  return out;
};

/** Parses source text only. Python is never imported or executed. */
export function analyzePython(source: SourceFile): {
  findings: Finding[];
  parseErrors: string[];
} {
  const tree = parser.parse(source.content),
    findings: Finding[] = [],
    calls: { node: SyntaxNode; scope: Scope }[] = [];
  let invalid = false;
  tree.iterate({
    enter(node) {
      if (node.type.isError) {
        // Lezer 1.1 treats a valid bare yield as a missing expression.
        const parent = node.node.parent;
        const bareYield =
          node.from === node.to &&
          parent?.name === "YieldStatement" &&
          source.content.slice(parent.from, parent.to).trim() === "yield";
        if (!bareYield) invalid = true;
      }
    },
  });
  if (invalid) return { findings, parseErrors: [source.path] };
  const text = (n: SyntaxNode) => source.content.slice(n.from, n.to);
  const root: Scope = { bindings: new Map(), functionName: "최상위 호출" };
  function bind(scope: Scope, name: string, entry: Partial<Binding> = {}) {
    const list = scope.bindings.get(name) ?? [];
    list.push({ scope, conditional: false, from: 0, ...entry });
    scope.bindings.set(name, list);
  }
  function target(
    node: SyntaxNode,
    scope: Scope,
    entry: Partial<Binding> = {},
  ) {
    if (node.name === "VariableName") bind(scope, text(node), entry);
    else if (node.name === "MemberExpression") {
      const first = children(node)[0];
      if (first) target(first, scope);
    } else
      for (const c of children(node))
        if (
          ["VariableName", "TupleExpression", "ArrayExpression"].includes(
            c.name,
          )
        )
          target(c, scope);
  }
  function imports(node: SyntaxNode, scope: Scope) {
    const items = children(node).filter(
      (c) => !["Comment", "(", ")"].includes(c.name),
    );
    const index = items.findIndex((c) => c.name === "import");
    if (index < 0) return;
    const prefix =
      items[0]?.name === "from" ? items.slice(1, index).map(text).join("") : "";
    let group: SyntaxNode[] = [];
    const save = () => {
      if (!group.length) return;
      if (group.some((c) => text(c) === "*")) {
        scope.opaque = true;
        return;
      }
      const alias = group.findIndex((c) => c.name === "as");
      const parts = (alias < 0 ? group : group.slice(0, alias))
        .map(text)
        .join("");
      const local =
        alias < 0
          ? prefix
            ? parts
            : parts.split(".")[0]
          : text(group[alias + 1]);
      if (!local || !parts) return;
      bind(scope, local, {
        canonical: prefix
          ? prefix + "." + parts
          : alias < 0
            ? parts.split(".")[0]
            : parts,
        from: node.from,
      });
    };
    for (const c of items.slice(index + 1)) {
      if (c.name === ",") {
        save();
        group = [];
      } else group.push(c);
    }
    save();
  }
  function walk(node: SyntaxNode, scope: Scope, conditional = false) {
    const items = children(node);
    if (node.name === "ImportStatement") {
      imports(node, scope);
      return;
    }
    if (
      ["FunctionDefinition", "ClassDefinition", "LambdaExpression"].includes(
        node.name,
      )
    ) {
      const id = items.find((c) => c.name === "VariableName");
      if (id && node.name !== "LambdaExpression") bind(scope, text(id));
      const isClass = node.name === "ClassDefinition";
      const inner: Scope = {
        parent: !isClass && scope.className ? scope.parent : scope,
        bindings: new Map(),
        className: isClass ? (id ? text(id) : undefined) : undefined,
        functionName: isClass
          ? scope.functionName
          : node.name === "LambdaExpression"
            ? "익명 함수"
            : (scope.className ? scope.className + "." : "") +
              (id ? text(id) : "익명 함수"),
      };
      const params = items.find((c) => c.name === "ParamList");
      if (params)
        for (const c of children(params))
          if (c.name === "VariableName") bind(inner, text(c));
      const body = items.find((c) => c.name === "Body");
      if (body) walk(body, inner);
      else if (node.name === "LambdaExpression")
        for (const c of items) if (c !== params) walk(c, inner);
      return;
    }
    // Comprehension scopes and global/nonlocal rebinding are deliberately conservative.
    if (node.name.includes("Comprehension")) return;
    if (["GlobalStatement", "NonlocalStatement"].includes(node.name)) {
      for (const c of items)
        if (c.name === "VariableName") bind(scope, text(c));
      return;
    }
    if (node.name === "AssignStatement") {
      const op = items.findIndex((c) => c.name === "AssignOp");
      if (op >= 0) {
        const lhs = items.slice(0, op).filter((c) => c.name !== "TypeDef");
        const rhs = items[op + 1];
        if (
          lhs.length === 1 &&
          lhs[0].name === "VariableName" &&
          items.filter((c) => c.name === "AssignOp").length === 1
        )
          target(lhs[0], scope, { value: rhs, conditional, from: node.from });
        else for (const c of lhs) target(c, scope);
      }
    } else if (["UpdateStatement", "DeleteStatement"].includes(node.name)) {
      for (const c of node.name === "DeleteStatement"
        ? items.slice(1)
        : items.slice(0, 1))
        target(c, scope);
    }
    if (node.name === "ForStatement") {
      const begin = items.findIndex((c) => c.name === "for"),
        end = items.findIndex((c) => c.name === "in");
      for (const c of items.slice(begin + 1, end)) target(c, scope);
    }
    if (node.name === "WithStatement")
      for (let i = 0; i < items.length; i++)
        if (items[i].name === "as" && items[i + 1])
          target(items[i + 1], scope, {
            value: items[i - 1],
            conditional,
            from: node.from,
          });
    if (node.name === "ExceptClause" || node.name === "TryStatement")
      for (let i = 0; i < items.length; i++)
        if (items[i].name === "as" && items[i + 1]) target(items[i + 1], scope);
    if (node.name === "CallExpression") calls.push({ node, scope });
    const nestedConditional =
      conditional ||
      [
        "IfStatement",
        "ForStatement",
        "WhileStatement",
        "TryStatement",
        "MatchStatement",
      ].includes(node.name);
    for (const c of items) walk(c, scope, nestedConditional);
  }
  walk(tree.topNode, root);
  function binding(
    scope: Scope,
    name: string,
    at: number,
  ): Binding | undefined {
    for (let s: Scope | undefined = scope; s; s = s.parent) {
      if (s.opaque) return;
      const entries = s.bindings.get(name);
      if (entries) {
        const b = entries[0];
        return entries.length === 1 && b.from <= at ? b : undefined;
      }
    }
  }
  function args(node: SyntaxNode) {
    const positional: SyntaxNode[] = [],
      keywords = new Map<string, SyntaxNode>();
    const list = node.getChild("ArgList");
    if (!list) return { positional, keywords };
    let group: SyntaxNode[] = [];
    const save = () => {
      if (group.length === 1) positional.push(group[0]);
      else if (
        group.length === 3 &&
        group[0].name === "VariableName" &&
        group[1].name === "AssignOp"
      )
        keywords.set(text(group[0]), group[2]);
      else if (group.length) positional.push(group[0]);
    };
    for (const c of children(list)) {
      if (["(", ")", "Comment"].includes(c.name)) continue;
      if (c.name === ",") {
        save();
        group = [];
      } else group.push(c);
    }
    save();
    return { positional, keywords };
  }
  function decode(s: string, raw = false): string | undefined {
    if (raw) return s;
    let invalidEscape = false;
    const out = s.replace(
      /\\(?:\r?\n|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[\s\S])/g,
      (part) => {
        const key = part.slice(1);
        if (key === "\n" || key === "\r\n") return "";
        const simple: Record<string, string> = {
          n: "\n",
          r: "\r",
          t: "\t",
          "\\": "\\",
          "'": "'",
          '"': '"',
        };
        if (Object.hasOwn(simple, key)) return simple[key];
        if (/^[xuU][0-9a-fA-F]+$/.test(key)) {
          const num = parseInt(key.slice(1), 16);
          if (num <= 0x10ffff) return String.fromCodePoint(num);
        }
        invalidEscape = true;
        return "";
      },
    );
    return invalidEscape ? undefined : out;
  }
  function value(
    node: SyntaxNode | undefined,
    scope: Scope,
    depth = 0,
  ): string | undefined {
    if (!node || depth > 8) return;
    if (node.name === "VariableName") {
      const b = binding(scope, text(node), node.from);
      if (b?.value && !b.conditional) return value(b.value, b.scope, depth + 1);
      return;
    }
    if (node.name === "String" || node.name === "FormatString") {
      const raw = text(node),
        match = /^([rubf]*)("""|'''|"|')/i.exec(raw);
      if (!match || /b/i.test(match[1])) return;
      const q = match[2];
      if (!raw.endsWith(q)) return;
      let start = node.from + match[0].length;
      const end = node.to - q.length;
      let result = "";
      if (node.name === "FormatString")
        for (const replacement of children(node).filter(
          (c) => c.name === "FormatReplacement",
        )) {
          const fields = children(replacement);
          if (fields.length !== 3) return;
          const fragment = decode(
            source.content
              .slice(start, replacement.from)
              .replaceAll("{{", "{")
              .replaceAll("}}", "}"),
            /r/i.test(match[1]),
          );
          const inner = value(fields[1], scope, depth + 1);
          if (fragment === undefined || inner === undefined) return;
          result += fragment + inner;
          start = replacement.to;
        }
      const tail = decode(
        source.content
          .slice(start, end)
          .replaceAll("{{", node.name === "FormatString" ? "{" : "{{")
          .replaceAll("}}", node.name === "FormatString" ? "}" : "}}"),
        /r/i.test(match[1]),
      );
      return tail === undefined ? undefined : result + tail;
    }
    if (node.name === "BinaryExpression") {
      const c = children(node);
      if (c.length !== 3 || text(c[1]) !== "+") return;
      const left = value(c[0], scope, depth + 1),
        right = value(c[2], scope, depth + 1);
      return left !== undefined && right !== undefined
        ? left + right
        : undefined;
    }
    if (node.name === "ParenthesizedExpression") {
      const c = children(node).find((n) => !["(", ")"].includes(n.name));
      return value(c, scope, depth + 1);
    }
  }
  function symbol(
    node: SyntaxNode | undefined,
    scope: Scope,
    depth = 0,
  ): Symbol | undefined {
    if (!node || depth > 8) return;
    if (node.name === "VariableName") {
      const b = binding(scope, text(node), node.from);
      if (b?.canonical) return { canonical: b.canonical };
      if (b?.value && !b.conditional)
        return symbol(b.value, b.scope, depth + 1);
      return;
    }
    if (node.name === "MemberExpression") {
      const c = children(node),
        base = symbol(c[0], scope, depth + 1),
        member = c.find((n) => n.name === "PropertyName");
      if (base && member)
        return { ...base, canonical: base.canonical + "." + text(member) };
      return;
    }
    if (node.name === "CallExpression") {
      const callee = symbol(children(node)[0], scope, depth + 1);
      if (!callee) return;
      const a = args(node);
      if (
        ["requests.Session", "requests.sessions.Session"].includes(
          callee.canonical,
        )
      )
        return { canonical: "requests" };
      if (["httpx.Client", "httpx.AsyncClient"].includes(callee.canonical))
        return {
          canonical: "httpx",
          base: value(a.keywords.get("base_url"), scope, depth + 1),
          configuredBase: a.keywords.has("base_url"),
        };
    }
  }
  const lineStarts = [0];
  for (let i = 0; i < source.content.length; i++)
    if (source.content[i] === "\n") lineStarts.push(i + 1);
  for (const { node, scope } of calls) {
    const callee = symbol(children(node)[0], scope);
    if (!callee) continue;
    const a = args(node),
      canonical = callee.canonical;
    let urlNode: SyntaxNode | undefined,
      method: string,
      operation = canonical;
    const match =
      /^(requests(?:\.api)?|httpx)\.(get|post|put|patch|delete|head|options|request)$/.exec(
        canonical,
      );
    if (match) {
      const member = match[2];
      method =
        member === "request"
          ? (value(a.keywords.get("method") ?? a.positional[0], scope) ??
            "UNKNOWN")
          : member.toUpperCase();
      urlNode =
        a.keywords.get("url") ?? a.positional[member === "request" ? 1 : 0];
    } else if (canonical === "urllib.request.urlopen") {
      urlNode = a.keywords.get("url") ?? a.positional[0];
      const data = a.keywords.get("data") ?? a.positional[1];
      method = data && data.name !== "None" ? "UNKNOWN" : "GET";
      if (
        urlNode?.name === "CallExpression" &&
        symbol(children(urlNode)[0], scope)?.canonical ===
          "urllib.request.Request"
      ) {
        const request = args(urlNode),
          requestData = request.keywords.get("data") ?? request.positional[1];
        method =
          value(request.keywords.get("method"), scope) ??
          (requestData && requestData.name !== "None" ? "UNKNOWN" : "GET");
        urlNode =
          request.keywords.get("url") ??
          request.keywords.get("fullurl") ??
          request.positional[0];
      } else if (value(urlNode, scope) === undefined) method = "UNKNOWN";
    } else continue;
    method = verbs.has(method.toLowerCase()) ? method.toUpperCase() : "UNKNOWN";
    let url = value(urlNode, scope);
    if (url && !/^https?:\/\//i.test(url) && callee.configuredBase) {
      url = callee.base
        ? callee.base.replace(/\/$/, "") + "/" + url.replace(/^\//, "")
        : undefined;
    }
    let low = 0,
      high = lineStarts.length;
    while (low + 1 < high) {
      const mid = (low + high) >> 1;
      if (lineStarts[mid] <= node.from) low = mid;
      else high = mid;
    }
    const line = low + 1,
      column = node.from - lineStarts[low] + 1,
      address = url ? redactUrl(url) : null;
    findings.push({
      id: createHash("sha256")
        .update(source.path + ":" + node.from)
        .digest("hex")
        .slice(0, 16),
      service: "HTTP",
      method,
      operation,
      file: source.path,
      line,
      column,
      functionName: scope.functionName,
      address,
      expression: address ?? "[동적 표현식]",
      resolution: url
        ? /^https?:\/\//i.test(url)
          ? "resolved"
          : "internal"
        : "unresolved",
      evidence:
        operation +
        " · " +
        scope.functionName +
        " · " +
        source.path +
        ":" +
        line,
    });
  }
  return { findings, parseErrors: [] };
}
