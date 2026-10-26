export function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error("CONFIG:" + name);
  return value;
}
export function configured() {
  return Boolean(
    process.env.TURSO_DATABASE_URL &&
    process.env.BETTER_AUTH_SECRET &&
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET,
  );
}
export function siteUrl() {
  return required("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "");
}
export function setupStatus() {
  return [
    "TURSO_DATABASE_URL",
    "TURSO_AUTH_TOKEN",
    "BETTER_AUTH_SECRET",
    "CREDENTIAL_ENCRYPTION_KEY",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_APP_ID",
    "GITHUB_APP_SLUG",
    "GITHUB_APP_CLIENT_ID",
    "GITHUB_APP_CLIENT_SECRET",
    "GITHUB_APP_PRIVATE_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "CRON_SECRET",
  ].filter((x) => !process.env[x]);
}
