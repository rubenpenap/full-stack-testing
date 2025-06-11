import { faker } from '@faker-js/faker'
import { http } from 'msw'
import * as setCookieParser from 'set-cookie-parser'
import { afterEach, expect, test } from 'vitest'
import { getSessionExpirationDate, sessionKey } from '#app/utils/auth.server.ts'
import { connectionSessionStorage } from '#app/utils/connections.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { invariant } from '#app/utils/misc.tsx'
import { sessionStorage } from '#app/utils/session.server.ts'
import { insertedUsers, insertNewUser } from '#tests/db-utils.ts'
import { deleteGitHubUsers, insertGitHubUser } from '#tests/mocks/github.ts'
import { server } from '#tests/mocks/index.ts'
import { consoleError } from '#tests/setup/setup-test-env.ts'
import { loader } from './auth.$provider.callback.ts'

const ROUTE_PATH = '/auth/github/callback'
const PARAMS = { provider: 'github' }
const BASE_URL = 'https://www.epicstack.dev'

afterEach(async () => {
	await deleteGitHubUsers()
})
afterEach(async () => {
	await prisma.user.deleteMany({
		where: { id: { in: [...insertedUsers] } },
	})
	insertedUsers.clear()
})

test('a new user goes to onboarding', async () => {
	const request = await setupRequest()
	const response = await loader({ request, params: PARAMS, context: {} })
	assertRedirect(response, '/onboarding/github')
})

test('when auth fails, send the user to login with a toast', async () => {
	consoleError.mockImplementation(() => {})
	server.use(
		http.post('https://github.com/login/oauth/access_token', async () => {
			return new Response('error', { status: 400 })
		}),
	)
	const request = await setupRequest()
	const response = await loader({ request, params: PARAMS, context: {} }).catch(
		e => e,
	)
	invariant(response instanceof Response, 'response should be a Response')
	assertRedirect(response, '/login')
	assertToastSent(response)
	expect(consoleError).toHaveBeenCalledTimes(1)
})

test('when a user is logged in, it creates the connection', async () => {
	const githubUser = await insertGitHubUser()
	const newUser = await insertNewUser()
	const session = await prisma.session.create({
		select: { id: true },
		data: {
			userId: newUser.id,
			expirationDate: getSessionExpirationDate(),
		},
	})

	const request = await setupRequest({
		sessionId: session.id,
		code: githubUser.code,
	})
	const response = await loader({ request, params: PARAMS, context: {} })
	assertRedirect(response, '/settings/profile/connections')
	assertToastSent(response)
	const connection = await prisma.connection.findFirst({
		where: {
			userId: newUser.id,
			providerId: githubUser.profile.id,
		},
	})
	expect(connection).toBeTruthy()
})

async function setupRequest({
	sessionId,
	code = faker.string.uuid(),
}: { sessionId?: string; code?: string } = {}) {
	const url = new URL(ROUTE_PATH, BASE_URL)
	const state = faker.string.uuid()
	url.searchParams.set('state', state)
	url.searchParams.set('code', code)

	const connectionSession = await connectionSessionStorage.getSession()
	connectionSession.set('oauth2:state', state)

	const cookieSession = await sessionStorage.getSession()
	if (sessionId) cookieSession.set(sessionKey, sessionId)

	const connectionSetCookieHeader =
		await connectionSessionStorage.commitSession(connectionSession)
	const request = new Request(url.toString(), {
		method: 'GET',
		headers: {
			cookie: [
				convertSetCookieToCookie(
					await sessionStorage.commitSession(cookieSession),
				),
				convertSetCookieToCookie(connectionSetCookieHeader),
			].join(';'),
		},
	})
	return request
}

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
