import knex from 'knex'
import { KnexPrismySessionStore } from '../src/knex'

const db = knex({
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'root',
    password: 'root',
    database: 'prismy-session',
  },
})

describe('KnexPrismySessionStore (Postgresql)', () => {
  const store = new KnexPrismySessionStore({
    knex: db,
    createTable: true,
    clearInterval: 100,
    dbCleanupErrorHandler: (error) => {
      console.error(error, 'fail to clean')
    },
    disableDbCleanup: true,
  })

  beforeAll(async () => {
    await store.prepare()
  })

  afterAll(async () => {
    store.stopDbCleanup()
    await store.knex.destroy()
  })

  it('sets and gets', async () => {
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    expect(await store.get('test')).toBe('hello')
  })

  it('does not get if expired', async () => {
    const store = new KnexPrismySessionStore({
      knex: db,
    })
    await store.set('test', 'hello', new Date(Date.now() - 24 * 60 * 60 * 1000))

    expect(await store.get('test')).toBeNull()
  })

  it('touches', async () => {
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    const newExpires = new Date(Date.now() + 24 * 60 * 60 * 100 * 1000)
    await store.touch('test', newExpires)

    const result = await db
      .select('*')
      .from('sessions')
      .where('sid', '=', 'test')
    expect(new Date(result[0].expired).getTime()).toBe(newExpires.getTime())
    expect(result[0].sid).toBe('test')
    expect(result[0].data).toBe(JSON.stringify('hello'))
  })

  it('destroys', async () => {
    await store.set('test2', 'hi', new Date(Date.now() + 24 * 60 * 60 * 1000))

    await store.destroy('test2')

    expect(await store.get('test2')).toBe(null)
    const result = await db
      .select('*')
      .from('sessions')
      .where('sid', '=', 'test2')
    expect(result.length).toBe(0)
  })

  it('cleans automatically', async () => {
    await store.set(
      'test3',
      'hello',
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    )
    const result = await db
      .select('*')
      .from('sessions')
      .where('sid', '=', 'test3')
    expect(result.length).not.toBe(0)

    await store.cleanupDb()

    const result2 = await db
      .select('*')
      .from('sessions')
      .where('sid', '=', 'test3')
    expect(result2.length).toBe(0)
  })
})
