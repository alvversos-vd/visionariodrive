import { expect, it } from 'vitest';
import { positionTutorial } from './position';

it('positions a tip below a real target without overlapping', () => {
  const target = { left: 40, top: 100, width: 280, height: 100 };
  const result = positionTutorial(target, { width: 320, height: 220 }, { left: 0, top: 0, width: 360, height: 800 });
  expect(result.highlight).toEqual(target);
  expect(result.top).toBe(216);
});
it('does not highlight oversized, absent or offscreen targets', () => {
  const viewport = { left: 0, top: 0, width: 360, height: 420 };
  const panel = { width: 328, height: 260 };
  expect(positionTutorial(null, panel, viewport).highlight).toBeNull();
  expect(positionTutorial({ left: 16, top: 16, width: 328, height: 380 }, panel, viewport).highlight).toBeNull();
  expect(positionTutorial({ left: 20, top: -50, width: 100, height: 30 }, panel, viewport).highlight).toBeNull();
});