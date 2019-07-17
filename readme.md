# `prismy-session`

:ledger: Session for prismy

```
npm i prismy-session
```

```ts
import { prismy, JsonBody, After } from 'prismy'
import { createSessionMiddleware, Session } from 'prismy-session'
import MemoryStore from 'prismy-session/MemoryStore'

const sessionMiddleware = createSessionMiddleware({
  store: new MemoryStore(),
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

## Session stores

- [prismy-session-redis](https://github.com/prismyland/prismy-session-redis)
