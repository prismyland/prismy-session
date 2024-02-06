export async function wait(time: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve()
    }, 1500)
  })
}
