export function withTimeout(promise, timeoutMs = 10000, message = 'Request timed out. Check your connection.') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), timeoutMs)
    }),
  ])
}
