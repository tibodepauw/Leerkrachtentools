import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  GENERATIVE_LABS_LEGAL,
  LEGAL_NAV_ITEMS,
} from "@/lib/legal/generativeLabs";

export function LegalExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "underline underline-offset-2 hover:text-neutral-200",
        className,
      )}
    >
      {children}
    </a>
  );
}

export function LegalConsentLine({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-5 text-neutral-500", className)}>
      Door in te loggen ga je akkoord met onze{" "}
      <LegalExternalLink href={GENERATIVE_LABS_LEGAL.terms}>
        Algemene Voorwaarden
      </LegalExternalLink>{" "}
      en ons{" "}
      <LegalExternalLink href={GENERATIVE_LABS_LEGAL.privacy}>
        Privacybeleid
      </LegalExternalLink>
      .
    </p>
  );
}

export function LegalDocumentNav({
  className,
  linkClassName,
}: {
  className?: string;
  linkClassName?: string;
}) {
  return (
    <nav aria-label="Juridische informatie" className={className}>
      {LEGAL_NAV_ITEMS.map((item) => (
        <LegalExternalLink
          key={item.href}
          href={item.href}
          className={linkClassName}
        >
          {item.label}
        </LegalExternalLink>
      ))}
    </nav>
  );
}
