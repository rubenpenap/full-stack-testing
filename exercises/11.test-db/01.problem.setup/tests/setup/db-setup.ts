import path from 'node:path'
import { execaCommand } from 'execa'
import fsExtra from 'fs-extra'
import { afterAll, afterEach, beforeAll } from 'vitest'

const databaseFile = './test/prisma/data.db'
const fullDatabasePath = path.join(process.cwd(), databaseFile)
process.env.DATABASE_URL = `file:${fullDatabasePath}`

beforeAll(async () => {
	await execaCommand(
		'prisma migrate reset --force --skip-seed --skip-generate',
		{ stdio: 'inherit' },
	)
})

afterEach(async () => {
	const { prisma } = await import('#app/utils/db.server.ts')
	await prisma.user.deleteMany()
})

afterAll(async () => {
	const { prisma } = await import('#app/utils/db.server.ts')
	await prisma.$disconnect()
	await fsExtra.remove(fullDatabasePath)
})
