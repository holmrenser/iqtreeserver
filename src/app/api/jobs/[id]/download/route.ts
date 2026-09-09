import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResultsZip } from "@/lib/storage";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const zip = await getResultsZip(prisma, id);
  if (!zip) {
    return NextResponse.json({ error: "Results not available for this job" }, { status: 404 });
  }

  // Prisma already reads the Bytes column fully into memory, so this is a
  // single buffered download, not a true chunked stream from Postgres - fine
  // at the sizes MAX_RESULTS_ZIP_BYTES allows; true streaming is the same
  // future trigger point as moving results off Postgres bytea (see
  // src/lib/storage.ts).
  return new NextResponse(new Uint8Array(zip.resultsZip), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="iqtree-${id}.zip"`,
      "Content-Length": String(zip.resultsZipBytes),
    },
  });
}
