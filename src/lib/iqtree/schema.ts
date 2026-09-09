import { z } from "zod";

// Charset chosen to be safe as a raw CLI argument token (spawnSync receives an
// argv array, so this isn't a shell-injection guard - it's a guard against a
// crafted value being parsed as a flag or otherwise confusing iqtree3 itself).
const SAFE_TOKEN_REGEX = /^[A-Za-z0-9_.-]+$/;

export const sequenceTypeSchema = z
  .enum(["AUTO", "DNA", "AA", "CODON", "BIN", "MORPH"])
  .default("AUTO");

export const criterionSchema = z.enum(["BIC", "AIC", "AICc"]).default("BIC");

export const modelModeSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("auto"),
    criterion: criterionSchema,
    restrictSet: z
      .string()
      .max(200)
      .regex(/^[A-Za-z0-9_,+.-]+$/)
      .optional(),
  }),
  z.object({
    mode: z.literal("manual"),
    model: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[A-Za-z0-9_+{}.,-]+$/, "Model string contains unsupported characters"),
  }),
]);

const bootstrapReplicatesSchema = z.coerce.number().int();

export const branchSupportSchema = z
  .object({
    ultrafastBootstrap: z
      .object({
        enabled: z.boolean().default(false),
        replicates: bootstrapReplicatesSchema.min(1000).max(100_000).default(1000),
      })
      .default({ enabled: false, replicates: 1000 }),
    shAlrt: z
      .object({
        enabled: z.boolean().default(false),
        replicates: bootstrapReplicatesSchema.min(1000).max(100_000).default(1000),
      })
      .default({ enabled: false, replicates: 1000 }),
    abayes: z.boolean().default(false),
    standardBootstrap: z
      .object({
        enabled: z.boolean().default(false),
        replicates: bootstrapReplicatesSchema.min(100).max(10_000).default(100),
      })
      .default({ enabled: false, replicates: 100 }),
  })
  .superRefine((val, ctx) => {
    if (val.ultrafastBootstrap.enabled && val.standardBootstrap.enabled) {
      ctx.addIssue({
        code: "custom",
        message:
          "Ultrafast bootstrap (-B) and standard bootstrap (-b) cannot both be enabled - IQ-TREE disallows combining them.",
        path: ["standardBootstrap", "enabled"],
      });
    }
  });

export const partitionModeSchema = z.enum(["p", "q", "Q"]).default("p");

export const advancedOptionsSchema = z
  .object({
    bnni: z.boolean().default(false),
    asr: z.boolean().default(false),
  })
  .default({ bnni: false, asr: false });

export const iqtreeSubmissionSchema = z.object({
  sequenceType: sequenceTypeSchema,
  modelMode: modelModeSchema.default({ mode: "auto", criterion: "BIC" }),
  branchSupport: branchSupportSchema,
  partitionMode: partitionModeSchema,
  outgroup: z
    .string()
    .max(200)
    .regex(SAFE_TOKEN_REGEX, "Outgroup must be a plain taxon name (letters, digits, _ . -)")
    .optional(),
  advanced: advancedOptionsSchema,
});

export type IqtreeSubmission = z.infer<typeof iqtreeSubmissionSchema>;
export type ModelMode = z.infer<typeof modelModeSchema>;
export type BranchSupport = z.infer<typeof branchSupportSchema>;

/**
 * What actually gets stored in IqtreeJob.parameters: the validated options
 * plus everything the worker needs to re-materialize/re-validate the job,
 * and the seed used for reproducibility. Note `seed` is deliberately NOT an
 * input to computeJobId (src/lib/hash.ts) - it's assigned fresh per
 * submission, so including it in the dedup hash would defeat dedup entirely.
 */
export interface StoredJobParameters {
  options: IqtreeSubmission;
  alignmentSha256: string;
  partitionSha256: string | null;
  seed: number;
}
