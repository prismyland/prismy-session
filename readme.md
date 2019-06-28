# `prismy-session`

:ledger: Session for prismy

```
npm i prismy-session
```

```ts
import { prismy, JsonBody, After } from 'prismy'
import { createSessionMiddleware, Session } from 'prismy-session'

const sessionMiddleware = createSessionMiddleware({
  secret: 'yolo'
})

@After()
class MyBaseHandler {}

export class MyHandler {
  async execute(@Session session: SessionStore) {
    session.get() as any
    session.set()
  }
}

export default prismy(MyHandler)
```
