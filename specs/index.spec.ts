import test from 'ava'
import createSession, { SessionState } from '../src'
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
  const strategy = {
    async loadData() {
      return { message: 'Hello, World!' }
    },
    async finalize(context: Context, session: SessionState<any>) {}
  }
  const { Session, sessionMiddleware } = createSession(strategy)
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
  const strategy = {
    async loadData() {
      return {}
    },
    async finalize(context: Context, session: SessionState<any>) {
      spy.call()
    }
  }
  const { Session, sessionMiddleware } = createSession(strategy)
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

test('Session handles errors while executing strategy.finalize', async t => {
  console.error = () => {}
  const strategy = {
    async loadData() {
      return {}
    },
    async finalize(context: Context, session: SessionState<any>) {
      throw new Error('Hello, World!')
    }
  }
  const { Session, sessionMiddleware } = createSession(strategy)
  class Handler {
    async handle(@Session() session: SessionState<any>) {
      return session.data
    }
  }

  await testServer([sessionMiddleware, Handler], async url => {
    const response = await got.post(url, { throwHttpErrors: false })
    t.is(response.statusCode, 500)
    t.is(response.body, 'Internal Server Error')
  })
})
