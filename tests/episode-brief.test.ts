import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
import { episodeBriefOperations } from '../lib/mcp/episode-brief-operations';
const op = episodeBriefOperations[0];
const args = { planItemId: 'item', durationSeconds: 5, shots: [{ title: 'Opening', prompt: 'A fighter enters.', durationSeconds: 5 }] };
const txFor = (item: unknown) => ({ contentPlanItem: { findUniqueOrThrow: async () => item } });
const item = { itemType: 'video', status: 'planned', content: { body: 'Exact script' }, videoBrief: null };
describe('episode brief creation guard', () => {
  it('accepts a linked script and a complete timed shot list', async () => { await expect(op.guard!(args, txFor(item))).resolves.toBeUndefined(); });
  it('refuses to replace an existing storyboard', async () => { await expect(op.guard!(args, txFor({ ...item, videoBrief: { id: 'existing' } }))).rejects.toThrow('already exists'); });
  it('rejects missing scripts and inconsistent durations', async () => {
    await expect(op.guard!(args, txFor({ ...item, content: null }))).rejects.toThrow('saved script');
    await expect(op.guard!({ ...args, durationSeconds: 6 }, txFor(item))).rejects.toThrow('add up');
  });
});
