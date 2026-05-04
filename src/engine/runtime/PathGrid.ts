import * as THREE from 'three';

/** Binary min-heap priority queue keyed by f-score */
class MinHeap {
  private nodes: { x: number; z: number; f: number }[] = [];

  get size(): number { return this.nodes.length; }

  push(node: { x: number; z: number; f: number }): void {
    const a = this.nodes;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop(): { x: number; z: number; f: number } | undefined {
    const a = this.nodes;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      while (true) {
        let best = i;
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        if (l < a.length && a[l].f < a[best].f) best = l;
        if (r < a.length && a[r].f < a[best].f) best = r;
        if (best === i) break;
        [a[best], a[i]] = [a[i], a[best]];
        i = best;
      }
    }
    return top;
  }
}

/** 8-direction neighbor definitions */
const DIRS = [
  { dx: 1, dz: 0, cost: 1 },
  { dx: -1, dz: 0, cost: 1 },
  { dx: 0, dz: 1, cost: 1 },
  { dx: 0, dz: -1, cost: 1 },
  { dx: 1, dz: 1, cost: Math.SQRT2 },
  { dx: 1, dz: -1, cost: Math.SQRT2 },
  { dx: -1, dz: 1, cost: Math.SQRT2 },
  { dx: -1, dz: -1, cost: Math.SQRT2 },
];

export class PathGrid {
  private width = 0;
  private depth = 0;
  private walkable: boolean[][] = [];

  /** Build walkability grid from collision data. Call after all colliders are loaded. */
  build(width: number, depth: number, canOccupy: (pos: THREE.Vector3) => boolean): void {
    this.width = width;
    this.depth = depth;
    this.walkable = [];
    const testPos = new THREE.Vector3();

    for (let z = 0; z < depth; z++) {
      const row: boolean[] = [];
      for (let x = 0; x < width; x++) {
        testPos.set(x + 0.5, 0, z + 0.5);
        row.push(canOccupy(testPos));
      }
      this.walkable.push(row);
    }
  }

  /** Find a path from start to end in world coordinates. Returns smoothed waypoints or null. */
  findPath(start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] | null {
    if (this.width === 0) return null;

    // World → grid
    let sx = Math.floor(start.x);
    let sz = Math.floor(start.z);
    let ex = Math.floor(end.x);
    let ez = Math.floor(end.z);

    // Bounds check — clamp to grid
    ex = Math.max(0, Math.min(this.width - 1, ex));
    ez = Math.max(0, Math.min(this.depth - 1, ez));

    // If start not walkable, snap to nearest walkable cell
    if (!this.isInBounds(sx, sz) || !this.walkable[sz]?.[sx]) {
      const snapped = this.findNearestWalkable(sx, sz);
      if (!snapped) return null;
      sx = snapped.x;
      sz = snapped.z;
    }

    // If destination not walkable, find nearest walkable cell to it
    if (!this.walkable[ez]?.[ex]) {
      const snapped = this.findNearestWalkable(ex, ez);
      if (!snapped) return null;
      ex = snapped.x;
      ez = snapped.z;
    }

    // Same cell — walk directly to the clicked world position
    if (sx === ex && sz === ez) {
      return [end.clone()];
    }

    // A* search
    const raw = this.runAStar(sx, sz, ex, ez);
    if (!raw) return null;

    // Convert grid path to world coords, use exact end position for last point
    const worldPath = raw.map((p, i) =>
      i === raw.length - 1
        ? new THREE.Vector3(end.x, 0, end.z)
        : new THREE.Vector3(p.x + 0.5, 0, p.z + 0.5),
    );

    // Smooth
    return this.smoothPath(worldPath);
  }

  /** Check if a world position is on a walkable cell. */
  isWalkable(worldX: number, worldZ: number): boolean {
    const x = Math.floor(worldX);
    const z = Math.floor(worldZ);
    return this.isInBounds(x, z) && this.walkable[z][x];
  }

  // ── Private ───────────────────────────────────────────────

  private isInBounds(x: number, z: number): boolean {
    return x >= 0 && x < this.width && z >= 0 && z < this.depth;
  }

