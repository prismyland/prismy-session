# `prismy-session`

:ledger: Session for prismy

```
npm i prismy-session
```

## Example

```ts
import {
  prismy,
  Method,
  BaseHandler,
  createInjectDecorators,
  createTextBodySelector
} from 'prismy'
import createSession, { SessionState } from 'prismy-session'
import querystring from 'querystring'
import SignedCookieStrategy from 'prismy-session-strategy-signed-cookie'

const { Session, sessionMiddleware } = createSession({
  strategy: new SignedCookieStrategy({
    secret: 'RANDOM_HASH'
  })
})

const UrlencodedBody = () =>
  createInjectDecorators(async context => {
    const textBody = await createTextBodySelector()(context)
    return querystring.parse(textBody)
  })

class MyHandler extends BaseHandler {
  async handle(
    @Method() method: string,
    @Session() session: SessionState,
    @UrlencodedBody() body: any
  ) {
    if (method === 'POST') {
      // Update session data
      session.data = { message: body.message }
      return this.redirect('/')
    } else {
      // Get session data
      const { data } = session
      return [
        '<!DOCTYPE html>',
        '<body>',
        `<p>Message: ${data != null ? data.message : 'NULL'}</p>`,
        '<form action="/" method="post">',
        '<input name="message">',
        '<button type="submit">Send</button>',
        '</form>',
        '</body>'
      ].join('')
    }
  }
}

export default prismy([sessionMiddleware, MyHandler])
```

## Session strategies

- [prismy-seesion-strategy-signed-cookie](https://github.com/prismyland/prismy-session-strategy-signed-cookie)
