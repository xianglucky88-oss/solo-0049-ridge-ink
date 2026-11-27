export const drawingPointLimit = 200000
export const levelLimit = 100
export const intervalFactors = [1, 2, 5, 10]

export function lineLength(line) {
  let total = 0
  for (let i = 1; i < line.length; i++) {
    total += Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y)
  }
  return total
}
