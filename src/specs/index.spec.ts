import test from 'ava'
import createSession, { SessionState } from '../'
import { Context } from 'prismy'
import { testServer } from 'prismy-test-server'
import got from 'got'

class Spy {
  called: boolean = false

  call() {
    this.called = true
  }
}

test('Session sets data via strategy.loadData', async t => {
  const { Session, sessionMiddleware } = createSession({
    strategy: {
      async loadData() {
        return { message: 'Hello, World!' }
      },
      async finalize(context: Context, session: SessionState<any>) {}
    }
  })
  class Handler {
    async handle(@Session() session: SessionState<any>) {
      return session.data
    }
  }

  await testServer([sessionMiddleware, Handler], async url => {
    const postResponse = await got.post(url, { json: true })
    t.deepEqual(postResponse.body, { message: 'Hello, World!' })
  })
})

test('Session calls strategy.finalize', async t => {
  const spy = new Spy()
  const { Session, sessionMiddleware } = createSession({
    strategy: {
      async loadData() {
        return {}
      },
      async finalize(context: Context, session: SessionState<any>) {
        spy.call()
      }
    }
  })
  class Handler {
    async handle(@Session() session: SessionState<any>) {
      return session.data
    }
  }

  await testServer([sessionMiddleware, Handler], async url => {
    await got.post(url)
    t.true(spy.called)
  })
})
