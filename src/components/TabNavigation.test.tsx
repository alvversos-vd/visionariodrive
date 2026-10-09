import { fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Home, Wallet } from 'lucide-react';
import TabNavigation from './TabNavigation';

const mobile = vi.hoisted(() => ({ value: true }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mobile.value }));
const items = [
  { key: 'home', label: 'Início', icon: Home },
  { key: 'financial', label: 'Financeiro', icon: Wallet },
];
afterEach(() => { cleanup(); mobile.value = true; });

describe('TabNavigation interactions', () => {
  it('starts closed, delegates the original destination and closes after selection', async () => {
    const select = vi.fn();
    render(<TabNavigation items={items} current={items[0]} onSelect={select} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu de navegação' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Financeiro' }));
    expect(select).toHaveBeenCalledExactlyOnceWith('financial');
    await waitFor(() => expect(screen.queryByRole('navigation')).not.toBeInTheDocument());
  });

  it('closes on Escape without navigating and stays closed after the selected section changes', async () => {
    const select = vi.fn();
    const { rerender } = render(<TabNavigation items={items} current={items[0]} onSelect={select} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu de navegação' }));
    await screen.findByRole('navigation');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('navigation')).not.toBeInTheDocument());
    expect(select).not.toHaveBeenCalled();
    rerender(<TabNavigation items={items} current={items[1]} onSelect={select} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('keeps all destinations directly available on desktop', () => {
    mobile.value = false;
    const select = vi.fn();
    render(<TabNavigation items={items} current={items[0]} onSelect={select} />);
    fireEvent.click(screen.getByRole('button', { name: 'Financeiro' }));
    expect(select).toHaveBeenCalledExactlyOnceWith('financial');
  });
});