import { defaultOptions, planImport } from "@tab-mover/core";
import {
	CopyDiagnosticButton,
	FileDrop,
	OptionsPanel,
	PathHelper,
	PreviewTree,
	ProgressView,
	ResultReport,
} from "@tab-mover/ui";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { library } from "../../../../packages/core/test/builders";
import "./page.css";

const sample = library();
function Gallery() {
	const [lib, setLib] = useState(sample);
	const [selected, setSelected] = useState(
		new Set(sample.spaces.map((s) => s.arcId)),
	);
	const [options, setOptions] = useState(defaultOptions(sample));
	const [status, setStatus] = useState("");
	const plan = planImport(lib, options);
	return (
		<main className="converter-main">
			<h1>Component gallery</h1>
			<FileDrop
				onLoaded={(result) => {
					if (result.ok) {
						setLib(result.value);
						setSelected(new Set(result.value.spaces.map((s) => s.arcId)));
						setOptions(defaultOptions(result.value));
						setStatus("");
					} else setStatus(result.error.message);
				}}
			/>
			<p role="status">{status}</p>
			<PathHelper platform="unknown" />
			<PreviewTree
				library={lib}
				selectedSpaceIds={selected}
				onChange={(ids) => {
					setSelected(ids);
					setOptions({ ...options, spaceIds: [...ids] });
				}}
			/>
			<OptionsPanel
				value={options}
				onChange={setOptions}
				capabilities={{ groups: true, bookmarks: true }}
			/>
			<ProgressView
				done={0}
				total={plan.totals.tabs}
				onCancel={() => setStatus("Cancelled")}
			/>
			<ResultReport
				plan={plan}
				result={{ done: plan.totals.tabs, failed: [], cancelled: false }}
				onDownloadSkipped={() => setStatus("Skipped list requested")}
				onUndo={() => setStatus("Undo requested")}
			/>
			<CopyDiagnosticButton library={lib} appVersion="1.0.0" />
		</main>
	);
}
createRoot(document.getElementById("root")!).render(<Gallery />);
