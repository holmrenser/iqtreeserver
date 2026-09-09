import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getBoss } from "@/app/api/queue";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { IQTREE_QUEUE, getJobExpireSeconds, getJobRetryLimit, type IqtreeJobPayload } from "@/lib/queue";
import { computeJobId, sha256Hex } from "@/lib/hash";
import { iqtreeSubmissionSchema, type StoredJobParameters } from "@/lib/iqtree/schema";
import { isEmailConfigured } from "@/lib/email";

const ALLOWED_ALIGNMENT_EXTENSIONS = [
  ".fasta",
  ".fa",
  ".fas",
  ".phy",
  ".phylip",
  ".nex",
  ".nexus",
  ".aln",
  ".clustal",
  ".msf",
];
const ALLOWED_PARTITION_EXTENSIONS = [".nex", ".nexus", ".txt", ".part"];

function hasAllowedExtension(filename: string, allowed: string[]): boolean {
  const lower = filename.toLowerCase();
  return allowed.some((ext) => lower.endsWith(ext));
}

export async function POST(request: Request) {
  const env = getEnv();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const optionsRaw = form.get("options");
  if (typeof optionsRaw !== "string") {
    return NextResponse.json({ error: "Missing 'options' field" }, { status: 400 });
  }

  let optionsJson: unknown;
  try {
    optionsJson = JSON.parse(optionsRaw);
  } catch {
    return NextResponse.json({ error: "'options' is not valid JSON" }, { status: 400 });
  }

  const parsedOptions = iqtreeSubmissionSchema.safeParse(optionsJson);
  if (!parsedOptions.success) {
    return NextResponse.json(
      { error: "Invalid options", issues: parsedOptions.error.issues },
      { status: 400 },
    );
  }
  const options = parsedOptions.data;

  const alignmentFile = form.get("alignment");
  if (!(alignmentFile instanceof File) || alignmentFile.size === 0) {
    return NextResponse.json({ error: "Missing 'alignment' file" }, { status: 400 });
  }
  if (!hasAllowedExtension(alignmentFile.name, ALLOWED_ALIGNMENT_EXTENSIONS)) {
    return NextResponse.json({ error: "Unsupported alignment file extension" }, { status: 400 });
  }
  if (alignmentFile.size > env.MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Alignment file exceeds the upload size limit" }, { status: 413 });
  }

  const partitionFile = form.get("partition");
  let partitionData: Buffer | undefined;
  let partitionFilename: string | undefined;
  if (partitionFile instanceof File && partitionFile.size > 0) {
    if (!hasAllowedExtension(partitionFile.name, ALLOWED_PARTITION_EXTENSIONS)) {
      return NextResponse.json({ error: "Unsupported partition file extension" }, { status: 400 });
    }
    if (partitionFile.size > env.MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Partition file exceeds the upload size limit" }, { status: 413 });
    }
    partitionData = Buffer.from(await partitionFile.arrayBuffer());
    partitionFilename = partitionFile.name;
  }

  const notifyEmailRaw = form.get("notifyEmail");
  let notifyEmail: string | undefined;
  if (typeof notifyEmailRaw === "string" && notifyEmailRaw.trim() !== "") {
    // Defense in depth: the form disables this field entirely when SMTP
    // isn't configured (see JobSubmissionForm's emailEnabled prop), but
    // reject explicitly here too rather than silently accepting-and-ignoring
    // an address nothing will ever email - see docs/email-notifications.md.
    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: "Email notifications are not configured on this server" },
        { status: 400 },
      );
    }
    const parsedEmail = z.email().safeParse(notifyEmailRaw.trim());
    if (!parsedEmail.success) {
      return NextResponse.json({ error: "Invalid notification email address" }, { status: 400 });
    }
    notifyEmail = parsedEmail.data;
  }

  const alignmentData = Buffer.from(await alignmentFile.arrayBuffer());

  // notifyEmail is deliberately excluded from computeJobId's inputs, same
  // reasoning as seed (hash.ts): it's per-submission metadata, not part of
  // what makes two submissions "the same job".
  const jobId = computeJobId({ options, alignmentData, partitionData });

  // Seed is deliberately excluded from computeJobId's inputs (see hash.ts) -
  // it's assigned fresh per submission and only matters for reproducibility,
  // not identity, so an identical resubmission still dedupes correctly.
  const seed = randomInt(1, 2_147_483_647);

  const parameters: StoredJobParameters = {
    options,
    alignmentSha256: sha256Hex(alignmentData),
    partitionSha256: partitionData ? sha256Hex(partitionData) : null,
    seed,
  };

  const boss = await getBoss();

  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.iqtreeJob.findUnique({ where: { id: jobId }, select: { id: true } });
    if (existing) return false;

    await tx.iqtreeJob.create({
      data: {
        id: jobId,
        parameters: parameters as object,
        alignmentFilename: alignmentFile.name,
        alignmentData: Uint8Array.from(alignmentData),
        partitionFilename,
        partitionData: partitionData ? Uint8Array.from(partitionData) : undefined,
        notifyEmail,
      },
    });
    return true;
  });

  if (created) {
    const payload: IqtreeJobPayload = { jobId };
    await boss.send(IQTREE_QUEUE, payload, {
      singletonKey: jobId,
      retryLimit: getJobRetryLimit(),
      retryBackoff: true,
      expireInSeconds: getJobExpireSeconds(),
    });
  }

  return NextResponse.json({ jobId }, { status: 201 });
}
