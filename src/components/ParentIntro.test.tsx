import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ParentIntro } from './ParentIntro';
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
it('waits at the beginning when audible autoplay is denied', async () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('NotAllowedError'));
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const close = vi.fn();
  const { container } = render(<ParentIntro onClose={close} />);
  await waitFor(() => expect(screen.getByText('Смотреть со звуком')).toBeTruthy());
  expect(container.querySelector('video')!.currentTime).toBe(0);
  expect(container.querySelector('video')!.muted).toBe(false);
  expect(screen.queryByText('Пропустить →')).toBeNull();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(close).not.toHaveBeenCalled();
});
it('allows closing when the video ends or fails', () => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  const close = vi.fn();
  const { container } = render(<ParentIntro onClose={close} />);
  fireEvent.ended(container.querySelector('video')!);
  expect(close).toHaveBeenCalledTimes(1);
  fireEvent.error(container.querySelector('video')!);
  expect(close).toHaveBeenCalledTimes(2);
});
