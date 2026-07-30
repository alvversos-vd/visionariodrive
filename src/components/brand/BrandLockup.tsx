/**
 * BrandLockup — Sprint 10.5 (Brand Polish).
 * Hierarquia oficial: Símbolo → Visionário Drive → tagline.
 * Usado em splash, login e telas de abertura. Zero regra de negócio.
 */
import BrandMark from './BrandMark';
import { BRAND_NAME, BRAND_TAGLINE } from '@/assets/branding/logo';

interface Props {
  size?: 'md' | 'lg' | 'xl';
  align?: 'center' | 'left';
  showTagline?: boolean;
  className?: string;
}

const TITLE: Record<NonNullable<Props['size']>, string> = {
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

export default function BrandLockup({
  size = 'lg',
  align = 'center',
  showTagline = true,
  className = '',
}: Props) {
  const centered = align === 'center';
  return (
    <div
      className={`flex flex-col gap-5 ${centered ? 'items-center text-center' : 'items-start text-left'} ${className}`}
    >
      <BrandMark size={size === 'md' ? 'lg' : 'xl'} glow="soft" />
      <div className={`space-y-2 ${centered ? '' : 'w-full'}`}>
        <h1
          className={`font-display font-semibold text-foreground leading-none tracking-[-0.03em] ${TITLE[size]}`}
        >
          {BRAND_NAME}
        </h1>
        {showTagline && (
          <p className="text-caption text-muted-foreground tracking-[0.12em] uppercase">
            {BRAND_TAGLINE}
          </p>
        )}
      </div>
    </div>
  );
}
