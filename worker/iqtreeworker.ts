import { WorkerRuntime } from "./runtime";
import { runIqtreeJob } from "./processors/iqtree";
import { IQTREE_QUEUE, type IqtreeJobPayload } from "../src/lib/queue";
import { sendJobNotification } from "../src/lib/email";

const runtime = new WorkerRuntime<IqtreeJobPayload>({
  queue: IQTREE_QUEUE,
  name: "iqtreeworker",
  process: (prisma, jobData) => runIqtreeJob(prisma, jobData.jobId),
  recordFailure: async (prisma, jobId, message) => {
    const row = await prisma.iqtreeJob.update({
      where: { id: jobId },
      data: { err: message, finished: new Date() },
    });

    if (row.notifyEmail) {
      await sendJobNotification({
        to: row.notifyEmail,
        jobId,
        alignmentFilename: row.alignmentFilename,
        outcome: "failed",
        errorMessage: message,
      });
    }
  },
});

runtime.run().catch((err) => {
  console.error("[iqtreeworker] fatal error during startup:", err);
  process.exit(1);
});
