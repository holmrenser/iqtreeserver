import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// env.ts memoizes getEnv() at module scope, so each case needs a fresh
// module registry to pick up the process.env changes below.
const ENV_KEYS = [
  "DATABASE_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "APP_URL",
] as const;
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

describe("isEmailConfigured", () => {
  it("is false when SMTP_HOST is unset", async () => {
    delete process.env.SMTP_HOST;
    const { isEmailConfigured } = await import("@/lib/email");
    expect(isEmailConfigured()).toBe(false);
  });
});

describe("buildJobNotification", () => {
  it("builds a completion notification pointing at the job's results page", async () => {
    process.env.APP_URL = "https://iqtree.example.org";
    const { buildJobNotification } = await import("@/lib/email");

    const { subject, text } = buildJobNotification({
      to: "someone@example.com",
      jobId: "abc123",
      alignmentFilename: "my_alignment.fasta",
      outcome: "completed",
    });

    expect(subject).toContain("my_alignment.fasta");
    expect(subject).toContain("finished");
    expect(text).toContain("https://iqtree.example.org/jobs/abc123");
  });

  it("builds a failure notification including the error message", async () => {
    process.env.APP_URL = "https://iqtree.example.org";
    const { buildJobNotification } = await import("@/lib/email");

    const { subject, text } = buildJobNotification({
      to: "someone@example.com",
      jobId: "abc123",
      alignmentFilename: "my_alignment.fasta",
      outcome: "failed",
      errorMessage: "iqtree3 exited with status 2",
    });

    expect(subject).toContain("failed");
    expect(text).toContain("iqtree3 exited with status 2");
  });

  it("strips a trailing slash from APP_URL when building the link", async () => {
    process.env.APP_URL = "https://iqtree.example.org/";
    const { buildJobNotification } = await import("@/lib/email");

    const { text } = buildJobNotification({
      to: "someone@example.com",
      jobId: "abc123",
      alignmentFilename: "x.fasta",
      outcome: "completed",
    });

    expect(text).toContain("https://iqtree.example.org/jobs/abc123");
    expect(text).not.toContain("//jobs");
  });
});
