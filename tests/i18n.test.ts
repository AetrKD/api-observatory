import { test } from "node:test";
import assert from "node:assert/strict";
import { translate } from "../src/lib/i18n";
import { english } from "../src/lib/translations";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

test("English covers rendered labels and server failures without translating code URLs", () => {
  const sources = [
    "src/app/page.tsx",
    ...readdirSync("src/components")
      .filter((f) => f.endsWith(".tsx") && f !== "language-provider.tsx")
      .map((f) => "src/components/" + f),
  ];
  for (const file of sources) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function walk(n: ts.Node) {
      if (
        ts.isCallExpression(n) &&
        n.expression.getText(source) === "t" &&
        n.arguments[0] &&
        ts.isStringLiteral(n.arguments[0])
      ) {
        const key = n.arguments[0].text;
        assert.ok(Object.hasOwn(english, key), "Missing translation: " + key);
      }
      ts.forEachChild(n, walk);
    }
    walk(source);
  }
  assert.equal(
    translate("최근 분석 실패: 분석 제한 시간 60초를 초과했습니다.", "en"),
    "Latest analysis failed: Analysis exceeded the 60-second time limit.",
  );
  const url = "https://github.com/owner/repo/blob/123/src/api.ts#L9";
  assert.equal(translate(url, "en"), url);
  assert.equal(translate("분석 완료", "ko"), "분석 완료");
});
