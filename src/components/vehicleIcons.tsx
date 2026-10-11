import { createLucideIcon } from 'lucide-react';

// Local presentation glyphs use Lucide's sizing, currentColor and stroke defaults.
export const MotorcycleIcon = createLucideIcon('Motorcycle', [
  ['circle', { cx: '5', cy: '17', r: '3', key: 'rear' }],
  ['circle', { cx: '19', cy: '17', r: '3', key: 'front' }],
  ['path', { d: 'M19 17 15 6h-3M15 6h3M3 10h5l3 3h5M5 17l4-4h5l-2 4H5M8 10l2-2h4', key: 'body' }],
]);

export const ElectricBikeIcon = createLucideIcon('ElectricBike', [
  ['circle', { cx: '5.5', cy: '17.5', r: '3.5', key: 'rear' }],
  ['circle', { cx: '18.5', cy: '17.5', r: '3.5', key: 'front' }],
  ['path', { d: 'M15 6h2l1.5 11.5M5.5 17.5l5-8 3 8H5.5L15.5 9M8.5 9.5h4', key: 'frame' }],
  ['path', { d: 'm21 2-3 4h4l-3 4', key: 'energy' }],
]);