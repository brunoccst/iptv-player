import { describe, expect, it } from 'vitest';
import { createXmltvReader, parseProgramme, parseXmltvTime, type GuideProgramme } from './xmltv';

const at = (iso: string) => Date.parse(iso);

describe('XMLTV guide (issue #119)', () => {
  it('reads times with and without an offset', () => {
    expect(parseXmltvTime('20261003201500 +0200')).toBe(at('2026-10-03T18:15:00Z'));
    expect(parseXmltvTime('20261003201500 -0130')).toBe(at('2026-10-03T21:45:00Z'));
    expect(parseXmltvTime('202610032015')).toBe(at('2026-10-03T20:15:00Z'));
    expect(parseXmltvTime('soon')).toBeNull();
  });

  it('reads a programme: channel, times, title with entities and CDATA; skips incomplete ones', () => {
    expect(
      parseProgramme(
        '<programme start="20261003200000 +0000" stop="20261003213000 +0000" channel="bbc.uk"><title lang="en">Tom &amp; Jerry&#39;s</title><desc>x</desc></programme>',
      ),
    ).toEqual({ channel: 'bbc.uk', start: at('2026-10-03T20:00:00Z'), stop: at('2026-10-03T21:30:00Z'), title: "Tom & Jerry's" });
    expect(
      parseProgramme("<programme channel='a' start='20261003200000' stop='20261003210000'><title><![CDATA[F1 <Live>]]></title></programme>")
        ?.title,
    ).toBe('F1 <Live>');
    expect(parseProgramme('<programme channel="a" start="20261003200000" stop="20261003210000"></programme>')).toBeNull();
    expect(parseProgramme('<programme start="20261003200000" stop="20261003210000"><title>x</title></programme>')).toBeNull();
  });

  it('reads pieces cut anywhere and keeps only programmes in the window', () => {
    const programme = (channel: string, start: string, stop: string, title: string) =>
      `<programme start="${start} +0000" stop="${stop} +0000" channel="${channel}">\n  <title>${title}</title>\n</programme>\n`;
    const xml =
      '<?xml version="1.0"?><tv><channel id="a"><display-name>A</display-name></channel>' +
      programme('a', '20261003180000', '20261003190000', 'Over') +
      programme('a', '20261003193000', '20261003203000', 'Now') +
      programme('b', '20261004100000', '20261004110000', 'Tomorrow') +
      programme('b', '20261006100000', '20261006110000', 'Too late') +
      '</tv>';
    const window = { from: at('2026-10-03T20:00:00Z'), to: at('2026-10-04T20:00:00Z') };
    for (const size of [1, 7, 64, xml.length]) {
      const found: GuideProgramme[] = [];
      const reader = createXmltvReader(window, (p) => found.push(p));
      for (let i = 0; i < xml.length; i += size) reader.feed(xml.slice(i, i + size));
      expect(found.map((p) => p.title)).toEqual(['Now', 'Tomorrow']);
      expect(reader.seen).toBe(4);
    }
  });
});
