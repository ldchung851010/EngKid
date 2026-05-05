export function createGrid(width: number, depth: number, fill: string): string[][] {
  return Array.from({ length: depth }, () => Array(width).fill(fill));
}
