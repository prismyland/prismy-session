export type SessionResult =
  | ['touch']
  | ['update', any]
  | ['regenerate', any | undefined]
  | ['destroy']

export class SessionStore {
  result: SessionResult = ['touch']

  constructor(public sid: string, public value: any) {}

  get() {
    return this.value
  }

  touch(): void {
    this.setResult(['touch'])
  }

  update(value: any): void {
    this.setResult(['update', value])
  }

  destroy(): void {
    this.setResult(['destroy'])
  }

  regenerate(value?: any): void {
    this.setResult(['regenerate', value])
  }

  setResult(result: SessionResult) {
    this.result = result
  }
}
