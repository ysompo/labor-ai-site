import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType,
} from 'docx';
import ExcelJS from 'exceljs';
import type { ChatMessage } from '@/lib/research/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProtocolSection {
  heading: string;
  content: string;
}

interface ProtocolVariable {
  name: string;         // English variable name / column header
  display_he: string;   // Hebrew display label
  type: string;         // continuous | categorical | binary | date | text
  notes: string;        // free notes
}

interface ExtractedProtocol {
  title_he: string;
  title_en: string;
  study_type: 'retrospective' | 'rct' | 'other';
  sections: ProtocolSection[];
  variables: ProtocolVariable[];
}

// ─── Extraction prompt ───────────────────────────────────────────────────────

const EXTRACTION_SYSTEM = `
You are a data-extraction assistant. Given a research protocol conversation, output ONLY valid JSON (no markdown fences, no extra text) matching this exact schema:

{
  "title_he": "<Hebrew title of the study>",
  "title_en": "<English title of the study>",
  "study_type": "retrospective" | "rct" | "other",
  "sections": [
    { "heading": "<section heading in Hebrew>", "content": "<full section body in Hebrew, plain text, preserve paragraph breaks with \\n\\n>" }
  ],
  "variables": [
    { "name": "<snake_case English variable name>", "display_he": "<Hebrew label>", "type": "<continuous|categorical|binary|date|text>", "notes": "<any notes, or empty string>" }
  ]
}

Rules:
- Include ALL sections that appear in the protocol.
- For variables: extract every data variable mentioned as needed for the study. Use snake_case English names even if the conversation is in Hebrew.
- If title is unknown use "פרוטוקול מחקר" / "Research Protocol".
- Output ONLY the JSON object. No code blocks.
`.trim();

// ─── DOCX generator ──────────────────────────────────────────────────────────

async function buildDocx(proto: ExtractedProtocol): Promise<Buffer> {
  const purple = '4B2E6A';

  const titleParagraphs = [
    new Paragraph({
      text: proto.title_he,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    ...(proto.title_en ? [new Paragraph({
      children: [new TextRun({ text: proto.title_en, italics: true, size: 22, color: '555555' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    })] : []),
    new Paragraph({
      children: [
        new TextRun({ text: `סוג מחקר: `, bold: true, size: 20 }),
        new TextRun({
          text: proto.study_type === 'rct' ? 'מחקר מבוקר אקראי (RCT)'
               : proto.study_type === 'retrospective' ? 'מחקר רטרוספקטיבי'
               : 'אחר',
          size: 20,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
    }),
  ];

  const sectionParagraphs = proto.sections.flatMap(s => [
    new Paragraph({
      text: s.heading,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: purple } },
    }),
    ...s.content.split('\n\n').map(para =>
      new Paragraph({
        children: [new TextRun({ text: para.trim(), size: 20 })],
        spacing: { after: 160 },
        alignment: AlignmentType.BOTH,
      })
    ),
  ]);

  const disclaimerParagraph = new Paragraph({
    children: [
      new TextRun({
        text: '⚠ פרוטוקול זה נוצר בסיוע Labor-AI לצרכי עזר בלבד. כל תוכן טעון אישור מנחה בכיר, ועדת הלסינקי ומשפטן מוסדי לפני הגשה.',
        italics: true,
        size: 18,
        color: '888888',
      }),
    ],
    spacing: { before: 480 },
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: 'dddddd' } },
  });

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'David', size: 22 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children: [...titleParagraphs, ...sectionParagraphs, disclaimerParagraph],
    }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// ─── XLSX generator ──────────────────────────────────────────────────────────

async function buildXlsx(proto: ExtractedProtocol): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: Variables template (data collection sheet)
  const ws1 = wb.addWorksheet('משתני המחקר');
  ws1.addRow(proto.variables.map(v => v.name));
  ws1.addRow(proto.variables.map(v => v.display_he));
  ws1.addRow(proto.variables.map(v => v.type));
  ws1.addRow(proto.variables.map(v => v.notes));
  for (let i = 0; i < 20; i++) ws1.addRow(proto.variables.map(() => ''));

  ws1.columns = proto.variables.map(() => ({ width: 20 }));
  ws1.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

  // Sheet 2: Variable dictionary
  const ws2 = wb.addWorksheet('מילון משתנים');
  ws2.addRow(['Variable Name (EN)', 'שם המשתנה (עברית)', 'סוג המשתנה', 'הערות']);
  proto.variables.forEach(v => ws2.addRow([v.name, v.display_he, v.type, v.notes]));
  ws2.columns = [{ width: 25 }, { width: 30 }, { width: 18 }, { width: 40 }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured.' }, { status: 503 });
  }

  const body = await req.json() as {
    messages: ChatMessage[];
    format: 'docx' | 'xlsx';
  };

  const { messages, format } = body;
  if (!messages?.length) return Response.json({ error: 'No messages' }, { status: 400 });

  // ── 1. Extract structured protocol from conversation ──────────────────────
  const client = new Anthropic({ apiKey });

  const conversation = messages
    .map(m => `${m.role === 'user' ? 'חוקר' : 'Labor-AI'}: ${m.content}`)
    .join('\n\n');

  let proto: ExtractedProtocol;
  try {
    const extraction = await client.messages.create({
      model: process.env.RESEARCH_ASSISTANT_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: 'user', content: `שיחה:\n\n${conversation}` }],
    });

    const raw = extraction.content.find(b => b.type === 'text')?.text ?? '{}';
    // Strip any accidental code fences
    const clean = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    proto = JSON.parse(clean) as ExtractedProtocol;
  } catch {
    return Response.json({ error: 'Failed to extract protocol structure from conversation.' }, { status: 500 });
  }

  // ── 2. Generate requested file ────────────────────────────────────────────
  if (format === 'docx') {
    const buf = await buildDocx(proto);
    const filename = encodeURIComponent(`${proto.title_en || 'research-protocol'}.docx`);
    return new Response(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      },
    });
  }

  if (format === 'xlsx') {
    const buf = await buildXlsx(proto);
    const filename = encodeURIComponent(`${proto.title_en || 'research-variables'}.xlsx`);
    return new Response(buf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      },
    });
  }

  return Response.json({ error: 'Invalid format' }, { status: 400 });
}
