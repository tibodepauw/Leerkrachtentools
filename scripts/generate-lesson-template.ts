import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

function line(text: string, options?: { bold?: boolean; spacing?: number }) {
  return new Paragraph({
    children: [new TextRun({ text, bold: options?.bold })],
    spacing: { after: options?.spacing ?? 120 },
  });
}

function labeledLine(label: string, value = "") {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun(value || " "),
    ],
    spacing: { after: 120 },
  });
}

function goalBlock(number: number) {
  return [
    line(`▪ LESDOEL ${number} (MC-DAS-SPM):`, { bold: true }),
    line("Gekoppeld aan minimumdoel:"),
    line(
      "Gekoppeld aan leerplandoel ZILL van het Katholiek Onderwijs – Leerlokaal van OVSG – leerplan van het GO",
    ),
    line(""),
  ];
}

async function main() {
  const document = new Document({
    creator: "Thomas More / Leerkrachtentools",
    title: "Lesvoorbereidingsformulier",
    sections: [
      {
        properties: {},
        children: [
          labeledLine("Naam student"),
          labeledLine("Stageklas"),
          labeledLine("Stageschool"),
          labeledLine("Aantal leerlingen"),
          line("Lesspecifieke beginsituatie", { bold: true, spacing: 200 }),
          line("Lesspecifieke beginsituatie van de klasgroep"),
          line("▪ Relevante voorkennis en vaardigheden"),
          line("▪ Interesses/leefwereld/actua"),
          line("▪ Specifieke onderwijsbehoeften"),
          line(
            "Andere: bijv. materiële infrastructuur – klas/schoolorganisatie – situationele aspecten",
          ),
          line("Doelen", { bold: true, spacing: 200 }),
          line(
            "Laat bij elk lesdoel enkel het juiste soort lesdoel (MC-DAS-SPM) staan. Laat enkel het leerplan dat van toepassing is staan (2 en 3 balo).",
          ),
          line(
            "Raadpleeg www.onderwijsdoelen.be voor de minimumdoelen. Vind je geen passend minimumdoel? Noteer dan ‘niet gevonden’.",
          ),
          ...goalBlock(1),
          ...goalBlock(2),
          ...goalBlock(3),
          line("Leerinhoud met bijhorende bronnen", { bold: true, spacing: 200 }),
          line("Bronnen leerinhoud"),
          line("▪"),
          line(
            "1 Voor de lessen LO, hoekenwerk en contractwerk zijn er aparte sjablonen. Je vindt deze in bijlage bij de handleiding.",
          ),
          new Paragraph({
            children: [new TextRun({ text: "Lesvoorbereidingsformulier", bold: true })],
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 200 },
          }),
          line("Academiejaar 2025-2026", { bold: true }),
          line("Situering van de les", { bold: true, spacing: 200 }),
          labeledLine("Leergebied"),
          labeledLine("Onderdeel"),
          labeledLine("Lesonderwerp"),
          labeledLine("Datum"),
          labeledLine("Tijdstip", "… uur - … uur"),
          line("Bronnen lesconcept", { bold: true, spacing: 240 }),
          line(
            "Welke bronnen gebruikte je voor het vormgeven van het lesconcept? Duid en vul aan.",
          ),
          line("▪ hogeschoolles: ..."),
          line("▪ methode/handleiding: ..."),
          line("▪ lesvoorbereiding medestudent: ..."),
          line("▪ internetbron(nen): …."),
          line("Betrokkenheidsverhogende factoren", { bold: true, spacing: 240 }),
          line(
            "Markeer de betrokkenheidsverhogende factoren die je in deze les extra inzet.",
          ),
          line("Lesopbouw (onderwijs- en leeractiviteiten, organisatie, bordgebruik en materiaal)", {
            bold: true,
            spacing: 240,
          }),
          line("Fase 1: Instapfase: … (timing)"),
          line("1.1 … (timing)"),
          line("[Bordschema]"),
          line("Materiaal:"),
          line("Fase 2: Instructiefase: … (timing)"),
          line("2.1 … (timing)"),
          line("[Bordschema]"),
          line("Materiaal:"),
          line("Fase 3: Verwerkingsfase: … (timing)"),
          line("3.1 … (timing)"),
          line("[Bordschema]"),
          line("Materiaal:"),
          line("Fase 4: Afrondingsfase: … (timing)"),
          line("4.1 … (timing)"),
          line("[Bordschema]"),
          line("Materiaal:"),
          line("Overzicht bijlagen", { bold: true, spacing: 240 }),
          line(
            "▪ Bijlage 1: Leesbare kopie van de bron (handleiding, lesvoorbereiding mentor, hogeschoolles) niet enkel het werkboek!",
          ),
          line("▪ Bijlage 2: Correctiesleutel werkblaadje(s) leerlingen"),
          line("▪ Bijlage 3: …"),
          line("Zelfevaluatie (na de lesrealisatie)", { bold: true, spacing: 240 }),
          line("2. Doelgerichtheid", { bold: true }),
          line("D1"),
          line("D2"),
          line("D3"),
          line("Reflectie (na de lesrealisatie)", { bold: true, spacing: 240 }),
          line(
            "Wat leerde deze les je over jezelf als leerkracht?",
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);
  const directory = path.join(process.cwd(), "data", "templates");
  mkdirSync(directory, { recursive: true });
  const target = path.join(directory, "lesvoorbereidingsformulier_2526DEF-1.docx");
  writeFileSync(target, buffer);
  console.log(`Template written to ${target} (${buffer.byteLength} bytes)`);
}

void main();
