import AsyncStorage from "@react-native-async-storage/async-storage"

const TOKEN_KEY = "itb.auth.token"

/**
 * AsyncStorage, not SecureStore: the JWT is short-lived and re-obtainable by logging in
 * again. Move it to expo-secure-store before shipping to a store, together with refresh
 * tokens - AsyncStorage is readable on a rooted device.
 */
export async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export async function setToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token)
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY)
}
