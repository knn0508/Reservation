import { useFonts } from "expo-font"
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_500Medium,
} from "@expo-google-fonts/fraunces"
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from "@expo-google-fonts/outfit"
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono"

/** The three families the web app loaded from Google Fonts, bundled into the app instead. */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_500Medium,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    JetBrainsMono_400Regular,
  })
  return loaded
}