  private findNearestWalkable(sx: number, sz: number): { x: number; z: number } | null {
    for (let r = 1; r <= 2; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx === 0 && dz === 0) continue;
          const nx = sx + dx;
          const nz = sz + dz;
          if (this.isInBounds(nx, nz) && this.walkable[nz][nx]) {
            return { x: nx, z: nz };
          }
        }
      }
    }
    return null;
  }

  private heuristic(x1: number, z1: number, x2: number, z2: number): number {
    const dx = Math.abs(x1 - x2);
    const dz = Math.abs(z1 - z2);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  }

  private runAStar(
    sx: number, sz: number, ex: number, ez: number,
  ): { x: number; z: number }[] | null {
    const w = this.width;
    const d = this.depth;

    // Flat arrays for performance
    const gScore = new Float64Array(w * d).fill(Infinity);
    const closed = new Uint8Array(w * d);
    // cameFrom stores parent index (z * w + x), -1 means no parent
    const cameFrom = new Int32Array(w * d).fill(-1);

    const idx = (x: number, z: number) => z * w + x;

    gScore[idx(sx, sz)] = 0;
    const open = new MinHeap();
    open.push({ x: sx, z: sz, f: this.heuristic(sx, sz, ex, ez) });

    while (open.size > 0) {
      const cur = open.pop()!;
      const ci = idx(cur.x, cur.z);

      if (cur.x === ex && cur.z === ez) {
        return this.reconstructPath(cameFrom, idx, ex, ez);
      }

      if (closed[ci]) continue;
      closed[ci] = 1;

      for (const dir of DIRS) {
        const nx = cur.x + dir.dx;
        const nz = cur.z + dir.dz;

        if (!this.isInBounds(nx, nz)) continue;
        const ni = idx(nx, nz);
        if (closed[ni]) continue;
        if (!this.walkable[nz][nx]) continue;

        // Diagonal corner-cutting guard: both adjacent cardinals must not be blocked
        if (dir.dx !== 0 && dir.dz !== 0) {
          if (!this.walkable[cur.z][nx] && !this.walkable[nz][cur.x]) continue;
        }

        const tentativeG = gScore[ci] + dir.cost;
        if (tentativeG < gScore[ni]) {
          gScore[ni] = tentativeG;
          cameFrom[ni] = ci;
          open.push({ x: nx, z: nz, f: tentativeG + this.heuristic(nx, nz, ex, ez) });
        }
      }
    }

    return null; // no path found
  }

  private reconstructPath(
    cameFrom: Int32Array,
    idx: (x: number, z: number) => number,
    ex: number,
    ez: number,
  ): { x: number; z: number }[] {
    const path: { x: number; z: number }[] = [];
    let ci = idx(ex, ez);
    while (ci !== -1) {
      const x = ci % this.width;
      const z = (ci / this.width) | 0;
      path.push({ x, z });
      ci = cameFrom[ci];
    }
    path.reverse();
    return path;
  }

  /** Greedy line-of-sight path simplification */
  private smoothPath(path: THREE.Vector3[]): THREE.Vector3[] {
    if (path.length <= 2) return path;

    const result: THREE.Vector3[] = [path[0]];
    let current = 0;

    while (current < path.length - 1) {
      let farthest = current + 1;
      for (let i = path.length - 1; i > current + 1; i--) {
        if (this.hasLineOfSight(path[current], path[i])) {
          farthest = i;
          break;
        }
      }
      result.push(path[farthest]);
      current = farthest;
    }

    return result;
  }

  /** Bresenham line-of-sight check on the walkability grid */
  private hasLineOfSight(a: THREE.Vector3, b: THREE.Vector3): boolean {
    let x0 = Math.floor(a.x);
    let z0 = Math.floor(a.z);
    const x1 = Math.floor(b.x);
    const z1 = Math.floor(b.z);

    const dx = Math.abs(x1 - x0);
    const dz = Math.abs(z1 - z0);
    const sx = x0 < x1 ? 1 : -1;
    const sz = z0 < z1 ? 1 : -1;
    let err = dx - dz;

    while (true) {
      if (!this.isInBounds(x0, z0) || !this.walkable[z0][x0]) return false;
      if (x0 === x1 && z0 === z1) return true;

      const e2 = 2 * err;
      if (e2 > -dz) { err -= dz; x0 += sx; }
      if (e2 < dx) { err += dx; z0 += sz; }
    }
  }
}
