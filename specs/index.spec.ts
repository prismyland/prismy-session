import test from 'ava'
import got from 'got'
import { Context, ResponseObject, prismy, res } from 'prismy'
import { testHandler } from 'prismy-test'
import createSession, { Session } from '../src'

class Spy {
  called: boolean = false

  call() {
    this.called = true
  }
}

test('sessionSelector selects SessionStrategy#loadData', async (t) => {
  const strategy = {
    async loadData() {
      return { message: 'Hello, World!' }
    },
    async finalize(
      context: Context,
      session: Session,
      resObject: ResponseObject<any>
    ) {
      return resObject
    },
  }
  const { sessionSelector, sessionMiddleware } = createSession(strategy)
  const handler = prismy(
    [sessionSelector],
    (session) => {
      return res(session.data)
    },
    [sessionMiddleware]
  )

  await testHandler(handler, async (url) => {
    const postResponse = await got(url, {
      method: 'POST',
      responseType: 'json',
    })
    t.deepEqual(postResponse.body, { message: 'Hello, World!' })
  })
})

test('sessionMiddleware uses SessionStrategy#finalize to finalize response', async (t) => {
  const spy = new Spy()
  const strategy = {
    async loadData() {
      return {}
    },
    async finalize(
      context: Context,
      session: Session,
      resObject: ResponseObject<any>
    ) {
      spy.call()
      return resObject
    },
  }
  const { sessionSelector, sessionMiddleware } = createSession(strategy)
  const handler = prismy(
    [sessionSelector],
    (session) => {
      return res(session.data)
    },
    [sessionMiddleware]
  )

  await testHandler(handler, async (url) => {
    await got(url, { method: 'POST' })
    t.true(spy.called)
  })
})

test('prismy handles errors from SessionStrategy#finalize', async (t) => {
  const strategy = {
    async loadData() {
      return {}
    },
    async finalize() {
      throw new Error('Hello, World!')
    },
  }
  const { sessionSelector, sessionMiddleware } = createSession(strategy)
  const handler = prismy(
    [sessionSelector],
    (session) => {
      return res(session.data)
    },
    [sessionMiddleware]
  )

  await testHandler(handler, async (url) => {
    const response = await got(url, { throwHttpErrors: false, method: 'POST' })
    t.is(response.statusCode, 500)
    t.regex(response.body, /^Error: Hello, World!/)
  })
})
