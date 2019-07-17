import { InternalSessionStore } from '.'

export default class MemoryStore implements InternalSessionStore {
  map: Map<string, [string, number]> = new Map()
  private mockedNow?: number
  async get(key: string): Promise<string | null> {
    const tuple = this.map.get(key)
    if (tuple == null) {
      return null
    }
    const [value, expires] = tuple
    if (expires < this.getNow()) {
      this.map.delete(key)
      return null
    }
    return value
  }

  async set(
    key: string,
    value: string,
    maxAgeInSeconds: number
  ): Promise<void> {
    this.map.set(key, [value, this.getNow() + maxAgeInSeconds * 1000])
  }

  async destroy(key: string): Promise<void> {
    this.map.delete(key)
  }

  async touch(key: string, maxAgeInSeconds: number): Promise<void> {
    const value = await this.get(key)
    if (value == null) {
      return
    }
    this.map.set(key, [value, this.getNow() + maxAgeInSeconds * 1000])
  }

  getNow() {
    if (this.mockedNow == null) return Date.now()
    return this.mockedNow
  }

  mockNow(now: number) {
    this.mockedNow = now
  }
}
