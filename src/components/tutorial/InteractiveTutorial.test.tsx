import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InteractiveTutorial from './InteractiveTutorial';
import { getTutorialStatus } from '@/lib/engagement';
import { pushBlockingModal } from '@/lib/uiModalState';
import { act } from '@testing-library/react';
import { toast } from 'sonner';
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(() => 'tutorial-badge'), { dismiss: vi.fn() }) }));

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
    expect(toast).not.toHaveBeenCalled();
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
    expect(toast).toHaveBeenCalledTimes(1);
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
    expect(toast).not.toHaveBeenCalled();
    expect(props.onRestore).toHaveBeenCalledTimes(1);
  });
  it('yields to existing blocking flows and resumes without starting an operation', () => {
    render(<InteractiveTutorial {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar tutorial' }));
    let release: (() => void) | undefined;
    act(() => { release = pushBlockingModal(); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => release?.());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(props.onNavigate).toHaveBeenCalledTimes(1);
    expect(getTutorialStatus('a')).toBe('in_progress');
  });
  it('does not award at the last step before Concluir, or when that step is abandoned', () => {
    render(<InteractiveTutorial {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar tutorial' }));
    for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    expect(getTutorialStatus('a')).toBe('in_progress');
    expect(toast).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Pular tutorial' }));
    expect(getTutorialStatus('a')).toBe('skipped');
    expect(toast).not.toHaveBeenCalled();
  });
  it('preserves the badge on replay and logout, without repeating the unlock confirmation', () => {
    const view = render(<InteractiveTutorial key="a" {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Começar tutorial' }));
    for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajuda e tutorial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar tutorial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pular tutorial' }));
    expect(getTutorialStatus('a')).toBe('completed');
    fireEvent.click(screen.getByRole('button', { name: 'Ajuda e tutorial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar tutorial' }));
    for (let i = 0; i < 7; i++) fireEvent.click(screen.getByRole('button', { name: 'Próximo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));
    expect(toast).toHaveBeenCalledTimes(1);
    view.rerender(<InteractiveTutorial key="b" {...props} userId="b" />);
    expect(getTutorialStatus('b')).toBeNull();
    expect(getTutorialStatus('a')).toBe('completed');
    expect(toast.dismiss).toHaveBeenCalledWith('tutorial-badge');
  });
});