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

describe('KnexPrismySessionStore (Redis)', () => {
  beforeAll(async () => {
    await new KnexPrismySessionStore({
      knex: db,
      createTable: true,
    }).prepare()
  })
  it('sets and gets', async () => {
    const store = new KnexPrismySessionStore({
      knex: db,
    })
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    expect(await store.get('test')).toBe('hello')
  })

  it.skip('does not get if expired', async () => {
    const store = new KnexPrismySessionStore({
      knex: db,
    })
    await store.set('test', 'hello', new Date(Date.now() - 24 * 60 * 60 * 1000))

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve()
      }, 1500)
    })
    expect(await store.get('test')).toBeNull()
  })

  it('touches', async () => {
    const store = new KnexPrismySessionStore({
      knex: db,
    })
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    const newExpires = new Date(Date.now() + 24 * 60 * 60 * 100 * 1000)
    await store.touch('test', newExpires)
  })

  it('destroys', async () => {
    const store = new KnexPrismySessionStore({
      knex: db,
    })
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    await store.destroy('test')

    expect(await store.get('test')).toBe(null)
  })
})
