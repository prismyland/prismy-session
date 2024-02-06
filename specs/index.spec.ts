import cookieSignature from 'cookie-signature'
import { Result, Route, Router } from 'prismy'
import { TestServer } from 'prismy/test'
import { createSessionModules } from '../src/index'
import { MemoryPrismySessionStore } from '../src/memory'

const ts = TestServer()

beforeAll(async () => {
  await ts.start()
})

afterAll(async () => {
  await ts.close()
})

describe('prismy session', () => {
  it('sets and gets session value', async () => {
    const { SessionMiddleware, SessionSelector } = createSessionModules<{
      test: string
    }>({
      store: new MemoryPrismySessionStore(),
      secret: 'test',
    })
    const handler = Router(
      [
        Route('/set-a', [SessionSelector()], (session) => {
          session.data = {
            test: 'a',
          }
          return Result(null)
        }),
        Route('/get', [SessionSelector()], (session) => {
          return Result(session.data)
        }),
      ],
      {
        middleware: [SessionMiddleware()],
      }
    )

    const res1 = await ts.load(handler).call('/set-a')
    expect(res1.status).toBe(200)
    const cookies = res1.headers.getSetCookie()
    const [cookieName, cookieValue] = cookies[0].split('=')
    expect(cookieName).toBe('SID')
    expect(cookieValue.length > 1).toBeTruthy()

    const res2 = await ts.call('/get', {
      headers: {
        cookie: cookies[0],
      },
    })
    expect(res2.status).toBe(200)
    expect(await res2.json()).toEqual({
      test: 'a',
    })
  })

  it('sets cookie values', async () => {
    const now = new Date()
    const { SessionMiddleware, SessionSelector } = createSessionModules<{
      test: string
    }>({
      store: new MemoryPrismySessionStore(),
      cookieName: 'test-sid',
      secret: 'test',
      maxAge: 24 * 60 * 60,
      expires: now,
      httpOnly: true,
      path: '/test',
      domain: 'https://test-domain.com',
      secure: true,
    })
    const handler = Router([
      Route(
        '/set-a',
        [SessionSelector()],
        (session) => {
          session.data = {
            test: 'a',
          }
          return Result(null)
        },
        [SessionMiddleware()]
      ),
    ])

    const res = await ts.load(handler).call('/set-a')
    expect(res.status).toBe(200)

    const cookies = res.headers.getSetCookie()
    expect(cookies[0]).toMatch(/^test-sid=/)
    expect(cookies[0]).toMatch('; Max-Age=' + 24 * 60 * 60)
    expect(cookies[0]).toMatch('; HttpOnly')
    expect(cookies[0]).toMatch('; Path=/test')
    expect(cookies[0]).toMatch('; Domain=https://test-domain.com')
    expect(cookies[0]).toMatch('; Secure')
    expect(cookies[0]).toMatch('; Expires=' + now.toUTCString())

    const cookieValue = cookies[0].split(';')[0].split('=')[1]
    expect(
      cookieSignature.unsign(decodeURIComponent(cookieValue), 'test')
    ).toBeTruthy()
  })

  it('regenerates', async () => {
    const store = new MemoryPrismySessionStore()
    const { SessionMiddleware, SessionSelector } = createSessionModules<{
      test: string
    }>({
      store,
      secret: 'test',
    })
    const handler = Router(
      [
        Route('/set-a', [SessionSelector()], (session) => {
          session.data = {
            test: 'a',
          }
          return Result(null)
        }),
        Route('/regenerate', [SessionSelector()], (session) => {
          session.regenerate()

          return Result(session.data)
        }),
      ],
      {
        middleware: [SessionMiddleware()],
      }
    )

    const res1 = await ts.load(handler).call('/set-a')
    const cookies = res1.headers.getSetCookie()
    const cookieValue = cookies[0].split(';')[0].split('=')[1]

    const res2 = await ts.call('/regenerate', {
      headers: [['Cookie', 'SID=' + cookieValue]],
    })
    const cookies2 = res2.headers.getSetCookie()
    const cookieValue2 = cookies2[0].split(';')[0].split('=')[1]
    expect(cookieValue2).not.toBe(cookieValue)

    const sid1 =
      cookieSignature.unsign(decodeURIComponent(cookieValue), 'test') || ''
    expect(await store.get(sid1)).toBeNull()

    const sid2 =
      cookieSignature.unsign(decodeURIComponent(cookieValue2), 'test') || ''
    expect(await store.get(sid2)).toEqual({
      test: 'a',
    })
  })

  it('destroy', async () => {
    const store = new MemoryPrismySessionStore()
    const { SessionMiddleware, SessionSelector } = createSessionModules<{
      test: string
    }>({
      store,
      secret: 'test',
    })
    const handler = Router(
      [
        Route('/set-a', [SessionSelector()], (session) => {
          session.data = {
            test: 'a',
          }
          return Result(null)
        }),
        Route('/destroy', [SessionSelector()], (session) => {
          session.destroy()

          return Result(session.data)
        }),
      ],
      {
        middleware: [SessionMiddleware()],
      }
    )

    const res1 = await ts.load(handler).call('/set-a')
    const cookies = res1.headers.getSetCookie()
    const cookieValue = cookies[0].split(';')[0].split('=')[1]

    const res2 = await ts.call('/destroy', {
      headers: [['Cookie', 'SID=' + cookieValue]],
    })
    const cookies2 = res2.headers.getSetCookie()
    expect(cookies2[0]).toMatch('SID=invalidated')
    expect(cookies2[0]).toMatch('Expires=' + new Date(0).toUTCString())

    const sid1 =
      cookieSignature.unsign(decodeURIComponent(cookieValue), 'test') || ''
    expect(await store.get(sid1)).toBeNull()
  })

  it('touch', async () => {
    const store = new MemoryPrismySessionStore()
    const expires1 = new Date(Date.now() + 24 * 60 * 60)
    const { SessionMiddleware, SessionSelector } = createSessionModules<{
      test: string
    }>({
      store,
      secret: 'test',
      expires: new Date(Date.now() + 24 * 60 * 60),
    })
    const handler1 = Router(
      [
        Route('/set-a', [SessionSelector()], (session) => {
          session.data = {
            test: 'a',
          }
          return Result(null)
        }),
      ],
      {
        middleware: [SessionMiddleware()],
      }
    )

    const res1 = await ts.load(handler1).call('/set-a')
    const cookies1 = res1.headers.getSetCookie()
    const [cookieName, cookieValue] = cookies1[0].split(';')[0].split('=')

    const expires1FromCookie = cookies1[0].match(/Expires=(.+);?/)![1]
    expect(expires1.toUTCString()).toBe(expires1FromCookie)

    const expires2 = new Date(Date.now() + 24 * 60 * 60 * 100)
    const {
      SessionMiddleware: SessionMiddleware2,
      SessionSelector: SessionSelector2,
    } = createSessionModules<{
      test: string
    }>({
      store,
      secret: 'test',
      expires: expires2,
    })
    const handler2 = Router(
      [
        Route('/get', [SessionSelector2()], (session) => {
          return Result(session.data)
        }),
      ],
      {
        middleware: [SessionMiddleware2()],
      }
    )

    const res2 = await ts.load(handler2).call('/get', {
      headers: {
        cookie: cookieName + '=' + cookieValue,
      },
    })
    expect(res2.status).toBe(200)
    expect(await res2.json()).toEqual({
      test: 'a',
    })

    const cookies2 = res2.headers.getSetCookie()
    expect(
      new Date(expires2) > new Date(Date.now() + 24 * 60 * 60)
    ).toBeTruthy()

    const expires2FromCookies = cookies2[0].match(/Expires=(.+);?/)![1]
    expect(new Date(expires2FromCookies).toUTCString()).toBe(
      expires2.toUTCString()
    )
    const sid =
      cookieSignature.unsign(decodeURIComponent(cookieValue), 'test') || ''
    expect(store.map.get(sid)?.expires.toUTCString()).toBe(
      expires2.toUTCString()
    )
  })
})
