import { MemoryPrismySessionStore } from '../src/memory'

describe('MemoryPrismySessionStore', () => {
  it('sets and gets', async () => {
    const store = new MemoryPrismySessionStore()
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60))

    expect(await store.get('test')).toBe('hello')
  })

  it('does not get if expired', async () => {
    const store = new MemoryPrismySessionStore()
    await store.set('test', 'hello', new Date(Date.now() - 24 * 60 * 60))

    expect(await store.get('test')).toBeNull()
  })

  it('touches', async () => {
    const store = new MemoryPrismySessionStore()
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60))

    const newExpires = new Date(Date.now() + 24 * 60 * 60 * 100)
    await store.touch('test', newExpires)

    expect(store.map.get('test')).toEqual({
      id: 'test',
      data: 'hello',
      expires: newExpires,
    })
  })

  it('destroys', async () => {
    const store = new MemoryPrismySessionStore()
    await store.set('test', 'hello', new Date(Date.now() + 24 * 60 * 60))

    await store.destroy('test')

    expect(await store.get('test')).toBe(null)
  })
})
