import { describe, expect, it, vi } from 'vitest';
import { NotAJsonArray, readJsonArray } from './jsonStream';

/** `text` as a byte stream cut into `size`-byte chunks (cuts can fall inside a UTF-8 character). */
function streamOf(text: string, size: number): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + size));
      offset += size;
    },
  });
}

const all = (value: unknown) => value;
const none = () => [];

describe('reading a JSON array one element at a time (D-113)', () => {
  const list = [
    { stream_id: 1, name: 'Amélie [4K] {EN}', extra: { a: [1, 2, { b: '}' }] } },
    { stream_id: '2', name: 'Say "hi" \\ bye', tags: [] },
    { stream_id: 3, name: '日本の映画 😀', cover: null },
  ];
  const json = `\uFEFF  ${JSON.stringify(list, null, 1)}  `;

  it('gives the same elements whatever the chunk size, also with characters cut between chunks', async () => {
    for (const size of [1, 2, 3, 7, 64, 100_000]) {
      const { items } = await readJsonArray(streamOf(json, size), all, none);
      expect(items).toEqual(list);
    }
  });

  it('keeps only what pick returns', async () => {
    const { items, chars } = await readJsonArray(
      streamOf(JSON.stringify(list), 5),
      (item) => ((item as { stream_id: unknown }).stream_id === 3 ? null : (item as { name: string }).name),
      none,
    );
    expect(items).toEqual(['Amélie [4K] {EN}', 'Say "hi" \\ bye']);
    expect(chars).toBe(JSON.stringify(list).length);
  });

  it('reads arrays of plain values and empty arrays', async () => {
    const boxed = (value: unknown) => ({ value });
    const values = (await readJsonArray(streamOf('[1, "a,]", true,null ,2.5]', 2), boxed, none)).items.map((item) => item.value);
    expect(values).toEqual([1, 'a,]', true, null, 2.5]);
    expect((await readJsonArray(streamOf('[]', 1), all, none)).items).toEqual([]);
    expect((await readJsonArray(streamOf('', 1), all, none)).items).toEqual([]);
  });

  it('hands a reply that is not an array to `other`, and refuses one that is not JSON', async () => {
    const { items } = await readJsonArray(streamOf('{"1": {"stream_id": 9}}', 3), all, (value) => Object.values(value as object));
    expect(items).toEqual([{ stream_id: 9 }]);
    await expect(readJsonArray(streamOf('<html>max connections</html>', 4), all, none)).rejects.toBeInstanceOf(NotAJsonArray);
    await expect(readJsonArray(streamOf('[{"a": 1}, {"b"', 4), all, none)).rejects.toBeInstanceOf(NotAJsonArray);
  });

  describe('in batches parsed at once', () => {
    // Like a provider's list: no spaces, many entries.
    const entries = Array.from({ length: 60 }, (_, i) => ({ stream_id: i, name: `EN - Film ${i} ü`, category_ids: [i % 4] }));
    const compact = JSON.stringify(entries);

    it('gives the same elements with far fewer parses than elements', async () => {
      for (const size of [1, 5, 64, 100_000]) {
        const parse = vi.spyOn(JSON, 'parse');
        const { items } = await readJsonArray(streamOf(compact, size), all, none, { batchChars: 600 });
        expect(items).toEqual(entries);
        expect(parse.mock.calls.length).toBeLessThan(entries.length / 5);
        parse.mockRestore();
      }
    });

    it('gives the same elements when "},{" appears inside a name or a nested object', async () => {
      const tricky = entries.map((entry, i) => (i % 5 === 0 ? { ...entry, name: `A},{B ${i}`, info: [{ a: 1 }, { b: 2 }] } : entry));
      for (const size of [1, 7, 100_000]) {
        for (const batchChars of [10, 50, 300]) {
          const { items } = await readJsonArray(streamOf(JSON.stringify(tricky), size), all, none, { batchChars });
          expect(items).toEqual(tricky);
        }
      }
    });

    it('ignores text after the closing bracket, and still refuses a cut-off list', async () => {
      expect((await readJsonArray(streamOf(`${compact}\n<!-- cached -->`, 64), all, none, { batchChars: 200 })).items).toEqual(entries);
      await expect(readJsonArray(streamOf(compact.slice(0, -40), 64), all, none, { batchChars: 200 })).rejects.toBeInstanceOf(
        NotAJsonArray,
      );
    });
  });
});
