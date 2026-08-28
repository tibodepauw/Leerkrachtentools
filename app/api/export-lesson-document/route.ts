import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  sessionFromRequest,
  unauthorizedResponse,
} from "@/lib/auth/guard";

export const runtime = "nodejs";

const exportSchema = z.object({
  topic: z.string().max(500),
  learningArea: z.string().max(500),
  component: z.string().max(500),
  targetGroup: z.string().max(500),
  materials: z.array(z.string().max(500)).max(100),
  goals: z
    .array(
      z.object({
        id: z.string().max(10),
        text: z.string().max(5_000),
        taxonomy: z.enum(["MC", "DAS", "SPM"]).optional(),
      }),
    )
    .max(12),
  totalMinutes: z.number().min(1).max(240),
  educationNetwork: z.enum(["ZILL", "OVSG", "GO"]),
  lessonPreparation: z.string().max(500_000),
});

function detail(label: string, value: string) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun(value || "Niet ingevuld"),
    ],
    spacing: { after: 100 },
  });
}

function preparationParagraphs(text: string) {
  if (!text.trim()) {
    return [
      new Paragraph({
        children: [new TextRun({ text: "Nog geen lesvoorbereiding ingevuld.", italics: true })],
      }),
    ];
  }

  return text.split(/\r?\n/u).map(
    (line) =>
      new Paragraph({
        children: [new TextRun(line || " ")],
        spacing: { after: line ? 100 : 0 },
      }),
  );
}

export async function POST(request: Request) {
  const session = sessionFromRequest(request);
  if (!session) return unauthorizedResponse();

  try {
    const lesson = exportSchema.parse(await request.json());
    const goals = lesson.goals.filter((goal) => goal.text.trim());
    const document = new Document({
      creator: "Leerkrachtentools",
      title: lesson.topic || "Actieve lesvoorbereiding",
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: lesson.topic || "Actieve lesvoorbereiding",
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 },
            }),
            new Paragraph({
              text: "Lescontext",
              heading: HeadingLevel.HEADING_1,
            }),
            detail("Leergebied", lesson.learningArea),
            detail("Onderdeel", lesson.component),
            detail("Doelgroep", lesson.targetGroup),
            detail("Onderwijsnet", lesson.educationNetwork),
            detail("Totale lestijd", `${lesson.totalMinutes} minuten`),
            detail(
              "Materialen",
              lesson.materials.length > 0
                ? lesson.materials.join(", ")
                : "Niet ingevuld",
            ),
            new Paragraph({
              text: "Lesdoelen",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 300 },
            }),
            ...(goals.length > 0
              ? goals.map(
                  (goal) =>
                    new Paragraph({
                      children: [
                        new TextRun({ text: `${goal.id}: `, bold: true }),
                        new TextRun(goal.text),
                        ...(goal.taxonomy
                          ? [
                              new TextRun({
                                text: ` (${goal.taxonomy})`,
                                italics: true,
                                color: "666666",
                              }),
                            ]
                          : []),
                      ],
                      spacing: { after: 140 },
                    }),
                )
              : [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Nog geen lesdoelen ingevuld.",
                        italics: true,
                      }),
                    ],
                  }),
                ]),
            new Paragraph({
              text: "Lesvoorbereiding",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 300 },
            }),
            ...preparationParagraphs(lesson.lessonPreparation),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(document);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition":
          'attachment; filename="actieve-lesvoorbereiding.docx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "De lesvoorbereiding bevat ongeldige gegevens."
            : "Het Word-document kon niet worden gemaakt.",
      },
      { status: 400 },
    );
  }
}
