"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { iqtreeSubmissionSchema, type IqtreeSubmission } from "@/lib/iqtree/schema";
import { BASE_PATH } from "@/lib/basePath";

// react-hook-form's live field values follow the schema's *input* shape
// (fields with `.default(...)` are optional until resolved), while the
// resolver hands `onSubmit` the fully-defaulted *output* shape - RHF v7's
// third `useForm` generic expresses exactly this split.
type FormInput = z.input<typeof iqtreeSubmissionSchema>;
import { parseTaxaNames } from "@/lib/alignment/parseTaxa";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const DEFAULT_VALUES: IqtreeSubmission = {
  sequenceType: "AUTO",
  modelMode: { mode: "auto", criterion: "BIC" },
  branchSupport: {
    ultrafastBootstrap: { enabled: true, replicates: 1000 },
    shAlrt: { enabled: true, replicates: 1000 },
    abayes: false,
    standardBootstrap: { enabled: false, replicates: 100 },
  },
  partitionMode: "p",
  advanced: { bnni: false, asr: false },
};

interface JobSubmissionFormProps {
  /** Whether the server has SMTP configured - see src/lib/email.ts. */
  emailEnabled: boolean;
}

export function JobSubmissionForm({ emailEnabled }: JobSubmissionFormProps) {
  const router = useRouter();
  const [alignmentFile, setAlignmentFile] = useState<File | null>(null);
  const [partitionFile, setPartitionFile] = useState<File | null>(null);
  const [notifyEmail, setNotifyEmail] = useState("");
  const [taxa, setTaxa] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { control, register, handleSubmit, formState } = useForm<FormInput, unknown, IqtreeSubmission>({
    resolver: zodResolver(iqtreeSubmissionSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const modelMode = useWatch({ control, name: "modelMode.mode" });

  async function handleAlignmentChange(file: File | null) {
    setAlignmentFile(file);
    setTaxa(file ? parseTaxaNames(await file.text()) : []);
  }

  async function onSubmit(options: IqtreeSubmission) {
    setSubmitError(null);

    if (!alignmentFile) {
      setSubmitError("Please choose an alignment file.");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("options", JSON.stringify(options));
      form.set("alignment", alignmentFile, alignmentFile.name);
      if (partitionFile) form.set("partition", partitionFile, partitionFile.name);
      if (emailEnabled && notifyEmail.trim()) form.set("notifyEmail", notifyEmail.trim());

      const res = await fetch(`${BASE_PATH}/api/submit`, { method: "POST", body: form });
      const body = await res.json();

      if (!res.ok) {
        setSubmitError(body.error ?? "Submission failed.");
        setSubmitting(false);
        return;
      }

      router.push(`/jobs/${body.jobId}`);
    } catch {
      setSubmitError("Submission failed - check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Alignment</CardTitle>
          <CardDescription>FASTA, PHYLIP, NEXUS, Clustal, or MSF.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="alignment">Alignment file</Label>
            <Input
              id="alignment"
              type="file"
              accept=".fasta,.fa,.fas,.phy,.phylip,.nex,.nexus,.aln,.clustal,.msf"
              onChange={(e) => void handleAlignmentChange(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="partition">Partition file (optional, for multi-gene alignments)</Label>
            <Input
              id="partition"
              type="file"
              accept=".nex,.nexus,.txt,.part"
              onChange={(e) => setPartitionFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {partitionFile && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="partitionMode">Partition mode</Label>
              <Controller
                control={control}
                name="partitionMode"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="partitionMode" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="p">Edge-proportional (recommended default)</SelectItem>
                      <SelectItem value="q">Fully linked branch lengths</SelectItem>
                      <SelectItem value="Q">Fully unlinked branch lengths</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="outgroup">Outgroup (optional)</Label>
            <Controller
              control={control}
              name="outgroup"
              render={({ field }) => (
                <Select
                  value={field.value ?? "__none__"}
                  onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                  disabled={taxa.length === 0}
                >
                  <SelectTrigger id="outgroup" className="w-full">
                    <SelectValue placeholder="Unrooted" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (unrooted)</SelectItem>
                    {taxa.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {taxa.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Choose an alignment to populate this from its taxon names.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model selection</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sequenceType">Sequence type</Label>
            <Controller
              control={control}
              name="sequenceType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="sequenceType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Auto-detect</SelectItem>
                    <SelectItem value="DNA">DNA</SelectItem>
                    <SelectItem value="AA">Protein</SelectItem>
                    <SelectItem value="CODON">Codon</SelectItem>
                    <SelectItem value="BIN">Binary</SelectItem>
                    <SelectItem value="MORPH">Morphological</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <Controller
            control={control}
            name="modelMode.mode"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="auto" id="mode-auto" />
                  <Label htmlFor="mode-auto">Auto-select best model (ModelFinder)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="manual" id="mode-manual" />
                  <Label htmlFor="mode-manual">Specify a model</Label>
                </div>
              </RadioGroup>
            )}
          />

          {modelMode === "manual" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="model">Model (e.g. GTR+I+G4, LG+G4)</Label>
              <Input id="model" placeholder="GTR+I+G4" {...register("modelMode.model")} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branch support</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <BranchSupportRow
            control={control}
            register={register}
            enabledName="branchSupport.ultrafastBootstrap.enabled"
            replicatesName="branchSupport.ultrafastBootstrap.replicates"
            label="Ultrafast bootstrap"
          />
          <BranchSupportRow
            control={control}
            register={register}
            enabledName="branchSupport.shAlrt.enabled"
            replicatesName="branchSupport.shAlrt.replicates"
            label="SH-aLRT test"
          />
          <div className="flex items-center gap-2">
            <Controller
              control={control}
              name="branchSupport.abayes"
              render={({ field }) => (
                <Checkbox id="abayes" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
            <Label htmlFor="abayes">approximate Bayes (aBayes)</Label>
          </div>
        </CardContent>
      </Card>

      <Accordion>
        <AccordionItem value="advanced">
          <AccordionTrigger>Advanced options</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4">
            {modelMode === "auto" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="criterion">Model selection criterion</Label>
                  <Controller
                    control={control}
                    name="modelMode.criterion"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="criterion" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BIC">BIC</SelectItem>
                          <SelectItem value="AIC">AIC</SelectItem>
                          <SelectItem value="AICc">AICc</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="restrictSet">Restrict ModelFinder to (comma-separated, optional)</Label>
                  <Input id="restrictSet" placeholder="GTR,HKY,JC" {...register("modelMode.restrictSet")} />
                </div>
              </>
            )}

            <BranchSupportRow
              control={control}
              register={register}
              enabledName="branchSupport.standardBootstrap.enabled"
              replicatesName="branchSupport.standardBootstrap.replicates"
              label="Standard (non-parametric) bootstrap - slow, re-optimizes per replicate"
            />

            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="advanced.bnni"
                render={({ field }) => (
                  <Checkbox id="bnni" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="bnni">NNI-optimize UFBoot trees (-bnni)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="advanced.asr"
                render={({ field }) => (
                  <Checkbox id="asr" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="asr">Ancestral state reconstruction (-asr)</Label>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notifyEmail" className={!emailEnabled ? "text-muted-foreground" : undefined}>
          Email me when this job finishes (optional)
        </Label>
        <Input
          id="notifyEmail"
          type="email"
          placeholder="you@example.com"
          value={notifyEmail}
          onChange={(e) => setNotifyEmail(e.target.value)}
          disabled={!emailEnabled}
        />
        {!emailEnabled && (
          <p className="text-xs text-muted-foreground">
            Email notifications aren&apos;t configured on this server yet - this option is disabled. See{" "}
            <code className="rounded bg-muted px-1 py-0.5">docs/email-notifications.md</code> for what&apos;s needed
            to turn it on.
          </p>
        )}
      </div>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <Button type="submit" disabled={submitting || formState.isSubmitting}>
        {submitting ? "Submitting..." : "Run IQ-TREE"}
      </Button>
    </form>
  );
}

interface BranchSupportRowProps {
  control: ReturnType<typeof useForm<FormInput, unknown, IqtreeSubmission>>["control"];
  register: ReturnType<typeof useForm<FormInput, unknown, IqtreeSubmission>>["register"];
  enabledName: "branchSupport.ultrafastBootstrap.enabled" | "branchSupport.shAlrt.enabled" | "branchSupport.standardBootstrap.enabled";
  replicatesName: "branchSupport.ultrafastBootstrap.replicates" | "branchSupport.shAlrt.replicates" | "branchSupport.standardBootstrap.replicates";
  label: string;
}

function BranchSupportRow({ control, register, enabledName, replicatesName, label }: BranchSupportRowProps) {
  const enabled = useWatch({ control, name: enabledName });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name={enabledName}
          render={({ field }) => (
            <Checkbox
              id={enabledName}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor={enabledName}>{label}</Label>
      </div>
      {enabled && (
        <div className="ml-6 flex items-center gap-2">
          <Label htmlFor={replicatesName} className="text-xs text-muted-foreground">
            Replicates
          </Label>
          <Input
            id={replicatesName}
            type="number"
            className="w-28"
            {...register(replicatesName, { valueAsNumber: true })}
          />
        </div>
      )}
    </div>
  );
}
