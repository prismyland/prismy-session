import { Context, ResponseObject, Selector, PrismyPureMiddleware } from 'prismy'

export interface Session<D = any> {
  readonly previousData: D | null
  data: D | null
  shouldRegenerate?: boolean
}

export interface SessionStrategy {
  loadData(context: Context): Promise<any> | any | null
  finalize(
    context: Context,
    session: Session,
    res: ResponseObject<any>
  ): ResponseObject<any> | Promise<ResponseObject<any>>
}

export interface SessionUtils<D> {
  sessionSelector: Selector<Session<D>>
  sessionMiddleware: PrismyPureMiddleware
}

export function createSession<D = any>(
  strategy: SessionStrategy
): SessionUtils<D> {
  const sessionSymbol = Symbol('prismy-session')
  async function sessionSelector(context: Context): Promise<Session<D>> {
    let sessionState = context[sessionSymbol] as Session<D> | undefined
    if (sessionState == null) {
      const data = await strategy.loadData(context)
      sessionState = context[sessionSymbol] = {
        data,
        previousData: data,
      }
    }
    return sessionState
  }

  return {
    sessionSelector,
    sessionMiddleware: (context) => async (next) => {
      const resObject = await next()
      const session = await sessionSelector(context)
      return strategy.finalize(context, session, resObject)
    },
  }
}

export default createSession
