import { Banknote, CalendarCheck, Car, Clock, Compass, Crown, Flag, Flame, FlaskConical, Medal, PartyPopper, Route, Sparkles, Target, Trophy, Wallet, type LucideIcon } from 'lucide-react';

// Presentation only: catalog IDs, rewards and persisted achievements stay unchanged.
const icons: Record<string, LucideIcon> = {
  first_ride: Car, first_shift: Clock, first_100: Banknote, first_1000: Wallet,
  rides_10: Car, rides_50: Target, rides_100: Medal, rides_500: Trophy,
  goal_hit: PartyPopper, streak_7: Flame, streak_30: CalendarCheck,
  km_1000: Route, km_5000: Route, visionary: Crown, visionary_shifts: Flag,
  founder: Medal, early_beta: FlaskConical, explorer: Compass,
};

export default function AchievementIcon({ id, className = '', size = 22 }: { id: string; className?: string; size?: number }) {
  const Icon = icons[id] ?? Sparkles;
  return <Icon aria-hidden="true" size={size} strokeWidth={2} className={`shrink-0 ${className}`} />;
}