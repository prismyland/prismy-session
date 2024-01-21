import { PrismySessionStore } from '.'

interface MemoryStoreData {
  id: string
  data: any
  expires: Date
}

export class MemoryPrismySessionStore extends PrismySessionStore {
  map = new Map<string, MemoryStoreData>()

  async get(id: string) {
    const memoryStoreData = this.map.get(id)
    if (memoryStoreData == null) {
      return null
    }
    if (memoryStoreData.expires < new Date()) {
      return null
    }
    return memoryStoreData.data
  }

  async set(id: string, data: any, expires: Date) {
    this.map.set(id, {
      id,
      data,
      expires,
    })
  }

  async touch(id: string, expires: Date) {
    const memoryStoreData = await this.get(id)
    if (memoryStoreData == null) {
      return
    }

    this.map.set(id, {
      id,
      data: memoryStoreData,
      expires,
    })
  }

  async destroy(id: string) {
    this.map.delete(id)
  }
}
