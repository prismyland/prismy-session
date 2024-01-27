import { RedisPrismySessionStore } from '../src/redis'
import { createClient } from 'redis'
import IORedis from 'ioredis'
import { wait } from './helpers'

describe('RedisPrismySessionStore (Redis)', () => {
  const client = createClient()

  beforeAll(async () => {
    await client.connect()
  })

  afterAll(async () => {
    await client.quit()
  })
  it('sets and gets', async () => {
    const store = new RedisPrismySessionStore(client)
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    expect(await store.get('test')).toBe('hello')
  })

  it('does not get if expired', async () => {
    const store = new RedisPrismySessionStore(client)
    await store.set('test', 'hello', new Date(Date.now() - 24 * 60 * 60 * 1000))

    await wait(1)
    expect(await store.get('test')).toBeNull()
  })

  it('touches', async () => {
    const store = new RedisPrismySessionStore(client)
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    const newExpires = new Date(Date.now() + 24 * 60 * 60 * 100 * 1000)
    await store.touch('test', newExpires)

    expect(await client.get('test')).toEqual('hello')
    expect((await client.ttl('test')) > 8630000).toBeTruthy()
  })

  it('destroys', async () => {
    const store = new RedisPrismySessionStore(client)
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    await store.destroy('test')

    expect(await store.get('test')).toBe(null)
  })
})

describe('RedisPrismySessionStore (IORedis)', () => {
  const client = new IORedis()
  afterAll(async () => {
    await client.quit()
  })

  it('sets and gets', async () => {
    const store = new RedisPrismySessionStore(client)
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    expect(await store.get('test')).toBe('hello')
  })

  it('does not get if expired', async () => {
    const store = new RedisPrismySessionStore(client)
    await store.set('test', 'hello', new Date(Date.now() - 24 * 60 * 60 * 1000))

    await wait(1)
    expect(await store.get('test')).toBeNull()
  })

  it('touches', async () => {
    const store = new RedisPrismySessionStore(client)
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    const newExpires = new Date(Date.now() + 24 * 60 * 60 * 100 * 1000)
    await store.touch('test', newExpires)

    expect(await client.get('test')).toEqual('hello')
    expect((await client.ttl('test')) > 8630000).toBeTruthy()
  })

  it('destroys', async () => {
    const store = new RedisPrismySessionStore(client)
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    await store.destroy('test')

    expect(await store.get('test')).toBe(null)
  })
})
