import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Privacy · Leerkrachtentools",
};

export default function PrivacyPage() {
  const contactEmail = process.env.FEEDBACK_TO_EMAIL?.trim();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-12 sm:py-20">
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/">
          <ArrowLeft className="size-4 mr-2" />
          Terug
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Privacy- en Gegevensbeleid</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-sm leading-7 text-neutral-300">
          <section>
            <h2 className="mb-2 font-semibold text-white">1. Verwerkingsverantwoordelijke</h2>
            <p>
              Dit platform, Leerkrachtentools, wordt beheerd door Generative Labs (Tibo De Pauw). Voor vragen over de verwerking van je persoonsgegevens of het uitoefenen van je privacyrechten kun je contact opnemen
              {contactEmail ? (
                <>
                  {" "}
                  via{" "}
                  <a href={`mailto:${contactEmail}`} className="underline hover:text-white">
                    {contactEmail}
                  </a>
                </>
              ) : (
                " via het feedbackformulier in de app"
              )}
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-white">2. Wat we bewaren en waarom</h2>
            <p>
              We bewaren uitsluitend je geverifieerde e-mailadres, het tijdstip van verificatie, je optionele toestemming voor projectupdates en gehashte sessiegegevens.
            </p>
            <p className="mt-2">
              Verificatiecodes en IP-adressen worden uitsluitend gehasht opgeslagen. E-mailverificatiecodes zijn eenmalig, maximaal 10 minuten geldig en worden na uiterlijk 24 uur automatisch uit de database gewist.
            </p>
            <p className="mt-2">
              Verwerking van je e-mailadres is noodzakelijk voor de uitvoering van de dienst (beveiligen van toegang en voorkomen van misbruik). Projectupdates worden uitsluitend verzonden op basis van je expliciete voorafgaande toestemming.
            </p>
            <p className="mt-2">
              Wanneer je feedback verstuurt, verwerken we de inhoud van je bericht en, tenzij je voor anoniem kiest, je e-mailadres om je melding te behandelen. Technische feedback-rate-limitgegevens worden maximaal 90 dagen bewaard.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-white">3. E-mailverzending</h2>
            <p>
              Verificatiecodes worden verstuurd via Brevo (transactionele e-maildienst). Brevo verwerkt je e-mailadres en de verificatiecode uitsluitend als verwerker in opdracht van Leerkrachtentools om de inlogmail af te leveren.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-white">4. Lesgegevens, lokale opslag en AI-providers</h2>
            <p>
              Onze centrale accountdatabase bewaart <strong>geen</strong> lesvoorbereidingen, klasgegevens of ingediende teksten. De actieve lescontext staat uitsluitend lokaal opgeslagen in je eigen browser (via IndexedDB en lokale opslag).
            </p>
            <p className="mt-2">
              Wanneer je expliciet een AI-analyse uitvoert (bv. Doelverbeteraar, Taalfoutencheck of Audits), wordt uitsluitend de voor die specifieke actie benodigde tekst naar de geconfigureerde AI-provider verstuurd. Dit kan Google (Gemini), Groq, Cerebras, SambaNova of Cloudflare Workers AI zijn, afhankelijk van de instellingen.
            </p>
            <p className="mt-2">
              Bij een technische fout kan een aanvraag met serverkeys naar maximaal één andere geconfigureerde provider worden doorgestuurd. Met een eigen API-key wordt uitsluitend de door jou gekozen provider gebruikt.
            </p>
            <p className="mt-2">
              We configureren providerdiensten onder API- of enterprisevoorwaarden die ingediende gegevens niet voor algemene modeltraining gebruiken. De precieze bewaartermijn en verwerking door een provider volgen uit diens toepasselijke voorwaarden.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-white">5. Google Cloud Discovery Engine</h2>
            <p>
              Voor het zoeken in curriculumdoelen (leerplandoelen en Vlaamse minimumdoelen) verwerken we je zoekopdracht via Google Cloud Discovery Engine binnen onze afgeschermde Google Cloud-omgeving.
            </p>
            <p className="mt-2">
              Conform de enterprise-voorwaarden van Google Cloud worden je zoekopdrachten en prompts niet gebruikt voor algemene AI-model-training. Raadpleeg de{" "}
              <a
                href="https://cloud.google.com/terms/cloud-privacy-notice"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-white"
              >
                Google Cloud Privacy Notice
              </a>{" "}
              voor aanvullende details.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-white">6. Jouw rechten volgens de AVG (GDPR)</h2>
            <p>
              Als gebruiker heb je volgens de Europese Algemene Verordening Gegevensbescherming (AVG/GDPR) het recht op:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Inzage en correctie van je persoonsgegevens;</li>
              <li>Volledige wisting van je gegevens (recht op vergetelheid);</li>
              <li>Het intrekken van je toestemming voor updates;</li>
              <li>Overdraagbaarheid van je gegevens.</li>
            </ul>
            <p className="mt-2">
              Je kunt je account en alle geassocieerde serversessies op elk moment onmiddellijk wissen via de knop <strong>Account verwijderen</strong> in de instellingen van de applicatie.
              Daarbij probeert de app ook de gebruikersgebonden lesdata en documenten uit de huidige browser te verwijderen. Als de browser dit blokkeert, krijg je het advies de sitegegevens handmatig te wissen.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-white">7. Klachtrecht</h2>
            <p>
              Mocht je van mening zijn dat je gegevens niet correct worden verwerkt, dan heb je het recht om een klacht in te dienen bij de Belgische toezichthoudende autoriteit:
            </p>
            <p className="mt-1">
              <strong>Gegevensbeschermingsautoriteit (GBA)</strong><br />
              Drukpersstraat 35, 1000 Brussel<br />
              <a
                href="https://www.gegevensbeschermingsautoriteit.be"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-white"
              >
                www.gegevensbeschermingsautoriteit.be
              </a>
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-semibold text-white">8. Beveiliging en advies</h2>
            <p>
              Sessiecookies zijn beveiligd via HttpOnly en SameSite-vlaggen. We adviseren leerkrachten en studenten om bij het voorbereiden van lessen nooit rechtstreeks namen van individuele leerlingen of gevoelige persoonsgegevens in te voeren.
            </p>
          </section>
        </CardContent>
      </Card>
    </main>
  );
}