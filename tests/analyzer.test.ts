import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSources } from "../src/lib/analyzer";
import { redactUrl } from "../src/lib/redact";
const analyze = (content: string) =>
  analyzeSources([{ path: "app.ts", content }]);
test("fetch resolves constants, templates and function evidence", () => {
  const r = analyze(
    'const root="https://api.example.com"; export async function load(){return fetch(`${root}/items`);}',
  );
  assert.equal(r.findings[0].address, "https://api.example.com/items");
  assert.equal(r.findings[0].functionName, "load");
});
test("aliased axios and configured instances", () => {
  const r = analyze(
    'import http from "axios";const api=http.create({baseURL:"https://api.example.com"});api.get("/items");http({url:"https://other.example.com",method:"POST"});',
  );
  assert.equal(r.findings.length, 2);
  assert.equal(r.findings[0].address, "https://api.example.com/items");
  assert.equal(r.findings[1].method, "POST");
});
test("local shadows do not become APIs", () => {
  assert.equal(
    analyze(
      'function x(fetch:any){fetch("https://x.com")} const axios={get(){}};axios.get("https://x.com");',
    ).findings.length,
    0,
  );
});
test("dynamic addresses remain unresolved and internal calls are marked", () => {
  const r = analyze('fetch(process.env.API_URL+"/items");fetch("/api/local");');
  assert.equal(r.findings[0].resolution, "unresolved");
  assert.equal(r.findings[1].resolution, "internal");
});
test("imported constants and SDK clients follow relative modules", () => {
  const r = analyzeSources([
    {
      path: "config.ts",
      content: 'export const BASE="https://api.example.com";',
    },
    {
      path: "app.ts",
      content:
        'import {BASE as endpoint} from "./config";fetch(endpoint+"/items");',
    },
  ]);
  assert.equal(r.findings[0].address, "https://api.example.com/items");
});
test("SDK imports and clients identify actual operations", () => {
  const r = analyze(
    'import AI from "openai";import {createClient as make} from "@supabase/supabase-js";import Payment from "stripe";const ai=new AI();const db=make("https://db.supabase.co","private");const pay=new Payment("private");ai.responses.create({input:"secret"});db.from("users").select("*");pay.customers.list();',
  );
  assert.deepEqual(
    r.findings.map((f) => f.service),
    ["OpenAI", "Supabase", "Stripe"],
  );
  assert.ok(!JSON.stringify(r).includes("private"));
  assert.ok(!JSON.stringify(r).includes("secret"));
});
test("require SDK constructors work", () => {
  const r = analyze(
    'const OpenAI=require("openai");const ai=new OpenAI();ai.responses.create({});',
  );
  assert.equal(r.findings[0].service, "OpenAI");
});
test("mutable variables and cyclic exports are not evaluated", () => {
  const r = analyze('let url="https://a.com";url=unknown();fetch(url);');
  assert.equal(r.findings[0].resolution, "unresolved");
  const cyclic = analyzeSources([
    {
      path: "a.ts",
      content: 'import {B} from "./b";export const A=B;fetch(A);',
    },
    { path: "b.ts", content: 'import {A} from "./a";export const B=A;' },
  ]);
  assert.equal(cyclic.findings[0].resolution, "unresolved");
});
test("parse errors are explicit and do not erase other files", () => {
  const r = analyzeSources([
    { path: "bad.ts", content: "const =" },
    { path: "ok.ts", content: 'fetch("https://api.example.com");' },
  ]);
  assert.deepEqual(r.parseErrors, ["bad.ts"]);
  assert.equal(r.findings.length, 1);
});
test("credentials and URL tokens are masked", () => {
  const r = analyze(
    'fetch("https://user:password@api.example.com/data?api_key=secret-value");',
  );
  assert.ok(!JSON.stringify(r).includes("secret-value"));
  assert.ok(!JSON.stringify(r).includes("password"));
  assert.ok(redactUrl("https://x.com?token=xyz").includes("%5B"));
});

test("dynamic custom SDK base is not replaced by the default", () => {
  const r = analyze(
    'import OpenAI from "openai";const ai=new OpenAI({baseURL:process.env.CUSTOM_URL});ai.responses.create({});',
  );
  assert.equal(r.findings[0].resolution, "unresolved");
  assert.equal(r.findings[0].address, null);
});
test("unknown expression arguments cannot leak strings", () => {
  const r = analyze('fetch(makeUrl({token:"super-private-value"}));');
  assert.ok(!JSON.stringify(r).includes("super-private-value"));
});
test("numeric arithmetic is unresolved rather than incorrectly concatenated", () => {
  const r = analyze('fetch("https://api.example.com/"+(1+2));');
  assert.equal(r.findings[0].resolution, "unresolved");
});
