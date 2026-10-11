import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InteractiveTutorial from './InteractiveTutorial';
import { getTutorialStatus } from '@/lib/engagement';

const props = { userId: 'a', eligible: true, suspended: false, activeShift: false, gps: false, currentTab: 'home', onNavigate: vi.fn(), onRestore: vi.fn() };
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  const host = document.createElement('div'); host.id = 'tutorial-help-host'; document.body.append(host);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); document.getElementById('tutorial-help-host')?.remove(); vi.unstubAllGlobals(); });

describe('separate tutorial experience', () => {
  it('waits for onboarding and blocking flow eligibility', () => {
    const view = render(<InteractiveTutorial {...props} eligible={false} />);
    expect(screen.queryByRole('region', { name: 'Apresentação do tutorial' })).not.toBeInTheDocument();
    view.rerender(<InteractiveTutorial {...props} suspended />);
    expect(screen.queryByRole('region', { name: 'Apresentação do tutorial' })).not.toBeInTheDocument();
    view.rerender(<InteractiveTutorial {...props} />);
    expect(screen.getByRole('region', { name: 'Apresentação do tutorial' })).toBeInTheDocument();
  });
  it('defers once across renders and remounts, but permits manual reopening', () => {
    const view = render(<InteractiveTutorial {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }));
    view.rerender(<InteractiveTutorial {...props} />);
    expect(getTutorialStatus('a')).toBe('deferred');
    view.unmount();
    render(<InteractiveTutorial {...props} />);
    expect(screen.queryByRole('region', { name: 'Apresentação do tutorial' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ajuda e tutorial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar tutorial' }));
    expect(getTutorialStatus('a')).toBe('in_progress');
    expect(props.onNavigate).toHaveBeenCalledWith('home');
  });
  it('navigates all destinations, backtracks and completes without operations', () => {
    render(<InteractiveTutorial {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar tutorial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(getTutorialStatus('a')).toBe('completed');
    expect(props.onRestore).toHaveBeenCalledTimes(1);
    expect(props.onNavigate.mock.calls.map(call => call[0])).toEqual(['home', 'home', 'home', 'home', 'home', 'home', 'financial', 'history', 'goals', 'profile']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(Object.keys(localStorage)).toEqual(['lucro-delivery-engagement']);
  });
  it('discards the active visual flow on keyed account changes and logout', () => {
    const view = render(<InteractiveTutorial key="a" {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar tutorial' }));
    view.rerender(<InteractiveTutorial key="b" {...props} userId="b" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getTutorialStatus('b')).toBeNull();
    expect(screen.getByRole('region', { name: 'Apresentação do tutorial' })).toBeInTheDocument();
    view.unmount();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getTutorialStatus('a')).toBe('in_progress');
  });
  it('skips and restores the previous section with Escape', () => {
    render(<InteractiveTutorial {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar tutorial' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(getTutorialStatus('a')).toBe('skipped');
    expect(props.onRestore).toHaveBeenCalledTimes(1);
  });
});