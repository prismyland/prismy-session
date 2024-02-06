import { PrismySessionStore } from './index'
import {
  PgDatabase,
  pgTable,
  timestamp,
  text,
  varchar,
  QueryResultHKT,
} from 'drizzle-orm/pg-core'
import { and, eq, gte, lt } from 'drizzle-orm'

type PgDb = PgDatabase<QueryResultHKT, Record<string, never>>

export interface DrizzlePrismySessionStoreOptions {
  db: PgDb
  clearInterval?: number
  disableDbCleanup?: boolean
  tableName?: string
  dbCleanupErrorHandler?: (error: unknown) => void
}

export class DrizzlePrismySessionStore extends PrismySessionStore {
  db: PgDb
  table
  clearInterval: number
  disableDbCleanup: boolean
  dbCleanupErrorHandler: (error: unknown) => void
  nextDbCleanup: NodeJS.Timeout | null = null

  constructor(options: DrizzlePrismySessionStoreOptions) {
    super()
    this.db = options.db
    this.clearInterval = fallback(options.clearInterval, 60 * 1000)
    this.disableDbCleanup = fallback(options.disableDbCleanup, false)
    const tableName = fallback(options.tableName, 'sessions')
    this.table = pgTable(tableName, {
      sid: varchar('sid', { length: 256 }).primaryKey(),
      data: text('data').notNull(),
      expired: timestamp('expired').notNull(),
    })
    this.dbCleanupErrorHandler = fallback(
      options.dbCleanupErrorHandler,
      console.error
    )
    this.startDbCleanup()
  }

  async startDbCleanup() {
    try {
      await this.db.delete(this.table).where(lt(this.table.expired, new Date()))
    } catch (error) {
      this.dbCleanupErrorHandler(error)
    } finally {
      this.nextDbCleanup = setTimeout(
        () => this.startDbCleanup(),
        this.clearInterval
      ).unref()
    }
  }

  stopDbCleanup() {
    if (this.nextDbCleanup != null) {
      clearTimeout(this.nextDbCleanup)
      this.nextDbCleanup = null
    }
  }

  async get(id: string) {
    const result = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.sid, id), gte(this.table.expired, new Date())))
    if (result[0] == null) {
      return null
    }
    const data = result[0].data

    return JSON.parse(data)
  }

  async set(sid: string, data: any, expired: Date) {
    const stringifiedData = JSON.stringify(data)
    await this.db
      .insert(this.table)
      .values({
        sid,
        data: stringifiedData,
        expired,
      })
      .onConflictDoUpdate({
        target: this.table.sid,
        set: {
          data: stringifiedData,
          expired,
        },
      })
  }

  async touch(sid: string, expired: Date) {
    await this.db
      .update(this.table)
      .set({
        expired,
      })
      .where(eq(this.table.sid, sid))
  }

  async destroy(sid: string) {
    await this.db.delete(this.table).where(eq(this.table.sid, sid))
  }
}

function fallback<V>(value: V | undefined | null, defaultValue: V): V {
  if (value == null) {
    return defaultValue
  }
  return value
}
