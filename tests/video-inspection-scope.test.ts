import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/prisma',()=>({prisma:{}}));
import { belongsToProduction } from '@/lib/mcp/video-review-operations';
describe('video inspection scope',()=>{
  it('permits only shots and assemblies attached to the selected production',()=>{
    expect(belongsToProduction({targetType:'video_shot',targetId:'shot-a'},'plan-a',['shot-a'])).toBe(true);
    expect(belongsToProduction({targetType:'video_shot',targetId:'shot-b'},'plan-a',['shot-a'])).toBe(false);
    expect(belongsToProduction({targetType:'video_assembly',targetId:'plan-a'},'plan-a',[])).toBe(true);
    expect(belongsToProduction({targetType:'video_assembly',targetId:'plan-b'},'plan-a',[])).toBe(false);
    expect(belongsToProduction({targetType:'brand_character',targetId:'plan-a'},'plan-a',[])).toBe(false);
  });
});
