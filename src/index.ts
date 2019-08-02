import {
  BaseHandler,
  Context,
  createInjectDecorators,
  handleError
} from 'prismy'

export interface SessionState<D = unknown> {
  readonly previousData: D | null
  data: D | null
  shouldRegenerate?: boolean
}

export interface SessionStrategy<D = unknown> {
  loadData(context: Context): Promise<D | null> | D | null
  finalize(context: Context, session: SessionState): Promise<void> | void
}

export function createSession<D = unknown>(strategy: SessionStrategy<D>) {
  const sessionStateSymbol = Symbol('prismy-session-state')
  async function sessionStateSelector(
    context: Context
  ): Promise<SessionState<D>> {
    let sessionState = context[sessionStateSymbol] as SessionState<D> | null
    if (sessionState == null) {
      const data = await strategy.loadData(context)
      sessionState = context[sessionStateSymbol] = {
        data,
        previousData: data
      }
    }
    return sessionState
  }

  return {
    sessionStateSelector,
    sessionMiddleware: class extends BaseHandler {
      async handle() {
        const context = this.context!
        const session = await this.select(sessionStateSelector)
        const res = context.res

        const originalResEnd: any = res.end
        res.end = async function(...args: any[]) {
          try {
            await strategy.finalize(context, session)
            originalResEnd.call(res, ...args)
          } catch (error) {
            res.end = originalResEnd
            handleError(context, error)
          }
        }
      }
    },
    Session: () => createInjectDecorators(sessionStateSelector)
  }
}

export default createSession
