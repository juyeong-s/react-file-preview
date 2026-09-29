// Generates sample files for the playground (apps/playground/public/samples).
// Run with: pnpm fixtures
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import * as XLSX from 'xlsx';
import iconv from 'iconv-lite';

const out = new URL('../apps/playground/public/samples/', import.meta.url);
mkdirSync(out, { recursive: true });
const write = (name, data) => {
  writeFileSync(new URL(name, out), data);
  console.log('  ✓', name);
};

// --- PDF: 12 pages, mixed sizes, one page with its own /Rotate -------------
async function pdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  for (let i = 1; i <= 12; i++) {
    const landscape = i === 5;
    const page = doc.addPage(landscape ? [842, 595] : [595, 842]);
    if (i === 9) page.setRotation(degrees(90));
    const { width, height } = page.getSize();
    page.drawRectangle({ x: 0, y: height - 90, width, height: 90, color: rgb(0.23, 0.36, 0.86) });
    page.drawText(`react-file-preview sample`, { x: 40, y: height - 55, size: 22, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`Page ${i} of 12${landscape ? ' (landscape)' : ''}${i === 9 ? ' (/Rotate 90)' : ''}`, {
      x: 40,
      y: height - 130,
      size: 18,
      font: bold,
    });
    const lorem =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
    for (let l = 0; l < 24; l++) {
      page.drawText(`${l + 1}. ${lorem.slice(0, 70 + ((l * 7) % 40))}`, {
        x: 40,
        y: height - 170 - l * 22,
        size: 11,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
    }
    page.drawText(String(i), { x: width / 2 - 6, y: 30, size: 12, font });
  }
  write('sample.pdf', await doc.save());
}

// --- DOCX: headings, Korean text, table, page breaks ------------------------
async function docx() {
  const cell = (text, bold = false) =>
    new TableCell({
      width: { size: 3000, type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
    });
  const body = (text) => new Paragraph({ spacing: { after: 160 }, children: [new TextRun(text)] });
  const doc = new Document({
    creator: '@ruby-s/react-file-preview',
    title: 'Sample document',
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('분기 보고서 (Quarterly report)')] }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: '2026년 9월 · react-file-preview', italics: true, color: '656D76' })],
          }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('1. 개요')] }),
          body(
            '이 문서는 react-file-preview의 DOCX 렌더러를 확인하기 위한 샘플입니다. 한글과 English가 섞인 문단, 표, 페이지 나누기가 포함되어 있습니다.',
          ),
          body('The quick brown fox jumps over the lazy dog. '.repeat(6)),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('2. 실적 요약')] }),
          new Table({
            rows: [
              new TableRow({ children: [cell('항목', true), cell('Q2', true), cell('Q3', true)] }),
              new TableRow({ children: [cell('매출'), cell('1,200'), cell('1,540')] }),
              new TableRow({ children: [cell('영업이익'), cell('310'), cell('402')] }),
              new TableRow({ children: [cell('사용자 수'), cell('18,000'), cell('24,500')] }),
            ],
          }),
          body(''),
          ...Array.from({ length: 8 }, (_, i) =>
            body(`${i + 1}) 세부 내용 문단입니다. 페이지가 넘어가는 모습을 확인하기 위해 긴 텍스트를 반복합니다. `.repeat(3)),
          ),
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('3. 다음 분기 계획')] }),
          ...Array.from({ length: 6 }, (_, i) => body(`계획 ${i + 1}: ${'목표를 달성하기 위한 실행 항목입니다. '.repeat(4)}`)),
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('부록 (Appendix)')] }),
          body('Last page.'),
        ],
      },
    ],
  });
  write('sample.docx', await Packer.toBuffer(doc));
}

// --- XLSX: several sheets, merges, widths, numbers, a big sheet -------------
function xlsx() {
  const wb = XLSX.utils.book_new();
  const sales = [
    ['2026년 3분기 매출 현황', '', '', '', ''],
    ['지역', '7월', '8월', '9월', '합계'],
    ['서울', 1520000, 1610000, 1733000, null],
    ['부산', 830000, 790500, 912000, null],
    ['대구', 450000, 470000, 468250, null],
    ['인천', 612000, 655000, 701400, null],
    ['광주', 301000, 322000, 350900, null],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(sales);
  for (let r = 2; r <= 6; r++) ws1[`E${r + 1}`] = { t: 'n', f: `SUM(B${r + 1}:D${r + 1})`, v: sales[r].slice(1, 4).reduce((a, b) => a + b, 0) };
  for (const addr of Object.keys(ws1)) {
    if (!addr.startsWith('!') && ws1[addr].t === 'n') ws1[addr].z = '#,##0';
  }
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];
  ws1['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, '매출');

  const people = [['ID', 'Name', 'Team', 'Joined', 'Active', 'Score']];
  const teams = ['Platform', 'Design', 'Data', 'Mobile', 'Growth'];
  for (let i = 1; i <= 5000; i++) {
    people.push([i, `User ${String(i).padStart(4, '0')}`, teams[i % teams.length], new Date(2020, i % 12, (i % 27) + 1), i % 3 !== 0, Math.round(((i * 37) % 1000) / 10)]);
  }
  const ws2 = XLSX.utils.aoa_to_sheet(people, { cellDates: true });
  ws2['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 8 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Members (5000 rows)');

  const wide = [Array.from({ length: 60 }, (_, c) => `Col ${c + 1}`)];
  for (let r = 0; r < 200; r++) wide.push(Array.from({ length: 60 }, (_, c) => (r + 1) * (c + 1)));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wide), 'Wide');

  write('sample.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  write('sample-legacy.xls', XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }));
}

