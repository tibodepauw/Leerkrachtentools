import { Construction } from "lucide-react";
import { EmptyOutput, ModuleShell } from "@/components/shared/ModuleShell";
import type { ModuleId } from "@/types";

export function ModulePlaceholder({
  moduleId,
  title,
  description,
}: {
  moduleId: ModuleId;
  title: string;
  description: string;
}) {
  return (
    <ModuleShell
      moduleId={moduleId}
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
