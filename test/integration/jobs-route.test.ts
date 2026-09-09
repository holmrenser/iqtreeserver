import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/jobs/[id]/route";
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

function getRequest(id: string) {
  return GET(new Request(`http://localhost/api/jobs/${id}`), { params: Promise.resolve({ id }) });
}

describe("GET /api/jobs/[id]", () => {
  it("returns 404 for an unknown job id", async () => {
    const res = await getRequest(randomUUID());
    expect(res.status).toBe(404);
  });

  it("reports a pending job as not done", async () => {
    const id = await createJob({});
    const res = await getRequest(id);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.done).toBe(false);
    expect(body.finished).toBeNull();
  });

  it("reports a finished job as done", async () => {
    const id = await createJob({ started: new Date(), finished: new Date() });
    const res = await getRequest(id);
    const body = await res.json();
    expect(body.done).toBe(true);
    expect(body.finished).not.toBeNull();
  });

  it("reports a failed job as done, with the error message", async () => {
    const id = await createJob({ started: new Date(), err: "iqtree3 exited with status 1" });
    const res = await getRequest(id);
    const body = await res.json();
    expect(body.done).toBe(true);
    expect(body.err).toBe("iqtree3 exited with status 1");
  });

  it("never includes heavy columns like alignmentData in the response", async () => {
    const id = await createJob({});
    const res = await getRequest(id);
    const body = await res.json();
    expect(body.alignmentData).toBeUndefined();
  });
});
