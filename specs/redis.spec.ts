import { RedisPrismySessionStore } from '../src/redis'
import { createClient } from 'redis'
import IORedis from 'ioredis'

// Initialize client.
const redisClient = createClient()
const ioRedisClient = new IORedis()

beforeAll(async () => {
  await redisClient.connect()
})

describe('MemoryPrismySessionStore (Redis)', () => {
  const client = redisClient
  it('sets and gets', async () => {
    const store = new RedisPrismySessionStore(client)
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    expect(await store.get('test')).toBe('hello')
  })

  it('does not get if expired', async () => {
    const store = new RedisPrismySessionStore(client)
    await store.set('test', 'hello', new Date(Date.now() - 24 * 60 * 60 * 1000))

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve()
      }, 1500)
    })
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

describe('MemoryPrismySessionStore (IORedis)', () => {
  const client = ioRedisClient
  it('sets and gets', async () => {
    const store = new RedisPrismySessionStore(client)
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60 * 1000))

    expect(await store.get('test')).toBe('hello')
  })

  it('does not get if expired', async () => {
    const store = new RedisPrismySessionStore(client)
    await store.set('test', 'hello', new Date(Date.now() - 24 * 60 * 60 * 1000))

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve()
      }, 1500)
    })
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
