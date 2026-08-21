// Static presentation content per restaurant (images, copy, socials). Keyed by API slug.
// The backend only knows id/slug/name — everything editorial lives here on the frontend
// until a CMS or admin field exists for it.

export interface RestaurantContent {
  slug: string
  displayName: string
  tagline: string
  cuisine: string
  /** First image is used on the list card and as the hero; rest fill out the gallery/lightbox. */
  images: string[]
  hasRealImages: boolean
  about: string[]
  address: string
  phone: string
  hours: string
  social: {
    instagram: string
    facebook: string
    whatsapp: string
  }
  menuUrl: string
}

export const restaurantContent: Record<string, RestaurantContent> = {
  "mamajan-georgian-cuisine": {
    slug: "mamajan-georgian-cuisine",
    displayName: "Mamajan Georgian Cuisine",
    tagline: "Khinkali, khachapuri, and live mugham some nights of the week.",
    cuisine: "Georgian",
    images: ["/restaurants/mamajan/mamajan-1.jpg", "/restaurants/mamajan/mamajan-2.jpg"],
    hasRealImages: true,
    about: [
      "Mamajan brings the table traditions of Tbilisi and Kakheti to the center of Baku. The kitchen turns out hand-folded khinkali by the dozen, khachapuri baked until the cheese pulls in long ropes, and lamb and beef skewers marinated the way they'd be marinated in a Georgian village kitchen, not a hotel one.",
      "The dining room mixes reclaimed wood, brass light fixtures, and a wall of hanging copper cookware, the kind of warm, unhurried room built for a table that runs long. Folk instruments some evenings add a soft, live undercurrent to dinner without turning the room into a stage.",
      "There's a full vegan and vegetarian line too: stewed lentils, roasted eggplant with walnut paste, stuffed vegetables, so a mixed table of carnivores and everyone else all get fed properly from the same order.",
    ],
    address: "Səbail rayonu,Puşkin Küçəsi 5, Baku, Azerbaijan",
    phone: "+994 55 500 71 72",
    hours: "Daily, 11:00 to late",
    social: {
      instagram: "https://www.instagram.com/mamajanbaku/",
      facebook: "https://www.facebook.com/mamajanbaku/",
      whatsapp: "https://wa.me/994555007172",
    },
    menuUrl: "/restaurants/mamajan-georgian-cuisine/menu",
  },
  "nar-bagi": {
    slug: "nar-bagi",
    displayName: "Nar Bağı",
    tagline: "A pomegranate orchard turned dining room.",
    cuisine: "Azerbaijani",
    images: [],
    hasRealImages: false,
    about: [
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nar Bağı draws its name and its palette, deep reds, dusty greens, from the pomegranate groves it's named after. The kitchen leans on slow-cooked plov, seasonal herbs, and a grill that runs all evening.",
      "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. The dining room is built around a central courtyard feel, with low lighting and close tables meant for long, unhurried dinners.",
      "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris. Placeholder copy, swap for the real story once photography and menu details are ready.",
    ],
    address: "Placeholder address, Baku, Azerbaijan",
    phone: "+994 12 000 00 00",
    hours: "Daily, 12:00 to late",
    social: {
      instagram: "#",
      facebook: "#",
      whatsapp: "#",
    },
    menuUrl: "#",
  },
}

export function getRestaurantContent(slug: string): RestaurantContent {
  return (
    restaurantContent[slug] ?? {
      slug,
      displayName: slug,
      tagline: "Lorem ipsum dolor sit amet consectetur.",
      cuisine: "",
      images: [],
      hasRealImages: false,
      about: ["Lorem ipsum dolor sit amet, consectetur adipiscing elit. Placeholder copy for this restaurant."],
      address: "Placeholder address, Baku, Azerbaijan",
      phone: "+994 12 000 00 00",
      hours: "Daily, 12:00 to late",
      social: { instagram: "#", facebook: "#", whatsapp: "#" },
      menuUrl: "#",
    }
  )
}
