export function demo() {
  const width = 28, height = 22
  return { width, height, unit: 20,
    elevations: Array.from({ length: width * height }, (_, index) => {
      const x = index % width, y = Math.floor(index / width)
      if (Math.hypot(x - 20, y - 7) < 2.5) return null
      return Math.round(145 + 175 * Math.exp(-((x - 8) ** 2 + (y - 12) ** 2) / 48)
        + 105 * Math.exp(-((x - 21) ** 2 + (y - 12) ** 2) / 30) + 25 * Math.sin((x + y) / 5))
    }) }
}
