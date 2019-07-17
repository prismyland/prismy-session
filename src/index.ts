import { sync as generateUid } from 'uid-safe'
import { createInjectDecorators, Selector, BaseHandler, Context } from 'prismy'
import { SessionStore } from './SessionStore'
import { createCookieSelector, CookieStore } from 'prismy-cookie'

import { sign, unsign } from 'cookie-signature'
export { SessionStore }

export interface InternalSessionStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string, maxAgeInSeconds: number): Promise<void>
  destroy(key: string): Promise<void>
  touch(key: string, maxAgeInSeconds: number): Promise<void>
}

export interface SessionOptions {
  secret: string
  store: InternalSessionStore
  name?: string
  serialize?: (value: any) => string
  deserialize?: (value: string) => any
  maxAge?: number
  domain?: string
  httpOnly?: boolean
  path?: string
  sameSite?: boolean | 'lax' | 'strict'
  secure?: boolean
}

export default function createSession(options: SessionOptions) {
  const sessionStoreSymbol = Symbol('PrismySession:SessionStore')
  const cookieStoreSymbol = Symbol('PrismySession:CookieStore')
  const sidSymbol = Symbol('PrismySession:sid')
  const valueSymbol = Symbol('PrismySession:value')
  const fortifiedOptions = {
    name: 'sid',
    serialize: JSON.stringify,
    deserialize: JSON.parse,
    httpOnly: true,
    maxAge: 86400,
    ...options
  }

  function getCookieStore(context: Context): CookieStore {
    let cookieStore: CookieStore | undefined = context[cookieStoreSymbol]
    if (cookieStore == null) {
      cookieStore = createCookieSelector()(context)
      context[cookieStoreSymbol] = cookieStore
    }

    return cookieStore
  }

  function getSid(context: Context): string {
    let sid: string | undefined = context[sidSymbol]
    if (sid != null) return sid

    const cookieStore = getCookieStore(context)
    let signedSid = cookieStore.get()[fortifiedOptions.name]
    if (signedSid == null) {
      sid = generateUid(24)
    } else {
      const unsignedResult = unsign(signedSid, fortifiedOptions.secret)
      if (unsignedResult === false) {
        sid = generateUid(24)
      } else {
        sid = unsignedResult as string
      }
    }
    context[sidSymbol] = sid

    return sid
  }

  /**
   * If value is undefined, it is never fetched yet. (Need to fetch.)
   * If value is null, it has been fetched but empty. (No need to save to session store.)
   */
  async function getValue(context: Context): Promise<any> {
    let value: any = context[valueSymbol]
    if (value !== undefined) return value

    const sid = getSid(context)
    const serializedValue = await fortifiedOptions.store.get(sid)
    if (typeof serializedValue === 'string') {
      value = fortifiedOptions.deserialize(serializedValue)
    } else {
      value = null
    }
    context[valueSymbol] = value

    return value
  }

  async function createSessionStore(context: Context): Promise<SessionStore> {
    const sid = getSid(context)
    const value = await getValue(context)

    return new SessionStore(sid, value)
  }

  const getSessionStore: Selector<Promise<SessionStore>> = async context => {
    let sessionStore: SessionStore | undefined = context[sessionStoreSymbol]
    if (sessionStore == null) {
      sessionStore = await createSessionStore(context)
      context[sessionStoreSymbol] = sessionStore
    }

    return sessionStore
  }

  function setSidCookie(context: Context, sid: string) {
    const {
      name,
      secret,
      maxAge,
      domain,
      httpOnly,
      path,
      sameSite,
      secure
    } = fortifiedOptions
    const cookieStore = getCookieStore(context)

    cookieStore.set([
      name,
      sign(sid, secret),
      {
        maxAge,
        domain,
        httpOnly,
        path,
        sameSite,
        secure
      }
    ])
  }

  async function finalize(context: Context) {
    const { result } = await getSessionStore(context)
    let sid = getSid(context)
    const { store, maxAge, serialize } = fortifiedOptions

    switch (result[0]) {
      case 'touch':
        setSidCookie(context, sid)
        const currentValue = getValue(context)
        if (currentValue != null) {
          await store.touch(sid, maxAge)
        }
        break
      case 'update':
        setSidCookie(context, sid)
        await store.set(sid, serialize(result[1]), maxAge)
        break
      case 'destroy':
        sid = generateUid(24)
        setSidCookie(context, sid)
        await store.destroy(sid)
        break
      case 'regenerate':
        sid = generateUid(24)
        setSidCookie(context, sid)
        const promises = [store.destroy(sid)]
        if (result[1] != null) {
          promises.push(store.set(sid, serialize(result[1]), maxAge))
        }
        await Promise.all(promises)
        break
    }
  }

  return {
    sessionStoreSelector: getSessionStore,
    Session() {
      return createInjectDecorators(getSessionStore)
    },
    sessionMiddleware: class extends BaseHandler {
      async handle() {
        const context = this.context!
        await this.select(getSessionStore)
        const res = context.res

        const originalResEnd: any = res.end
        res.end = async function(...args: any[]) {
          await finalize(context)
          originalResEnd.call(res, ...args)
        }
      }
    }
  }
}
