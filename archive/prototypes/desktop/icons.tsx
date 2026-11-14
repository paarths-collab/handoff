const paths = {
	transfer: "M4 8h13m-4-4 4 4-4 4M20 16H7m4-4-4 4 4 4",
	panel: "M4 4h16v16H4zM9 4v16",
	review: "M3 6h6l2 2h10v11H3z",
	export: "M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5",
	arrow: "M4 12h15m-6-6 6 6-6 6",
	down: "m7 10 5 5 5-5",
	tick: "m5 12 4 4L19 6",
	lock: "M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3",
	file: "M6 3h8l4 4v14H6zM14 3v5h4",
	help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm-2.5-12a2.5 2.5 0 1 1 4 2c-1.2.8-1.5 1.3-1.5 2.5M12 16v.1",
	spaces: "m12 3 9 5-9 5-9-5 9-5zm-9 9 9 5 9-5m-18 4 9 5 9-5",
	tabs: "M3 6h18v13H3zM3 10h18",
	mac: "M3 4h18v13H3zM12 17v3m-4 1h8",
	windows: "M3 5l8-1v7H3zm10-1 8-1v8h-8zM3 13h8v7l-8-1zm10 0h8v8l-8-1z",
	back: "M20 12H5m6 6-6-6 6-6",
};
export function Icon({
	name,
	size = 18,
}: {
	name: keyof typeof paths;
	size?: number;
}) {
	return (
		<svg
			aria-hidden="true"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d={paths[name]} />
		</svg>
	);
}
export function Mark() {
	return (
		<img
			className="mark"
			width="38"
			height="38"
			src={new URL("./handoff-mark.png", import.meta.url).href}
			alt=""
		/>
	);
}