// --- CSV: UTF-8 and EUC-KR (Excel on Korean Windows) ------------------------
function csv() {
  const rows = [
    '이름,부서,입사일,연봉,사번',
    '김하늘,개발팀,2021-03-02,"52,000,000",000123',
    '이바다,디자인팀,2022-07-18,"48,500,000",000456',
    '박산,데이터팀,2019-11-04,"61,200,000",000789',
  ].join('\r\n');
  write('sample.csv', `${rows}\r\n`);
  write('sample-euckr.csv', iconv.encode(`${rows}\r\n`, 'euc-kr'));
}

// --- Images -----------------------------------------------------------------
function png() {
  const width = 640;
  const height = 400;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = y * (width * 4 + 1) + 1 + x * 4;
      const inCircle = (x - 320) ** 2 + (y - 200) ** 2 < 150 ** 2;
      raw[i] = Math.round((x / width) * 90 + 40);
      raw[i + 1] = Math.round((y / height) * 110 + 70);
      raw[i + 2] = 220;
      raw[i + 3] = inCircle ? 0 : 255; // transparent hole shows the checkerboard
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  write(
    'sample.png',
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

function svg() {
  write(
    'sample.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320">
  <rect width="480" height="320" rx="24" fill="#3b5bdb"/>
  <circle cx="160" cy="160" r="80" fill="#91a7ff"/>
  <rect x="260" y="90" width="140" height="140" rx="16" fill="#edf2ff"/>
  <text x="240" y="296" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#fff">react-file-preview</text>
</svg>
`,
  );
}

// --- Audio: 3 s sine sweep WAV ------------------------------------------------
function wav() {
  const rate = 22050;
  const seconds = 3;
  const samples = rate * seconds;
  const buf = Buffer.alloc(44 + samples * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const t = i / rate;
    const freq = 220 + 440 * (t / seconds);
    const fade = Math.min(1, t * 4, (seconds - t) * 4);
    buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * t) * 9000 * fade), 44 + i * 2);
  }
  write('sample.wav', buf);
}

// --- Text formats -------------------------------------------------------------
function text() {
  write(
    'sample.md',
    `# react-file-preview

One React component to preview **PDF, Word, Excel, images, video, audio and text**.

## 특징

- 100% 클라이언트 렌더링 — 파일이 외부 서버로 나가지 않습니다
- 포맷별 lazy-load
- compound 컴포넌트와 헤드리스 훅

| Format | Engine |
| --- | --- |
| PDF | pdf.js |
| DOCX | docx-preview |
| XLSX | SheetJS |

\`\`\`tsx
<FileViewer file={file} />
\`\`\`

> Links open in a new tab: [GitHub](https://github.com)

<script>alert('this is removed by the sanitizer')</script>
`,
  );
  write(
    'sample.json',
    JSON.stringify({ name: '@ruby-s/react-file-preview', version: '0.1.0', formats: ['pdf', 'docx', 'xlsx', 'csv', 'png', 'mp4', 'txt'], nested: { deep: { value: 42, list: [1, 2, 3] } } }),
  );
  write(
    'sample.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<catalog>\n  <book id="1">\n    <title>한글 제목</title>\n    <price>12000</price>\n  </book>\n  <book id="2">\n    <title>English title</title>\n    <price>9900</price>\n  </book>\n</catalog>\n`,
  );
  const levels = ['INFO', 'DEBUG', 'WARN', 'ERROR'];
  const lines = [];
  for (let i = 0; i < 20000; i++) {
    const ts = new Date(Date.UTC(2026, 8, 29, 0, 0, i)).toISOString();
    lines.push(`${ts} [${levels[i % 4]}] worker-${i % 8} request id=${(i * 7919) % 100000} took ${(i * 13) % 900}ms path=/api/v1/files/${i}/preview?format=pdf&size=large`);
  }
  write('sample.log', lines.join('\n'));
  write('sample.txt', '안녕하세요! 일반 텍스트 파일입니다.\nPlain text file.\n\n\tTabs and    spaces are kept.\n');
  write('unsupported.hwp', Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...Buffer.from('HWP Document File')]));
}

console.log('Generating samples →', out.pathname);
await pdf();
await docx();
xlsx();
csv();
png();
svg();
wav();
text();
