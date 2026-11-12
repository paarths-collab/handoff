export type GroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';
export interface ImportOptions {
  spaceIds: string[];                              // selected Spaces
  spaceMode: 'window' | 'group';                   // bookmark mode is an extension option using toBookmarksHtml
  folderMode: 'groups' | 'flatten';
  today: 'include' | 'skip';
  favorites: 'pinned-first-window' | 'skip';
  collapseGroups: boolean;                         // default true
  openableSchemes: string[];                       // default ['http:', 'https:']
  skipUrls?: ReadonlySet<string>;                  // URLs already open (only when the user opts in)
}
export interface ImportPlan {
  windows: PlannedWindow[];
  skipped: { arcId: string; url: string; reason: 'scheme' | 'empty-url' | 'by-choice' | 'duplicate' }[];
  notes: string[];                                 // e.g. "4 pinned tabs inside folders became group tabs"
  totals: { windows: number; tabs: number; pinned: number; groups: number };
}
export interface PlannedWindow { key: string; spaceArcId: string; tabs: PlannedTab[]; groups: PlannedGroup[] }
export interface PlannedTab { arcId: string; url: string; title: string; pinned: boolean; groupKey: string | null }
export interface PlannedGroup { key: string; title: string; color: GroupColor; collapsed: boolean }
