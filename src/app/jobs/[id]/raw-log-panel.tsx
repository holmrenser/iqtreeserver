import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface RawLogPanelProps {
  reportRaw: string | null;
  log: string | null;
}

export function RawLogPanel({ reportRaw, log }: RawLogPanelProps) {
  return (
    <Accordion>
      {reportRaw && (
        <AccordionItem value="report">
          <AccordionTrigger>Full .iqtree report</AccordionTrigger>
          <AccordionContent>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">{reportRaw}</pre>
          </AccordionContent>
        </AccordionItem>
      )}
      {log && (
        <AccordionItem value="log">
          <AccordionTrigger>Run log</AccordionTrigger>
          <AccordionContent>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">{log}</pre>
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  );
}
