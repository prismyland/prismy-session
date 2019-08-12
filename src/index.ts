import { Context, ResponseObject, Middleware, Selector } from 'prismy'

export interface Session<D = unknown> {
  readonly previousData: D | null
  data: D | null
  shouldRegenerate?: boolean
}

export interface SessionStrategy<D = unknown> {
  loadData(context: Context): Promise<D | null> | D | null
  finalize(
    context: Context,
    session: Session,
    res: ResponseObject<any>
  ): ResponseObject<any> | Promise<ResponseObject<any>>
}

export interface SessionUtils {
  sessionSelector: Selector<Session>
  sessionMiddleware: Middleware
}

export function createSession<D = unknown>(
  strategy: SessionStrategy<D>
): SessionUtils {
  const sessionSymbol = Symbol('prismy-session')
  async function sessionSelector(context: Context): Promise<Session<D>> {
    let sessionState = context[sessionSymbol] as Session<D> | undefined
    if (sessionState == null) {
      const data = await strategy.loadData(context)
      sessionState = context[sessionSymbol] = {
        data,
        previousData: data
      }
    }
    return sessionState
  }

  return {
    sessionSelector,
    sessionMiddleware: context => async next => {
      const resObject = await next()
      const session = await sessionSelector(context)
      return strategy.finalize(context, session, resObject)
    }
  }
}

export default createSession
