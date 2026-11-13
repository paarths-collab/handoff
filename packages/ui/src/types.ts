import type {
	ImportOptions,
	ImportPlan,
	Library,
	ParseError,
	Result,
} from "@handoff/core";

export interface FileDropProps {
	onLoaded(r: Result<Library, ParseError>, fileName: string): void;
} // accepts raw Arc file or pack
export interface PathHelperProps {
	platform: "macos" | "windows" | "unknown";
}
export interface PreviewTreeProps {
	library: Library;
	selectedSpaceIds: Set<string>;
	onChange(ids: Set<string>): void;
}
export interface OptionsPanelProps {
	value: ImportOptions;
	onChange(v: ImportOptions): void;
	capabilities: { groups: boolean; bookmarks: boolean };
}
export interface ProgressViewProps {
	done: number;
	total: number;
	onCancel(): void;
}
export interface ResultReportProps {
	plan: ImportPlan;
	result: {
		done: number;
		failed: { arcId: string; url: string; error: string }[];
		cancelled: boolean;
	};
	onUndo?(): void;
	onDownloadSkipped(): void;
}
export interface CopyDiagnosticButtonProps {
	library: Library;
	appVersion: string;
}
export type PasswordDestination =
	| "chrome"
	| "brave"
	| "edge"
	| "vivaldi"
	| "opera"
	| "firefox";
export interface PasswordGuideProps {
	destination: PasswordDestination;
}
