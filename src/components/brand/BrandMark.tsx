/**
 * BrandMark — Sprint 10.5 (Brand Polish).
 * Container oficial do símbolo Visionário: círculo perfeito, fundo AMOLED,
 * anel metálico hairline e glow verde discreto. Zero regra de negócio.
 *
 * NUNCA renderizar o logo cru em telas: sempre usar este componente.
 */
import { BRAND_ICON_URL } from '@/assets/branding/logo';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<Size, string> = {
  xs: 'h-8 w-8',
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
  xl: 'h-28 w-28',
};

interface Props {
  size?: Size;
  /** Glow discreto (padrão) ou nenhum. */
  glow?: 'none' | 'soft' | 'pulse';
  className?: string;
}

export default function BrandMark({ size = 'md', glow = 'soft', className = '' }: Props) {
  return (
    <span className={`relative inline-flex shrink-0 ${SIZES[size]} ${className}`}>
      {glow !== 'none' && (
        <span
          aria-hidden
          className={`absolute -inset-1 rounded-full bg-primary/15 blur-lg ${glow === 'pulse' ? 'animate-pulse-glow' : ''}`}
        />
      )}
      <span className="brand-ring relative inline-flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-background">
        <img
          src={BRAND_ICON_URL}
          alt=""
          draggable={false}
          decoding="async"
          className="h-full w-full select-none rounded-full object-contain"
        />
      </span>
    </span>
  );
}
