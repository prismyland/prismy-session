import { PrismySessionStore } from './index'
import { Knex } from 'knex'

export interface KnexPrismySessionStoreOptions {
  knex: Knex
  clearInterval?: number
  disableDbCleanup?: boolean
  createTable?: boolean
  tableName?: string
  dbCleanupErrorHandler?: (error: unknown) => void
}
const sidCol = 'sid'
const dataCol = 'data'
const expiredCol = 'expired'

export class KnexPrismySessionStore extends PrismySessionStore {
  knex: Knex
  clearInterval: number
  disableDbCleanup: boolean
  createTable: boolean
  tableName: string
  dbCleanupErrorHandler: (error: unknown) => void
  nextDbCleanup: NodeJS.Timeout | null = null
  preparing: Promise<void>

  constructor(options: KnexPrismySessionStoreOptions) {
    super()
    this.knex = options.knex
    this.clearInterval = fallback(options.clearInterval, 60 * 1000)
    this.disableDbCleanup = fallback(options.disableDbCleanup, false)
    this.createTable = fallback(options.createTable, false)
    this.tableName = fallback(options.tableName, 'sessions')
    this.dbCleanupErrorHandler = fallback(
      options.dbCleanupErrorHandler,
      console.error
    )

    this.preparing = this.prepare()
  }

  async prepare() {
    const exists = await this.knex.schema.hasTable(this.tableName)

    if (!exists) {
      if (this.createTable) {
        const supportingJson = await isDbSupportJson(this.knex)
        await this.knex.schema.createTable(this.tableName, (table) => {
          table.string(sidCol).primary()
          if (supportingJson) {
            table.json(dataCol).notNullable()
          } else {
            table.text(dataCol).notNullable()
          }
          if (isMySQL(this.knex) || isMSSQL(this.knex)) {
            table.dateTime(expiredCol).notNullable().index()
          } else {
            table.timestamp(expiredCol).notNullable().index()
          }
        })
      } else {
        throw new Error(
          'Session table does not exist. Please create one or set `createTable` option to true.'
        )
      }
    }

    if (!this.disableDbCleanup) {
      this.startDbCleanup()
    }
  }

  async startDbCleanup() {
    await this.preparing
    let condition = `${expiredCol} < CAST(? as ${timestampTypeName(this.knex)})`
    if (isSqlite3(this.knex)) {
      // sqlite3 date condition is a special case.
      condition = `datetime(${expiredCol}) < datetime(?)`
    } else if (isOracle(this.knex)) {
      condition = `${expiredCol} < CAST(? as ${timestampTypeName(this.knex)})`
    }
    try {
      await this.knex(this.tableName)
        .del()
        .whereRaw(condition, dateAsISO(this.knex))
    } catch (error) {
      this.dbCleanupErrorHandler(error)
    } finally {
      this.nextDbCleanup = setTimeout(
        () => this.startDbCleanup(),
        this.clearInterval
      ).unref()
    }
  }
  async stopDbCleanup() {
    if (this.nextDbCleanup != null) {
      clearTimeout(this.nextDbCleanup)
      this.nextDbCleanup = null
    }
  }

  async get(id: string) {
    await this.preparing
    const condition = expiredCondition(this.knex)
    const result = await this.knex
      .select(dataCol)
      .from(this.tableName)
      .where(sidCol, '=', id)
      .andWhereRaw(condition, dateAsISO(this.knex))
    const data = result[0][dataCol]
    console.log(result[0][dataCol])
    if (typeof data === 'string') {
      return JSON.parse(data)
    }
    return data
  }

  async set(id: string, data: any, expires: Date) {
    await this.preparing
    const sess = JSON.stringify(data)

    const dbDate = dateAsISO(this.knex, expires)

    if (isSqlite3(this.knex)) {
      const result = await this.knex.raw(
        getSqliteFastQuery(this.tableName, sidCol),
        [id, dbDate, sess]
      )
      return result[1]
    }
    if (isPostgres(this.knex) && parseFloat(this.knex.client.version) >= 9.2) {
      const result = await this.knex.raw(
        getPostgresFastQuery(this.tableName, sidCol),
        [id, dbDate, sess]
      )
      return result
    }
    if (isMySQL(this.knex)) {
      const result = await this.knex.raw(
        getMysqlFastQuery(this.tableName, sidCol),
        [id, dbDate, sess]
      )
      return result
    }
    if (isMSSQL(this.knex)) {
      const result = await this.knex.raw(
        getMssqlFastQuery(this.tableName, sidCol),
        [id, dbDate, sess]
      )
      return result
    }
    return this.knex.transaction(async (trx) => {
      const foundKeys = await trx
        .select('*')
        .forUpdate()
        .from(this.tableName)
        .where(sidCol, '=', id)

      if (foundKeys.length === 0) {
        return trx.from(this.tableName).insert({
          [sidCol]: id,
          expired: dbDate,
          sess,
        })
      }

      return trx(this.tableName).where(sidCol, '=', id).update({
        expired: dbDate,
        sess,
      })
    })
  }

  async touch(id: string, expires: Date) {
    await this.preparing
    const condition = expiredCondition(this.knex)

    await this.knex(this.tableName)
      .where(sidCol, '=', id)
      .andWhereRaw(condition, dateAsISO(this.knex))
      .update({
        expired: dateAsISO(this.knex, expires),
      })
  }

