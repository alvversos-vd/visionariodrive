/**
 * haptics — wrapper cross-platform.
 * No-op silencioso na web. Usa @capacitor/haptics quando disponível.
 * Zero regra de negócio.
 */
import { Capacitor } from '@capacitor/core';

type Impact = 'light' | 'medium' | 'heavy';

async function trigger(style: Impact): Promise<void> {
  if (!Capacitor.isNativePlatform?.()) return;
  try {
    const mod = await import('@capacitor/haptics');
    const map = { light: mod.ImpactStyle.Light, medium: mod.ImpactStyle.Medium, heavy: mod.ImpactStyle.Heavy };
    await mod.Haptics.impact({ style: map[style] });
  } catch {
    /* plugin opcional — sem ruído */
  }
}

export const haptics = {
  light: () => void trigger('light'),
  medium: () => void trigger('medium'),
  heavy: () => void trigger('heavy'),
};
