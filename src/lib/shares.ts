/**
 * Each weight's share of the total as percentages rounded to `decimals`, adjusted so they add up to
 * exactly 100. Plain rounding drifts once a rubric has more than five metrics: six equal metrics
 * round to 17% each (102%), seven to 14% each (98%). The leftover goes to the largest remainders.
 */
export function percentShares(weights: number[], decimals = 0): number[] {
  const positive = weights.map((weight) => (weight > 0 ? weight : 0))
  const total = positive.reduce((sum, weight) => sum + weight, 0)
  if (!total) return weights.map(() => 0)
  const unit = 10 ** decimals
  const exact = positive.map((weight) => (weight / total) * 100 * unit)
  const floors = exact.map(Math.floor)
  let left = 100 * unit - floors.reduce((sum, value) => sum + value, 0)
  const order = exact.map((value, index) => ({ index, rest: value - floors[index] })).sort((a, b) => b.rest - a.rest || a.index - b.index)
  for (const { index } of order) {
    if (left <= 0) break
    if (positive[index] > 0) {
      floors[index] += 1
      left -= 1
    }
  }
  return floors.map((value) => value / unit)
}