  async destroy(id: string) {
    await this.preparing
    await this.knex.del().from(this.tableName).where(sidCol, '=', id)
  }
}

function fallback<V>(value: V | undefined | null, defaultValue: V): V {
  if (value == null) {
    return defaultValue
  }
  return value
}

async function isDbSupportJson(knex: Knex) {
  if (isMSSQL(knex)) return false
  if (!isMySQL(knex)) return true
  const data = await knex.raw('select version() as version')
  const { version } = data[0][0]
  const extractedVersions: string[] = version.split('.')
  // Only mysql version > 5.7.8 supports JSON datatype
  return (
    +extractedVersions[0] > 5 ||
    (extractedVersions[0] === '5' &&
      (+extractedVersions[1] > 7 ||
        (extractedVersions[1] === '7' && +extractedVersions[2] >= 8)))
  )
}
/*
 * Returns true if the specified knex instance is using sqlite3.
 * @return {bool}
 * @api private
 */
function isSqlite3(knex: Knex) {
  return knex.client.dialect === 'sqlite3'
}

/*
 * Returns true if the specified knex instance is using mysql.
 * @return {bool}
 * @api private
 */
function isMySQL(knex: Knex) {
  return ['mysql', 'mariasql', 'mariadb'].indexOf(knex.client.dialect) > -1
}

/*
 * Returns true if the specified knex instance is using mssql.
 * @return {bool}
 * @api private
 */
function isMSSQL(knex: Knex) {
  return ['mssql'].indexOf(knex.client.dialect) > -1
}
function isOracle(knex: Knex) {
  return ['oracle', 'oracledb'].indexOf(knex.client.dialect) > -1
}
function isPostgres(knex: Knex) {
  return ['postgresql'].indexOf(knex.client.dialect) > -1
}
/*
 * Return datastore appropriate string of the current time
 * @api private
 * @return {String | date}
 */
function dateAsISO(knex: Knex, aDate?: Date) {
  let date
  if (aDate != null) {
    date = new Date(aDate)
  } else {
    date = new Date()
  }
  if (isOracle(knex)) {
    return date
  }
  return isMySQL(knex) || isMSSQL(knex)
    ? date.toISOString().slice(0, 19).replace('T', ' ')
    : date.toISOString()
}
function timestampTypeName(knex: Knex) {
  // eslint-disable-next-line no-nested-ternary
  return isMySQL(knex) || isMSSQL(knex)
    ? 'DATETIME'
    : isPostgres(knex)
    ? 'timestamp with time zone'
    : 'timestamp'
}
function expiredCondition(knex: Knex) {
  let condition = `CAST(? as ${timestampTypeName(knex)}) <= expired`
  if (isSqlite3(knex)) {
    // sqlite3 date condition is a special case.
    condition = 'datetime(?) <= datetime(expired)'
  } else if (isOracle(knex)) {
    condition = `CAST(? as ${timestampTypeName(knex)}) <= "expired"`
  }
  return condition
}

/*
 * Returns PostgreSQL fast upsert query.
 * @return {string}
 * @api private
 */
function getPostgresFastQuery(tablename: string, sidfieldname: string) {
  return (
    `with new_values (${sidfieldname}, expired, data) as (` +
    '  values (?, ?::timestamp with time zone, ?::json)' +
    '), ' +
    'upsert as ' +
    '( ' +
    `  update "${tablename}" cs set ` +
    `    ${sidfieldname} = nv.${sidfieldname}, ` +
    '    expired = nv.expired, ' +
    '    data = nv.data ' +
    '  from new_values nv ' +
    `  where cs.${sidfieldname} = nv.${sidfieldname} ` +
    '  returning cs.* ' +
    ')' +
    `insert into "${tablename}" (${sidfieldname}, expired, data) ` +
    `select ${sidfieldname}, expired, data ` +
    'from new_values ' +
    `where not exists (select 1 from upsert up where up.${sidfieldname} = new_values.${sidfieldname})`
  )
}

/*
 * Returns SQLite fast upsert query.
 * @return {string}
 * @api private
 */
function getSqliteFastQuery(tablename: string, sidfieldname: string) {
  return `insert or replace into ${tablename} (${sidfieldname}, expired, data) values (?, ?, ?);`
}

/*
 * Returns MySQL fast upsert query.
 * @return {string}
 * @api private
 */
function getMysqlFastQuery(tablename: string, sidfieldname: string) {
  return `insert into ${tablename} (${sidfieldname}, expired, data) values (?, ?, ?) on duplicate key update expired=values(expired), data=values(data);`
}

/*
 * Returns MSSQL fast upsert query.
 * @return {string}
 * @api private
 */
function getMssqlFastQuery(tablename: string, sidfieldname: string) {
  return (
    `merge ${tablename} as T ` +
    `using (values (?, ?, ?)) as S (${sidfieldname}, expired, data) ` +
    `on (T.${sidfieldname} = S.${sidfieldname}) ` +
    'when matched then ' +
    'update set expired = S.expired, data = S.data ' +
    'when not matched by target then ' +
    `insert (${sidfieldname}, expired, data) values (S.${sidfieldname}, S.expired, S.data) ` +
    'output inserted.*;'
  )
}
