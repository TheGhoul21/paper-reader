/**
 * Schematic OneCanvas projection (Sec. 3.1–3.2, App. B.2 and B.5).
 *
 * A small, invented room explains the paper's formulas; it does not reconstruct
 * the rendered ScanNet scene of Figure 1. World coordinates follow the OpenCV
 * convention used by the paper: x right, y down, z forward, in metres, with y = 0
 * at the canvas origin's height. Every observation is one lifted patch: the same
 * surface may be observed in several frames, and different surfaces may share a
 * viewing direction.
 */

export interface SceneObject {
  id: string;
  name: string;
}

export interface Observation {
  object: string;
  /** World position p in metres. */
  p: [number, number, number];
  /** Source frame index t (1-based), the MRoPE temporal coordinate. */
  t: number;
}

export interface CanvasPose {
  /** Canvas origin c on the floor plan (x, z), at y = 0. */
  x: number;
  z: number;
  /** Yaw of the canvas forward axis in degrees, clockwise from world +z. */
  yaw: number;
}

export interface PlacedToken {
  objects: string[];
  /** Longitude θ and latitude φ in degrees. */
  theta: number;
  phi: number;
  /** MRoPE ids rescaled linearly to [0, 100]. */
  w: number;
  h: number;
  /** Frame index carried by the token (a mean for pooled cells). */
  t: number;
  /** Distance ‖q‖ from the canvas origin, metres (a mean for pooled cells). */
  radius: number;
  /** Number of lifted patches merged into this token. */
  patches: number;
}

export const ROOM = { minX: -3, maxX: 3, minZ: -2.2, maxZ: 2.2 };

export const SCENE_OBJECTS: SceneObject[] = [
  { id: "tv", name: "TV" },
  { id: "sofa", name: "Divano" },
  { id: "table", name: "Tavolo" },
  { id: "basket", name: "Cesto" },
  { id: "lamp", name: "Lampada" },
  { id: "door", name: "Porta" },
];

/**
 * Six frames of a short walk. The table and the basket on the floor behind it
 * lie on one viewing ray from the scene centre; TV, sofa and table are observed again later.
 */
export const OBSERVATIONS: Observation[] = [
  { object: "tv", p: [0, 0.4, 2.1], t: 1 },
  { object: "tv", p: [0.5, 0.4, 2.1], t: 1 },
  { object: "tv", p: [0.25, 0.4, 2.1], t: 4 },
  { object: "table", p: [1.5, 0.8, 0.5], t: 2 },
  { object: "table", p: [1.8, 0.8, 0.6], t: 2 },
  { object: "basket", p: [3, 1.6, 1], t: 5 },
  { object: "basket", p: [3, 1.45, 1], t: 5 },
  { object: "table", p: [1.5, 0.8, 0.5], t: 6 },
  { object: "sofa", p: [-0.8, 1, -1.5], t: 3 },
  { object: "sofa", p: [0, 1, -1.5], t: 3 },
  { object: "sofa", p: [0.4, 1, -1.6], t: 6 },
  { object: "lamp", p: [-2.5, 0, -1.8], t: 4 },
  { object: "door", p: [-0.15, -0.2, -2.2], t: 5 },
  { object: "door", p: [0.15, -0.2, -2.2], t: 5 },
];

export const CANVAS_PRESETS: { id: string; label: string; pose: CanvasPose }[] = [
  { id: "agent", label: "Agente sul divano, verso la TV", pose: { x: -0.5, z: -0.8, yaw: 15 } },
  { id: "centre", label: "Centro della scena", pose: { x: 0, z: 0, yaw: 0 } },
  { id: "outside", label: "Fuori dalla stanza", pose: { x: 0, z: -4.5, yaw: 0 } },
];

const DEG = 180 / Math.PI;

/** q = Rᵀ(p − c) for a canvas rotated by `yaw` about the vertical axis. */
export function canvasOffset(p: [number, number, number], pose: CanvasPose) {
  const a = pose.yaw / DEG;
  const dx = p[0] - pose.x;
  const dz = p[2] - pose.z;
  return [Math.cos(a) * dx - Math.sin(a) * dz, p[1], Math.sin(a) * dx + Math.cos(a) * dz] as const;
}

