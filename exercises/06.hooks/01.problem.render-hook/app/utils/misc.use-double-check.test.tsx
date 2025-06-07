/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { test, expect, vi } from 'vitest'
import { useDoubleCheck } from './misc.tsx'

test('hook: prevents default on the first click, and does not on the second', async () => {
	const { result } = await renderHook(() => useDoubleCheck())
	expect(result.current.doubleCheck).toBe(false)

	const myClick = vi.fn()
	const click1 = new MouseEvent('click', {
		bubbles: true,
		cancelable: true,
	}) as unknown as React.MouseEvent<HTMLButtonElement>
	await act(async () => {
		result.current.getButtonProps({ onClick: myClick }).onClick(click1)
	})
	expect(myClick).toHaveBeenCalledTimes(1)
	expect(myClick).toHaveBeenCalledWith(click1)
	expect(click1.defaultPrevented).toBe(true)
	expect(result.current.doubleCheck).toBe(true)
	myClick.mockClear()
	const click2 = new MouseEvent('click', {
		bubbles: true,
		cancelable: true,
	}) as unknown as React.MouseEvent<HTMLButtonElement>
	await act(async () => {
		result.current.getButtonProps({ onClick: myClick }).onClick(click2)
	})
	expect(myClick).toHaveBeenCalledTimes(1)
	expect(myClick).toHaveBeenCalledWith(click2)
	expect(click2.defaultPrevented).toBe(false)
})
