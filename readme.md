# `prismy-session`

:ledger: Session for prismy

[![Build Status](https://travis-ci.com/prismyland/prismy-session.svg?branch=master)](https://travis-ci.com/prismyland/prismy-session)
[![codecov](https://codecov.io/gh/prismyland/prismy-session/branch/master/graph/badge.svg)](https://codecov.io/gh/prismyland/prismy-session)
[![NPM download](https://img.shields.io/npm/dm/prismy-session.svg)](https://www.npmjs.com/package/prismy-session)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/prismyland/prismy-session.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/prismyland/prismy-session/context:javascript)

```
npm i prismy-session
```

## Example

```ts
import { prismy, Method, BaseHandler, UrlEncodedBody } from 'prismy'
import createSession, { SessionState } from 'prismy-session'
import SignedCookieStrategy from 'prismy-session-strategy-signed-cookie'

const { Session, SessionMiddleware } = createSession(
  new SignedCookieStrategy({
    secret: 'RANDOM_HASH'
  })
)

class MyHandler extends BaseHandler {
  async handle(
    @Method() method: string,
    @Session() session: SessionState,
    @UrlEncodedBody() body: any
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

export default prismy([SessionMiddleware, MyHandler])
```

## Session strategies

- [prismy-seesion-strategy-signed-cookie](https://github.com/prismyland/prismy-session-strategy-signed-cookie)
- [prismy-seesion-strategy-jwt-cookie](https://github.com/prismyland/prismy-session-strategy-jwt-cookie)
