import { Construction } from "lucide-react";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";

export function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <ModuleShell
      title={title}
      description={description}
      input={
        <EmptyOutput>
          <Construction className="mb-3 size-6" />
          Deze module wordt in de volgende implementatiestap geactiveerd.
        </EmptyOutput>
      }
      output={<EmptyOutput>Resultaten verschijnen hier.</EmptyOutput>}
    />
  );
}
