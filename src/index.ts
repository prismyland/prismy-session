import {
  Middleware,
  getPrismyContext,
  MaybePromise,
  CookieSelector,
  PrismyContext,
  PrismyResult,
  createError,
} from 'prismy'
import { createPrismySelector } from 'prismy/dist/selectors/createSelector'
import uid from 'uid-safe'
import cookieSignature from 'cookie-signature'

function defaultSessionIdGenerator() {
  return uid.sync(24)
}

interface PrismySessionOptions<D> {
  store: PrismySessionStore<D>
  secret: string | string[]

  cookieName?: string

  maxAge?: number
  expires?: Date
  httpOnly?: boolean
  path?: string
  domain?: string
  secure?: boolean

  proxy?: boolean

  sessionIdGenerator?: () => MaybePromise<string>
}

class PrismySession<D = any> {
  id: string | null
  data: D | null
  constructor(id: string | null, data: D | null) {
    this.id = this.originalId = id
    this.data = this.originalData = data
  }

  readonly originalId: string | null
  readonly originalData: D | null

  regenerate(): void {
    this.id = null
  }

  destroy(): void {
    this.data = null
  }
}

export abstract class PrismySessionStore<D> {
  abstract get(sid: string): Promise<any | null>
  abstract set(sid: string, data: any, expired: Date): Promise<void>
  abstract destroy(sid: string): Promise<void>
  abstract touch(sid: string, expired: Date): Promise<void>
}

export function createSessionModules<D>(options: PrismySessionOptions<D>) {
  const cookieName = options.cookieName || 'SID'
  const store = options.store
  if (options.secret == null) {
    throw new Error('You must provide secret.')
  }
  const secrets =
    typeof options.secret === 'string' ? [options.secret] : options.secret

  const sessionIdGenerator =
    options.sessionIdGenerator != null
      ? options.sessionIdGenerator
      : defaultSessionIdGenerator

  const sessionMap = new WeakMap<PrismyContext, PrismySession<D>>()

  function unsign(sessionId?: string | null): string | null {
    if (sessionId == null) {
      return null
    }
    for (const secret of secrets) {
      const unsigned = cookieSignature.unsign(sessionId, secret)
      if (unsigned) {
        return unsigned
      }
    }
    return null
  }

  function sign(sessionId: string): string {
    return cookieSignature.sign(sessionId, secrets[0])
  }

  return {
    SessionSelector: () =>
      createPrismySelector(() => {
        const context = getPrismyContext()
        const session = sessionMap.get(context)
        if (session == null) {
          throw createError(
            500,
            'Cannot find a session. Please check session middleware is properly applied.'
          )
        }
        return session
      }),
    SessionMiddleware: () =>
      Middleware(
        [CookieSelector(cookieName)],
        (next) => async (signedSessionId) => {
          const sessionId = unsign(signedSessionId)

          const sessionData =
            sessionId == null ? null : await store.get(sessionId)

          const session = new PrismySession(sessionId, sessionData)

          const result = await next()

          /**
           * if data is null
           * - if it was empty before handler, no actions needed.
           * - else this means handler want to destroy the session.
           * if data is not null
           * - if id is changed, destory the original session and recreate
           * - if id is null, set a new sessionId
           * - if data is changed, save it.
           * - if data is not changed, update expires only.
           */
          if (session.data == null) {
            // No session
            if (session.originalId == null) {
              return result
            }

            // Data has been wiped already
            if (session.originalData == null) {
              return removeSessionCookie(result)
            }

            await store.destroy(session.originalId)

            return removeSessionCookie(result)
          }

          if (session.originalId !== session.id) {
            if (session.originalId != null) {
              await store.destroy(session.originalId)
            }
          }
          if (session.id == null) {
            session.id = await sessionIdGenerator()
          }

          // If both maxAge and expires are defined, use maxAge.
          const expires =
            options.maxAge != null
              ? new Date(Date.now() + options.maxAge * 1000)
              : options.expires != null
              ? options.expires
              : new Date(Date.now() + 86400 * 1000)
          if (session.originalData !== session.data) {
            // save
            await store.set(session.id, session.data, expires)
          } else {
            // touch
            await store.touch(session.id, expires)
          }

          return updateSessionCookie(result, session.id)

          function updateSessionCookie(
            result: PrismyResult,
            sessionId: string
          ): PrismyResult {
            const signedSessionId = sign(sessionId)

            return result.setCookie(cookieName, signedSessionId, {
              maxAge: options.maxAge,
              expires: options.expires,
              httpOnly: options.httpOnly,
              path: options.path,
              domain: options.domain,
              secure: options.secure,
            })
          }

          function removeSessionCookie(result: PrismyResult): PrismyResult {
            return result.setCookie(cookieName, 'invalidated', {
              path: options.path,
              domain: options.domain,
              expires: new Date(0),
            })
          }
        }
      ),
  }
}
