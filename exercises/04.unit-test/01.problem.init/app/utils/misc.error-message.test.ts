import { faker } from '@faker-js/faker'
import { test, expect } from 'vitest'
import { getErrorMessage } from './misc.tsx'

test('Error object returns message', () => {
	const errorMessage = faker.lorem.words(4)
	const error = new Error(errorMessage)
	expect(getErrorMessage(error)).toBe(errorMessage)
})

test('Error object returns message', () => {
	const errorMessage = faker.lorem.words(4)
	expect(getErrorMessage(errorMessage)).toBe(errorMessage)
})

test('Undefined falls back to Unknown', () => {
	expect(getErrorMessage(undefined)).toBe('Unknown Error')
})
