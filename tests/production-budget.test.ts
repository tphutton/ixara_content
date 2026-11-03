import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/prisma', () => ({prisma:{}}));
import { summarizeReservations } from '@/lib/mcp/production-budget';

describe('production budget reservations', () => {
  it('counts all Runway reservations, including cancelled and failed jobs', () => {
    const result = summarizeReservations(300, [
      {id:'a',status:'succeeded',targetType:'video_shot',input:{estimatedCredits:60}},
      {id:'b',status:'cancelled',targetType:'character_speech',input:{estimatedCredits:10}},
      {id:'c',status:'failed',targetType:'video_shot',input:{estimatedCredits:30}},
    ]);
    expect(result.reservedCredits).toBe(100);
    expect(result.remainingCredits).toBe(200);
  });
  it('does not imply there is an available budget when none is set', () => {
    expect(summarizeReservations(null, []).remainingCredits).toBeNull();
  });
});
