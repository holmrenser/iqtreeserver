import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = ["DATABASE_URL", "SMTP_SECURE"] as const;
const originalEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
  process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
  vi.resetModules();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe("SMTP_SECURE parsing", () => {
  it('parses the string "false" as false (not truthy-string-coercion)', async () => {
    process.env.SMTP_SECURE = "false";
    const { getEnv } = await import("@/lib/env");
    expect(getEnv().SMTP_SECURE).toBe(false);
  });

  it('parses the string "true" as true', async () => {
    process.env.SMTP_SECURE = "true";
    const { getEnv } = await import("@/lib/env");
    expect(getEnv().SMTP_SECURE).toBe(true);
  });

  it("defaults to false when unset", async () => {
    delete process.env.SMTP_SECURE;
    const { getEnv } = await import("@/lib/env");
    expect(getEnv().SMTP_SECURE).toBe(false);
  });
});
