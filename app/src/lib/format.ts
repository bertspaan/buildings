export function formatCount(value: number): string {
  return new Intl.NumberFormat('nl-NL').format(value)
}
