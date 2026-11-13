// How an expense category looks in lists: an icon and a hue for its tile
// (`.tile` in style.css reads the hue from `--h`). A category is free text, so
// anything not listed here falls back to a neutral tag.

interface CategoryStyle {
  icon: string
  hue: number
}

const STYLES: Record<string, CategoryStyle> = {
  Housing: { icon: 'pi pi-home', hue: 215 },
  Utilities: { icon: 'pi pi-bolt', hue: 42 },
  Food: { icon: 'pi pi-shopping-cart', hue: 24 },
  Transport: { icon: 'pi pi-car', hue: 265 },
  Insurance: { icon: 'pi pi-shield', hue: 190 },
  Health: { icon: 'pi pi-heart', hue: 345 },
  Debt: { icon: 'pi pi-credit-card', hue: 4 },
  Kids: { icon: 'pi pi-face-smile', hue: 300 },
  Subscriptions: { icon: 'pi pi-sync', hue: 238 },
  Entertainment: { icon: 'pi pi-ticket', hue: 322 },
}

const FALLBACK: CategoryStyle = { icon: 'pi pi-tag', hue: 150 }

/** Hue of the tile used for income rows. */
export const INCOME_HUE = 158

export const categoryStyle = (category?: string | null): CategoryStyle & { known: boolean } => {
  const style = category ? STYLES[category] : undefined
  return style ? { ...style, known: true } : { ...FALLBACK, known: false }
}
