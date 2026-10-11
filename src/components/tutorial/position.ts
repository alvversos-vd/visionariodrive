export interface TutorialRect { left: number; top: number; width: number; height: number }
export interface TutorialViewport { left: number; top: number; width: number; height: number }

/** Presentation geometry only. A missing/oversized target is never substituted. */
export function positionTutorial(target: TutorialRect | null, panel: { width: number; height: number }, viewport: TutorialViewport) {
  const gap = 16;
  const minX = viewport.left + gap;
  const minY = viewport.top + gap;
  const maxX = viewport.left + viewport.width - gap;
  const maxY = viewport.top + viewport.height - gap;
  const clampX = (x: number) => Math.max(minX, Math.min(x, maxX - panel.width));
  const clampY = (y: number) => Math.max(minY, Math.min(y, maxY - panel.height));
  if (target && target.width > 0 && target.height > 0 && target.left >= minX && target.top >= minY && target.left + target.width <= maxX && target.top + target.height <= maxY) {
    const x = clampX(target.left + target.width / 2 - panel.width / 2);
    if (target.top + target.height + gap + panel.height <= maxY) return { left: x, top: target.top + target.height + gap, highlight: target };
    if (target.top - gap - panel.height >= minY) return { left: x, top: target.top - gap - panel.height, highlight: target };
    const y = clampY(target.top);
    if (target.left + target.width + gap + panel.width <= maxX) return { left: target.left + target.width + gap, top: y, highlight: target };
    if (target.left - gap - panel.width >= minX) return { left: target.left - gap - panel.width, top: y, highlight: target };
  }
  return { left: clampX(viewport.left + (viewport.width - panel.width) / 2), top: clampY(viewport.top + (viewport.height - panel.height) / 2), highlight: null };
}