import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Privacy · Leerkrachtentools",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12 sm:py-20">
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/"><ArrowLeft className="size-4" />Terug</Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Privacy en gegevensgebruik</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-7 text-neutral-300">
          <section>
            <h2 className="mb-2 font-semibold text-white">Wat we bewaren</h2>
            <p>We bewaren je geverifieerde e-mailadres, het tijdstip van verificatie, je optionele toestemming voor projectupdates en gehashte sessiegegevens. Verificatiecodes en IP-adressen worden uitsluitend gehasht opgeslagen. Codes worden uiterlijk na 24 uur verwijderd.</p>
          </section>
          <section>
            <h2 className="mb-2 font-semibold text-white">Waarom</h2>
            <p>Het e-mailadres is nodig om toegang te beveiligen en misbruik van betaalde AI-functies te beperken. Projectupdates worden uitsluitend gestuurd wanneer je daar afzonderlijk toestemming voor geeft.</p>
          </section>
          <section>
            <h2 className="mb-2 font-semibold text-white">Lesgegevens en AI-providers</h2>
            <p>De accountdatabase bewaart geen lesvoorbereidingen. De actieve lescontext staat lokaal in je browser. Wanneer je een AI-analyse uitvoert, wordt de noodzakelijke inhoud wel naar de geconfigureerde AI-provider gestuurd en geldt ook diens privacybeleid.</p>
          </section>
          <section>
            <h2 className="mb-2 font-semibold text-white">Jouw keuzes</h2>
            <p>In “Actieve les” kun je marketingtoestemming altijd intrekken en je account volledig verwijderen. Bij accountverwijdering wissen we het e-mailadres, de toestemming en alle serversessies onmiddellijk.</p>
          </section>
          <section>
            <h2 className="mb-2 font-semibold text-white">Beveiliging</h2>
            <p>Codes zijn eenmalig, tien minuten geldig en beperkt in aantal. Sessiecookies zijn HttpOnly en worden maximaal dertig dagen bewaard. Deel nooit leerlingnamen of andere persoonsgegevens wanneer dat niet nodig is.</p>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
