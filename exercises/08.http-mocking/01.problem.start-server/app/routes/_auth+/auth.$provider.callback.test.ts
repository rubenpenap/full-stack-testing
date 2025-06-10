import { faker } from '@faker-js/faker'
import * as setCookieParser from 'set-cookie-parser'
import '#tests/mocks/index.ts'
import { expect, test } from 'vitest'
import { connectionSessionStorage } from '#app/utils/connections.server.ts'
import { loader } from './auth.$provider.callback.ts'

const ROUTE_PATH = '/auth/github/callback'
const PARAMS = { provider: 'github' }
const BASE_URL = 'https://www.epicstack.dev'

test('a new user goes to onboarding', async () => {
	const url = new URL(ROUTE_PATH, BASE_URL)
	const code = faker.string.uuid()
	const state = faker.string.uuid()
	url.searchParams.set('code', code)
	url.searchParams.set('state', state)
	const connectionSession = await connectionSessionStorage.getSession()
	connectionSession.set('oauth2:state', state)
	const setCookieHeader =
		await connectionSessionStorage.commitSession(connectionSession)
	const cookieHeaders = convertSetCookieToCookie(setCookieHeader)
	const request = new Request(url.toString(), {
		method: 'GET',
		headers: {
			cookie: cookieHeaders,
		},
	})
	const response = await loader({ request, params: PARAMS, context: {} })
	assertRedirect(response, '/onboarding/github')
})

function assertRedirect(response: Response, redirectTo: string) {
	expect(response.status).toBeGreaterThanOrEqual(300)
	expect(response.status).toBeLessThan(400)
	expect(response.headers.get('location')).toBe(redirectTo)
}

function convertSetCookieToCookie(setCookie: string) {
	const parsedCookie = setCookieParser.parseString(setCookie)
	return new URLSearchParams({
		[parsedCookie.name]: parsedCookie.value,
	}).toString()
}
