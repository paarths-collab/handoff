export interface Library {
  schemaVersion: 1;
  source: { platform: 'macos' | 'windows' | 'unknown'; parsedAt: string; sourceHash: string };
  favorites: Node[];               // Arc Favorites (shared across Spaces)
  spaces: Space[];                 // in Arc's sidebar order
  report: ParseReport;
}
export interface Space {
  arcId: string;
  title: string;
  titleGenerated: boolean;         // true when Arc stored no title ("Space 2")
  profile: string | null;          // label only; null = unknown
  color: string | null;            // primary hex color if stored; null = unknown
  icon: string | null;             // emoji if stored
  pinned: Node[];
  today: Node[];                   // Arc's unpinned section
}
export type Node = TabNode | FolderNode;
export interface TabNode {
  kind: 'tab'; arcId: string;
  url: string;                     // exactly as stored
  title: string;                   // display: custom ?? savedTitle ?? host ?? url
  customTitle: string | null;
  savedTitle: string | null;
}
export interface FolderNode { kind: 'folder'; arcId: string; title: string; children: Node[] }

export interface ParseReport {
  counts: { spaces: number; tabs: number; folders: number; favorites: number; today: number; skipped: number };
  skipped: { arcId: string; reason: 'unsupported-kind' | 'no-url'; detail: string }[]; // detail = kind key, e.g. "easel"
  warnings: Warning[];
}
export type Warning =
  | { kind: 'generated-title'; target: 'space' | 'folder' | 'tab'; arcId: string }
  | { kind: 'order-mismatch'; parentArcId: string }
  | { kind: 'orphan-recovered'; arcId: string }      // parent missing → "Recovered items" folder
  | { kind: 'cycle-broken'; arcId: string }
  | { kind: 'split-view-flattened'; arcId: string }
  | { kind: 'depth-limited'; arcId: string }
  | { kind: 'unknown-field'; path: string };         // key names only, never values

export type ParseError =
  | { kind: 'invalid-pack'; message: string }
  | { kind: 'unsupported-pack-version'; message: string }
  | { kind: 'not-json'; message: string }
  | { kind: 'not-arc-file'; message: string; hint: string }
  | { kind: 'no-sidebar-data'; message: string; hint: string }
  | { kind: 'too-large'; message: string; limitBytes: number };
