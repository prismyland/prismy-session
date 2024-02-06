import { PrismySessionStore } from './index'
import type { RedisClientType } from 'redis'
import type IORedis from 'ioredis'

export class RedisPrismySessionStore extends PrismySessionStore {
  constructor(public client: any) {
    super()

    this.setter = this.isRedis(client)
      ? async (id: string, data: any, ttl: number) => {
          await client.set(id, data, { EX: ttl })
        }
      : async (id: string, data: any, ttl: number) => {
          await (client as IORedis).set(id, data, 'EX', ttl)
        }
  }

  setter: (id: string, data: any, ttl: number) => Promise<void>

  private isRedis(
    client: RedisClientType | IORedis
  ): client is RedisClientType {
    return 'scanIterator' in client
  }

  async get(id: string) {
    return this.client.get(id)
  }

  async set(id: string, data: any, expires: Date) {
    const ttl = calculateTtl(expires)
    await this.setter(id, data, ttl)
  }

  async touch(id: string, expires: Date) {
    const ttl = calculateTtl(expires)
    await this.client.expire(id, ttl)
  }

  async destroy(id: string) {
    await this.client.del([id])
  }
}

function calculateTtl(expires: Date) {
  const ttl = Math.ceil((expires.getTime() - Date.now()) / 1000)
  if (!(ttl > 0)) {
    return 1
  }
  return ttl
}
