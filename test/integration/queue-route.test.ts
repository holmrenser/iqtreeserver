import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/queue/route";
import { prisma } from "@/lib/prisma";

const createdJobIds: string[] = [];

afterEach(async () => {
  if (createdJobIds.length > 0) {
    await prisma.iqtreeJob.deleteMany({ where: { id: { in: createdJobIds } } });
    createdJobIds.length = 0;
  }
});

async function createJob(overrides: Partial<{ started: Date | null; finished: Date | null; err: string | null }>) {
  const id = randomUUID();
  createdJobIds.push(id);
  await prisma.iqtreeJob.create({
    data: {
      id,
      parameters: {},
      alignmentFilename: "test.fasta",
      alignmentData: new Uint8Array(),
      ...overrides,
    },
  });
  return id;
}

describe("GET /api/queue", () => {
  it("counts one job in each state correctly", async () => {
    await createJob({});
    await createJob({ started: new Date() });
    await createJob({ started: new Date(), finished: new Date() });
    await createJob({ started: new Date(), err: "boom" });

    const res = await GET();
    const body = await res.json();

    expect(body.waiting).toBeGreaterThanOrEqual(1);
    expect(body.active).toBeGreaterThanOrEqual(1);
    expect(body.completed).toBeGreaterThanOrEqual(1);
    expect(body.failed).toBeGreaterThanOrEqual(1);
  });

  it("matches a freshly submitted job (no started/finished/err) against the 'waiting' predicate", async () => {
    // Asserts the route's counting predicate directly, rather than a global
    // before/after delta - other test files hit this same table concurrently
    // against the same real Postgres, so a global count is inherently racy.
    const id = await createJob({});
    const waitingCount = await prisma.iqtreeJob.count({
      where: { id, started: null, finished: null, err: null },
    });
    expect(waitingCount).toBe(1);
  });
});
