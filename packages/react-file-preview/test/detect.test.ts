import { describe, expect, it } from 'vitest';
import { extFromName, nameFromContentDisposition, nameFromUrl, resolveExt, sniff } from '../src/core/detect';

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])),
  );

describe('extFromName', () => {
  it('reads the extension, ignoring query strings and case', () => {
    expect(extFromName('Report.PDF')).toBe('pdf');
    expect(extFromName('/files/a.b/data.xlsx?v=2#x')).toBe('xlsx');
    expect(extFromName('README')).toBe('');
    expect(extFromName('.env')).toBe('');
  });
});

describe('nameFromUrl / nameFromContentDisposition', () => {
  it('decodes URL file names', () => {
    expect(nameFromUrl('https://x.com/a/%EB%B3%B4%EA%B3%A0%EC%84%9C.pdf?x=1')).toBe('보고서.pdf');
  });
  it('prefers filename* over filename', () => {
    expect(
      nameFromContentDisposition(`attachment; filename="report.pdf"; filename*=UTF-8''%EB%B3%B4%EA%B3%A0%EC%84%9C.pdf`),
    ).toBe('보고서.pdf');
    expect(nameFromContentDisposition('attachment; filename="data.xlsx"')).toBe('data.xlsx');
    expect(nameFromContentDisposition(null)).toBe('');
  });
});

describe('sniff', () => {
  it('recognises binary signatures', () => {
    expect(sniff(bytes('%PDF-1.7'))).toBe('pdf');
    expect(sniff(bytes(0x89, 'PNG', 0x0d, 0x0a))).toBe('png');
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpg');
    expect(sniff(bytes('GIF89a'))).toBe('gif');
    expect(sniff(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('webp');
    expect(sniff(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBe('wav');
    expect(sniff(bytes(0, 0, 0, 0x20, 'ftypisom'))).toBe('mp4');
    expect(sniff(bytes(0, 0, 0, 0x20, 'ftypM4A '))).toBe('m4a');
    expect(sniff(bytes('ID3', 3, 0))).toBe('mp3');
  });

  it('tells Office Open XML formats apart', () => {
    const zip = (entry: string) => bytes(0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, entry);
    expect(sniff(zip('word/document.xml'))).toBe('docx');
    expect(sniff(zip('xl/workbook.xml'))).toBe('xlsx');
    expect(sniff(zip('ppt/presentation.xml'))).toBe('pptx');
    expect(sniff(zip('images/a.png'))).toBe('zip');
  });

  it('recognises text flavours', () => {
    expect(sniff(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBe('svg');
    expect(sniff(bytes('<?xml version="1.0"?><root/>'))).toBe('xml');
    expect(sniff(bytes('{"a":1}'))).toBe('json');
    expect(sniff(new TextEncoder().encode('안녕하세요\nhello'))).toBe('txt');
    expect(sniff(bytes(0, 1, 2, 3, 4, 5))).toBeNull();
  });
});

describe('resolveExt', () => {
  it('trusts magic bytes over a wrong name', () => {
    expect(resolveExt('xls', '', 'xlsx')).toBe('xlsx');
    expect(resolveExt('png', 'image/png', 'pdf')).toBe('pdf');
  });
  it('keeps a more specific name for the same bytes', () => {
    expect(resolveExt('csv', '', 'txt')).toBe('csv');
    expect(resolveExt('md', '', 'txt')).toBe('md');
  });
  it('falls back to the name, then the MIME type', () => {
    expect(resolveExt('docx', '', null)).toBe('docx');
    expect(resolveExt('', 'application/pdf', null)).toBe('pdf');
  });
});
