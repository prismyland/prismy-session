import test from 'ava'
import createSession, { SessionStore } from '..'
import MemoryStore from '../MemoryStore'
import { Method } from 'prismy'
import { testServer } from 'prismy-test-server'
import got from 'got'
import { CookieJar } from 'tough-cookie'

test('integration test', async t => {
  const cookieJar = new CookieJar()
  const { Session, sessionMiddleware } = createSession({
    store: new MemoryStore(),
    secret: ''
  })
  class Handler {
    async handle(@Method() method: string, @Session() session: SessionStore) {
      if (method === 'POST') {
        session.update({ message: 'Hello, World!' })
        return 'OK'
      } else {
        const data = session.get()
        return data.message
      }
    }
  }

  await testServer([sessionMiddleware, Handler], async url => {
    const postResponse = await got.post(url, {
      cookieJar
    })
    t.is(postResponse.body, 'OK')

    const getResponse = await got(url, {
      cookieJar,
      retry: 0
    })
    t.is(getResponse.body, 'Hello, World!')
  })
})

test('middleware sets sid', async t => {
  const cookieJar = new CookieJar()
  const { Session, sessionMiddleware } = createSession({
    store: new MemoryStore(),
    secret: ''
  })
  class Handler {
    async handle(@Method() method: string, @Session() session: SessionStore) {
      if (method === 'POST') {
        session.update({ message: 'Hello, World!' })
        return 'OK'
      } else {
        const data = session.get()
        return data.message
      }
    }
  }

  await testServer([sessionMiddleware, Handler], async url => {
    const postResponse = await got.post(url, {
      cookieJar
    })
    t.is(postResponse.body, 'OK')

    const getResponse = await got(url, {
      cookieJar,
      retry: 0
    })
    t.is(getResponse.body, 'Hello, World!')
  })
})

// test('session data will not be saved if it is null', async t => {})

// test('session#update sets data', async t => {})

// test('session#destroy resets sid and discard data', async t => {})

// test('session#regenerate resets sid and destroy data of previous sid', async t => {})

// test('session#regenerate sets data for new sid', async t => {})
