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
import {
  prismy,
  methodSelector,
  createUrlEncodedBodySelector,
  redirect,
  res
} from 'prismy'
import createSession from 'prismy-session'
import JWTCookieStrategy from 'prismy-session-strategy-jwt-cookie'

const { sessionSelector, sessionMiddleware } = createSession(
  new JWTCookieStrategy({
    secret: 'RANDOM_HASH'
  })
)

const urlEncodedBodySelector = createUrlEncodedBodySelector()

export default prismy(
  [methodSelector, sessionSelector, urlEncodedBodySelector],
  (method, session, body) => {
    if (method === 'POST') {
      session.data = { message: body.message }
      return redirect('/')
    } else {
      const { data } = session
      return res(
        [
          '<!DOCTYPE html>',
          '<body>',
          `<p>Message: ${data != null ? (data as any).message : 'NULL'}</p>`,
          '<form action="/" method="post">',
          '<input name="message">',
          '<button type="submit">Send</button>',
          '</form>',
          '</body>'
        ].join('')
      )
    }
  },
  [sessionMiddleware]
)
```

## Session strategies

- [prismy-seesion-strategy-signed-cookie](https://github.com/prismyland/prismy-session-strategy-signed-cookie)
- [prismy-seesion-strategy-jwt-cookie](https://github.com/prismyland/prismy-session-strategy-jwt-cookie)