/** θ = atan2(q_x, q_z), φ = arctan(−q_y / √(q_x² + q_z²)), both in degrees. */
export function sphericalCoordinates(q: readonly [number, number, number]) {
  const [qx, qy, qz] = q;
  return { theta: Math.atan2(qx, qz) * DEG, phi: Math.atan2(-qy, Math.hypot(qx, qz)) * DEG };
}

/** Linear rescaling of θ ∈ [−180°, 180°] and φ ∈ [−90°, 90°] to [0, 100]. */
export function positionIds(theta: number, phi: number) {
  return { w: ((theta + 180) / 360) * 100, h: ((phi + 90) / 180) * 100 };
}

/** One token per lifted patch, at its continuous angular position. */
export function placeContinuous(
  pose: CanvasPose,
  observations: Observation[] = OBSERVATIONS,
): PlacedToken[] {
  return observations.map((o) => {
    const q = canvasOffset(o.p, pose);
    const { theta, phi } = sphericalCoordinates(q);
    return {
      objects: [o.object],
      theta,
      phi,
      ...positionIds(theta, phi),
      t: o.t,
      radius: Math.hypot(...q),
      patches: 1,
    };
  });
}

/**
 * The rasterization control of App. B.2: bin tokens into square angular cells,
 * mean-pool frame index and depth, and place the pooled token at the cell centre.
 */
export function rasterize(tokens: PlacedToken[], cellDegrees: number): PlacedToken[] {
  const cells = new Map<string, PlacedToken[]>();
  for (const token of tokens) {
    const col = Math.min(Math.floor((token.theta + 180) / cellDegrees), 360 / cellDegrees - 1);
    const row = Math.min(Math.floor((token.phi + 90) / cellDegrees), 180 / cellDegrees - 1);
    const key = `${col}:${row}`;
    cells.set(key, [...(cells.get(key) ?? []), token]);
  }
  return [...cells.entries()].map(([key, members]) => {
    const [col, row] = key.split(":").map(Number);
    const theta = (col + 0.5) * cellDegrees - 180;
    const phi = (row + 0.5) * cellDegrees - 90;
    const mean = (f: (x: PlacedToken) => number) =>
      members.reduce((s, x) => s + f(x) * x.patches, 0) /
      members.reduce((s, x) => s + x.patches, 0);
    return {
      objects: [...new Set(members.flatMap((m) => m.objects))].sort(),
      theta,
      phi,
      ...positionIds(theta, phi),
      t: mean((m) => m.t),
      radius: mean((m) => m.radius),
      patches: members.reduce((s, m) => s + m.patches, 0),
    };
  });
}

/** True first frame of each object: the minimum t over its observations. */
export function firstAppearance(observations: Observation[] = OBSERVATIONS) {
  const first = new Map<string, number>();
  for (const o of observations) first.set(o.object, Math.min(first.get(o.object) ?? Infinity, o.t));
  return first;
}

/**
 * First frame still readable from the tokens: the minimum carried t over the tokens
 * that contain the object. Pooling can raise it, which is the App. B.2 failure.
 */
export function readableFirstAppearance(tokens: PlacedToken[]) {
  const first = new Map<string, number>();
  for (const token of tokens)
    for (const object of token.objects)
      first.set(object, Math.min(first.get(object) ?? Infinity, token.t));
  return first;
}

/**
 * Objects whose tokens fall on both sides of the longitude seam: nearby in the
 * room, yet at opposite ends of the W range (App. B.5).
 */
export function seamSplitObjects(tokens: PlacedToken[], margin = 30) {
  const split = new Set<string>();
  for (const object of new Set(tokens.flatMap((t) => t.objects))) {
    const thetas = tokens.filter((t) => t.objects.includes(object)).map((t) => t.theta);
    if (thetas.some((th) => th > 180 - margin) && thetas.some((th) => th < -180 + margin))
      split.add(object);
  }
  return split;
}

/** World-frame direction of the seam (θ = ±180°), i.e. directly behind the canvas. */
export function seamDirection(pose: CanvasPose) {
  const a = pose.yaw / DEG;
  return [-Math.sin(a), -Math.cos(a)] as const;
}
