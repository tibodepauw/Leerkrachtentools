import { redirect } from "next/navigation";
import { GENERATIVE_LABS_LEGAL } from "@/lib/legal/generativeLabs";

export default function ImprintPage() {
  redirect(GENERATIVE_LABS_LEGAL.imprint);
}
