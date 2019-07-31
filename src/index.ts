import { BaseHandler, Context, createInjectDecorators } from 'prismy'

export interface SessionState<D = unknown> {
  readonly previousData: D | null
  data: D | null
  shouldRegenerate?: boolean
}

export interface Strategy<D = unknown> {
  loadData(context: Context): Promise<D | null> | D | null
  finalize(context: Context, session: SessionState): Promise<void> | void
}

interface SessionOptions<D = unknown> {
  strategy: Strategy<D>
}

export function createSession<D = unknown>(options: SessionOptions<D>) {
  const { strategy } = options
  const sessionStoreSymbol = Symbol('prismy-session-store')
  async function getSessionState(context: Context): Promise<SessionState<D>> {
    let sessionState = context[sessionStoreSymbol] as SessionState<D> | null
    if (sessionState == null) {
      const data = await strategy.loadData(context)
      sessionState = context[sessionStoreSymbol] = {
        data,
        previousData: data
      }
    }
    return sessionState
  }

  return {
    getSessionState,
    sessionMiddleware: class extends BaseHandler {
      async handle() {
        const context = this.context!
        const session = await this.select(getSessionState)
        const res = context.res

        const originalResEnd: any = res.end
        res.end = async function(...args: any[]) {
          await strategy.finalize(context, session)
          originalResEnd.call(res, ...args)
        }
      }
    },
    Session: () => createInjectDecorators(getSessionState)
  }
}

export default createSession
