import { JobSubmissionForm } from "@/components/forms/job-submission-form";
import { isEmailConfigured } from "@/lib/email";

// isEmailConfigured() reads real runtime env - without this, Next would
// statically prerender the page once at build time (no real env available
// then, see src/lib/env.ts) and freeze emailEnabled at whatever that was,
// never reflecting SMTP_HOST actually being set later at deploy time.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">iqtreeserver</h1>
        <p className="text-sm text-muted-foreground">
          Submit a multiple sequence alignment and run phylogenetic inference with IQ-TREE.
        </p>
      </div>
      <JobSubmissionForm emailEnabled={isEmailConfigured()} />
    </main>
  );
}
