import { execFileSync } from "node:child_process";

const DB_HOST = process.env.DB_HOST ?? "localhost";
const DB_PORT = process.env.DB_PORT ?? "5432";
const DB_NAME = process.env.DB_NAME ?? "postgres";
const DB_USER = process.env.DB_USER ?? "postgres";
const DB_PASSWORD = process.env.DB_PASSWORD ?? "postgres";

const TEST_EMAIL_PATTERNS = [
  "e2e-%@example.com",
  "srch-%@example.com",
  "new-%@example.com",
  "mm-%@example.com",
  "short-%@example.com",
];

export default async function globalSetup() {
  const sql = `DELETE FROM users WHERE ${TEST_EMAIL_PATTERNS.map(
    (p) => `LOWER(email) LIKE '${p}'`
  ).join(" OR ")};`;

  try {
    const out = execFileSync(
      "psql",
      [
        "-h",
        DB_HOST,
        "-p",
        DB_PORT,
        "-U",
        DB_USER,
        "-d",
        DB_NAME,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        sql,
      ],
      {
        env: { ...process.env, PGPASSWORD: DB_PASSWORD },
        encoding: "utf8",
      }
    );
    console.log(`[global-setup] pruned leftover test users: ${out.trim()}`);
  } catch (err) {
    const e = err as { stderr?: Buffer | string; message?: string };
    const stderr =
      typeof e.stderr === "string"
        ? e.stderr
        : e.stderr?.toString?.() ?? "";
    throw new Error(
      `[global-setup] failed to prune test users via psql: ${stderr || e.message}`
    );
  }
}
