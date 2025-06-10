import { faker } from '@faker-js/faker'
import * as setCookieParser from 'set-cookie-parser'
import { afterEach, expect, test } from 'vitest'
import { connectionSessionStorage } from '#app/utils/connections.server.ts'
import { invariant } from '#app/utils/misc.tsx'
import { server } from '#tests/mocks/index.ts'
import { consoleError } from '#tests/setup/setup-test-env.ts'
import { loader } from './auth.$provider.callback.ts'
import { http } from 'msw'

const ROUTE_PATH = '/auth/github/callback'
const PARAMS = { provider: 'github' }
const BASE_URL = 'https://www.epicstack.dev'

afterEach(() => server.resetHandlers())

test('a new user goes to onboarding', async () => {
	const url = new URL(ROUTE_PATH, BASE_URL)
	const state = faker.string.uuid()
	const code = faker.string.uuid()
	url.searchParams.set('state', state)
	url.searchParams.set('code', code)

	const connectionSession = await connectionSessionStorage.getSession()
	connectionSession.set('oauth2:state', state)
	const connectionSetCookieHeader =
		await connectionSessionStorage.commitSession(connectionSession)
	const request = new Request(url.toString(), {
		method: 'GET',
		headers: {
			cookie: convertSetCookieToCookie(connectionSetCookieHeader),
		},
	})
	const response = await loader({ request, params: PARAMS, context: {} })
	assertRedirect(response, '/onboarding/github')
})

test('when auth fails, send the user to login with a toast', async () => {
	consoleError.mockImplementation(() => {})
	server.use(
		http.post('https://github.com/login/oauth/access_token', () => {
			return new Response('error', { status: 400 })
		}),
	)
	const url = new URL(ROUTE_PATH, BASE_URL)
	const state = faker.string.uuid()
	const code = faker.string.uuid()
	url.searchParams.set('state', state)
	url.searchParams.set('code', code)
	const connectionSession = await connectionSessionStorage.getSession()
	connectionSession.set('oauth2:state', state)
	const connectionSetCookieHeader =
		await connectionSessionStorage.commitSession(connectionSession)
	const request = new Request(url.toString(), {
		method: 'GET',
		headers: {
			cookie: convertSetCookieToCookie(connectionSetCookieHeader),
		},
	})
	const response = await loader({ request, params: PARAMS, context: {} }).catch(
		r => r,
	)

	assertRedirect(response, '/login')
	assertToastSent(response)
	expect(consoleError).toHaveBeenCalledTimes(1)
})

function assertToastSent(response: Response) {
	const setCookie = response.headers.get('set-cookie')
	invariant(setCookie, 'set-cookie header should be set')
	const parsedCookie = setCookieParser.splitCookiesString(setCookie)
	expect(parsedCookie).toEqual(
		expect.arrayContaining([expect.stringContaining('en_toast')]),
	)
}

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
