# `prismy-session`

:ledger: Session for prismy

```
npm i prismy-session
```

```ts
import { prismy, JsonBody, After } from 'prismy'
import { createSessionMiddleware, Session } from 'prismy-session'
import RedisSessionStore from 'prismy-session-redis'

const sessionMiddleware = createSessionMiddleware({
  store: new RedisSessionStore({
    // Redis client options...
  }),
  secret: 'yolo'
})

export class MyHandler {
  async execute(@Session session: SessionStore) {
    session.get() as any
    session.set()
  }
}

export default prismy([sessionMiddleware, MyHandler])
```
