import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/submit/route";
import { prisma } from "@/lib/prisma";

const VALID_OPTIONS = {
  sequenceType: "AUTO",
  modelMode: { mode: "manual", model: "GTR+G" },
  branchSupport: {
    ultrafastBootstrap: { enabled: false, replicates: 1000 },
    shAlrt: { enabled: false, replicates: 1000 },
    abayes: false,
    standardBootstrap: { enabled: false, replicates: 100 },
  },
  partitionMode: "p",
  advanced: { bnni: false, asr: false },
};

function submitRequest(fields: { options?: string; alignment?: File | string; notifyEmail?: string }): Request {
  const form = new FormData();
  if (fields.options !== undefined) form.set("options", fields.options);
  if (fields.alignment instanceof File) {
    form.set("alignment", fields.alignment);
  } else if (typeof fields.alignment === "string") {
    form.set("alignment", fields.alignment);
  }
  if (fields.notifyEmail !== undefined) form.set("notifyEmail", fields.notifyEmail);
  return new Request("http://localhost/api/submit", { method: "POST", body: form });
}

function fastaFile(content: string, name = "test.fasta"): File {
  return new File([content], name, { type: "text/plain" });
}

const createdJobIds: string[] = [];

afterEach(async () => {
  if (createdJobIds.length > 0) {
    await prisma.iqtreeJob.deleteMany({ where: { id: { in: createdJobIds } } });
    createdJobIds.length = 0;
  }
});

describe("POST /api/submit", () => {
  it("creates a job row and enqueues it on a valid submission", async () => {
    const res = await POST(
      submitRequest({
        options: JSON.stringify(VALID_OPTIONS),
        alignment: fastaFile(">a\nACGTACGTACGT\n>b\nACGTACGTACGA\n"),
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.jobId).toEqual(expect.any(String));
    createdJobIds.push(body.jobId);

    const row = await prisma.iqtreeJob.findUnique({ where: { id: body.jobId } });
    expect(row).not.toBeNull();
    expect(row?.alignmentFilename).toBe("test.fasta");
    expect(row?.finished).toBeNull();
    expect(row?.err).toBeNull();
  });

  it("dedupes an identical resubmission to the same job id without creating a duplicate row", async () => {
    const alignment = ">x\nACGTACGTACGTACGT\n>y\nACGTACGTACGTACGA\n";
    const req = () =>
      submitRequest({ options: JSON.stringify(VALID_OPTIONS), alignment: fastaFile(alignment, "dedup.fasta") });

    const first = await POST(req());
    const firstBody = await first.json();
    createdJobIds.push(firstBody.jobId);

    const second = await POST(req());
    const secondBody = await second.json();

    expect(secondBody.jobId).toBe(firstBody.jobId);

    const rows = await prisma.iqtreeJob.findMany({ where: { id: firstBody.jobId } });
    expect(rows).toHaveLength(1);
  });

  it("rejects a request with malformed options JSON", async () => {
    const res = await POST(submitRequest({ options: "not json", alignment: fastaFile(">a\nACGT\n") }));
    expect(res.status).toBe(400);
  });

  it("rejects a request with options that fail schema validation", async () => {
    const invalid = {
      ...VALID_OPTIONS,
      branchSupport: {
        ...VALID_OPTIONS.branchSupport,
        ultrafastBootstrap: { enabled: true, replicates: 1000 },
        standardBootstrap: { enabled: true, replicates: 100 },
      },
    };
    const res = await POST(
      submitRequest({ options: JSON.stringify(invalid), alignment: fastaFile(">a\nACGT\n") }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a request missing the alignment file", async () => {
    const res = await POST(submitRequest({ options: JSON.stringify(VALID_OPTIONS) }));
    expect(res.status).toBe(400);
  });

  it("rejects a request with an unsupported alignment file extension", async () => {
    const res = await POST(
      submitRequest({
        options: JSON.stringify(VALID_OPTIONS),
        alignment: fastaFile(">a\nACGT\n", "test.exe"),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects a notifyEmail address when SMTP is not configured", async () => {
    const res = await POST(
      submitRequest({
        options: JSON.stringify(VALID_OPTIONS),
        alignment: fastaFile(">a\nACGTACGTACGT\n"),
        notifyEmail: "someone@example.com",
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/submit with SMTP configured", () => {
  const originalSmtpHost = process.env.SMTP_HOST;
  const notifyCreatedJobIds: string[] = [];

  beforeEach(() => {
    process.env.SMTP_HOST = "smtp.example.com";
    vi.resetModules();
  });

  afterEach(async () => {
    if (originalSmtpHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = originalSmtpHost;
    if (notifyCreatedJobIds.length > 0) {
      await prisma.iqtreeJob.deleteMany({ where: { id: { in: notifyCreatedJobIds } } });
      notifyCreatedJobIds.length = 0;
    }
  });

  it("accepts and stores a notifyEmail address once SMTP is configured", async () => {
    const { POST: submitWithSmtp } = await import("@/app/api/submit/route");

    const res = await submitWithSmtp(
      submitRequest({
        options: JSON.stringify(VALID_OPTIONS),
        alignment: fastaFile(">a\nACGTACGTACGTACGA\n", "notify.fasta"),
        notifyEmail: "someone@example.com",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    notifyCreatedJobIds.push(body.jobId);

    const row = await prisma.iqtreeJob.findUnique({ where: { id: body.jobId } });
    expect(row?.notifyEmail).toBe("someone@example.com");
  });
});
