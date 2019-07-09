import test from 'ava'
import MemoryStore from '../MemoryStore'

test('MemoryStore#get returns a stored value', async t => {
  const store = new MemoryStore()
  const now = Date.now()
  store.mockNow(now)

  await store.set('test', 'Hello, World!', 1)
  store.mockNow(now + 500)

  const value = await store.get('test')
  t.is(value, 'Hello, World!')
})

test('MemoryStore#get does not return value if it is expired', async t => {
  const store = new MemoryStore()
  const now = Date.now()
  store.mockNow(now)

  await store.set('test', 'Hello, World!', 1)
  store.mockNow(now + 1500)

  const value = await store.get('test')
  t.is(value, undefined)
})

test('MemoryStore#touch extends expiration date', async t => {
  const store = new MemoryStore()
  const now = Date.now()
  store.mockNow(now)
  await store.set('test', 'Hello, World!', 1)

  await store.touch('test', 10)
  store.mockNow(now + 1500)

  const value = await store.get('test')
  t.is(value, 'Hello, World!')
})

test('MemoryStore#destroy discard a stored value', async t => {
  const store = new MemoryStore()
  const now = Date.now()
  store.mockNow(now)

  await store.set('test', 'Hello, World!', 1)
  store.mockNow(now + 500)
  await store.destroy('test')

  const value = await store.get('test')
  t.is(value, undefined)
})
