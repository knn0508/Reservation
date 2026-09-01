/** `crypto.randomUUID` does not exist in Hermes, so the reservation idempotency key is built
 *  here. Math.random is fine for this: the key only has to be unique within one wizard session,
 *  and the backend treats it as an opaque de-duplication token, not a secret. */
export function randomUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
