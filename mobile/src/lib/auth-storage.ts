import AsyncStorage from "@react-native-async-storage/async-storage"

// The web app read the token straight out of localStorage, synchronously, on every request.
// AsyncStorage has no sync read, so the token is mirrored in memory: `hydrate()` runs once at
// startup and every write keeps the cache in step, which lets `getToken()` stay synchronous
// and the api layer stay unchanged.

const TOKEN_KEY = "itb_token"

let cached: string | null = null

export async function hydrateToken(): Promise<string | null> {
  try {
    cached = await AsyncStorage.getItem(TOKEN_KEY)
  } catch {
    cached = null
  }
  return cached
}

export function getToken(): string | null {
  return cached
}

export function setToken(token: string): void {
  cached = token
  void AsyncStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  cached = null
  void AsyncStorage.removeItem(TOKEN_KEY)
}
