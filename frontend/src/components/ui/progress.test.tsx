import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Progress } from './progress'

const fill = () => document.querySelector('[data-slot="progress-indicator"]') as HTMLElement

describe('Progress', () => {
  it.each([
    [0, 'translateX(-100%)'],
    [40, 'translateX(-60%)'],
    [100, 'translateX(-0%)'],
  ])('at %i%% the fill is offset by the unfilled part', (value, transform) => {
    render(<Progress value={value} aria-label="Learned" />)

    expect(screen.getByRole('progressbar', { name: 'Learned' })).toHaveAttribute('aria-valuenow', String(value))
    expect(fill().style.transform).toBe(transform)
  })

  it('is empty when no value is given', () => {
    render(<Progress aria-label="Learned" />)

    expect(fill().style.transform).toBe('translateX(-100%)')
  })
})
