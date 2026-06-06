import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskCard } from './TaskCard';
import { makeTask } from '@/test/factory';

describe('TaskCard', () => {
  it('zobrazí název, tagy a počet podúkolů', () => {
    render(
      <TaskCard task={makeTask({ name: 'Alpha', tags: ['work', 'urgent'] })} subtaskCount={3} />,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('work')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('zavolá onOpen s ID po kliknutí', async () => {
    const onOpen = vi.fn();
    render(<TaskCard task={makeTask({ id: 'x1', name: 'Klik' })} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: /Klik/ }));
    expect(onOpen).toHaveBeenCalledWith('x1');
  });
});
