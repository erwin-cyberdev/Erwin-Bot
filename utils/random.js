export function randomInt(min, maxInclusive) {
  const minValue = Math.ceil(min)
  const maxValue = Math.floor(maxInclusive)
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue
}

export function randomChoice(items) {
  if (!items?.length) return null
  const idx = randomInt(0, items.length - 1)
  return items[idx]
}
