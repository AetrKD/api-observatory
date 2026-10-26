import { createClient, type Client, type InValue } from "@libsql/client/web";
import { drizzle } from "drizzle-orm/libsql";
import { required } from "./config";
import * as schema from "./auth-schema";
let connection: Client | undefined;
export function db() {
  return (connection ??= createClient({
    url: required("TURSO_DATABASE_URL"),
    authToken: required("TURSO_AUTH_TOKEN"),
  }));
}
export function authDb() {
  return drizzle(db(), { schema });
}
export async function rows<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  return (await db().execute({ sql, args })).rows as unknown as T[];
}
export async function one<T>(
  sql: string,
  args: InValue[] = [],
): Promise<T | null> {
  return (await rows<T>(sql, args))[0] ?? null;
}
