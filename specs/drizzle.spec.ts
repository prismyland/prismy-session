import { wait } from './helpers'

import { drizzle } from 'drizzle-orm/node-postgres'
import { Client } from 'pg'
import { DrizzlePrismySessionStore } from '../src/drizzle'
import { eq } from 'drizzle-orm'

const pgClient = new Client({
  host: 'localhost',
  port: 5432,
  user: 'root',
  password: 'root',
  database: 'prismy-session',
})
const db = drizzle(pgClient)

describe('DrizzlePrismySessionStore (Postgresql)', () => {
  const store = new DrizzlePrismySessionStore({
    db: db,
    clearInterval: 100,
    dbCleanupErrorHandler: (error) => {
      console.error(error, 'fail to clean')
    },
  })

  beforeAll(async () => {
    await pgClient.connect()
  })
  afterAll(async () => {
    store.stopDbCleanup()
    await pgClient.end()
  })

  it('sets and gets', async () => {
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    expect(await store.get('test')).toBe('hello')
  })

  it('does not get if expired', async () => {
    await store.set('test', 'hello', new Date(Date.now() - 24 * 60 * 60 * 1000))

    expect(await store.get('test')).toBeNull()
  })

  it('touches', async () => {
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    const newExpires = new Date(Date.now() + 24 * 60 * 60 * 100 * 1000)
    await store.touch('test', newExpires)

    const result = await db
      .select()
      .from(store.table)
      .where(eq(store.table.sid, 'test'))
    expect(new Date(result[0].expired).getTime()).toBe(newExpires.getTime())
    expect(result[0].sid).toBe('test')
    expect(result[0].data).toBe(JSON.stringify('hello'))
  })

  it('destroys', async () => {
    await store.set('test2', 'hi', new Date(Date.now() + 24 * 60 * 60 * 1000))

    await store.destroy('test2')

    expect(await store.get('test2')).toBe(null)
    const result = await db
      .select()
      .from(store.table)
      .where(eq(store.table.sid, 'test2'))
    expect(result.length).toBe(0)
  })

  it('cleans automatically', async () => {
    await store.set(
      'test3',
      'hello',
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    )
    const result = await db
      .select()
      .from(store.table)
      .where(eq(store.table.sid, 'test3'))
    expect(result.length).not.toBe(0)

    await wait(200)

    const result2 = await db
      .select()
      .from(store.table)
      .where(eq(store.table.sid, 'test3'))
    expect(result2.length).toBe(0)
  })
})
