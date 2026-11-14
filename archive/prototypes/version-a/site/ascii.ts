// Decorative ASCII fields and the looping progress bar in the hero terminal.
// Pure presentation: no network, no storage. Honors prefers-reduced-motion.

const RAMP = " .:-=+*#%@";
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
const dark = window.matchMedia("(prefers-color-scheme: dark)");

function field(canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const cellW = 11;
	const cellH = 18;
	let cols = 0;
	let rows = 0;
	let ink = "";
	let accent = "";
	let visible = true;
	let raf = 0;
	let last = 0;
	const pointer = { x: -1e4, y: -1e4 };

	function colors() {
		const style = getComputedStyle(canvas);
		ink = style.getPropertyValue("--tm-faint").trim() || "#9aa29e";
		accent = style.getPropertyValue("--tm-accent").trim() || "#1d5a45";
	}
	function resize() {
		const rect = canvas.getBoundingClientRect();
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.max(1, Math.round(rect.width * dpr));
		canvas.height = Math.max(1, Math.round(rect.height * dpr));
		ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
		cols = Math.ceil(rect.width / cellW);
		rows = Math.ceil(rect.height / cellH);
		ctx!.font = `500 12px ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace`;
		ctx!.textBaseline = "top";
		draw(last);
	}
	function draw(time: number) {
		const t = time / 1000;
		ctx!.clearRect(0, 0, canvas.width, canvas.height);
		for (let y = 0; y < rows; y++) {
			for (let x = 0; x < cols; x++) {
				let v =
					Math.sin(x * 0.085 + t * 0.6) +
					Math.sin(y * 0.16 - t * 0.45) +
					Math.sin((x + y) * 0.045 + t * 0.3) +
					Math.sin(Math.hypot(x - cols * 0.7, y - rows * 0.4) * 0.12 - t * 0.8);
				v = (v + 4) / 8;
				const px = x * cellW;
				const py = y * cellH;
				const d = Math.hypot(px - pointer.x, py - pointer.y);
				const near = d < 140 ? 1 - d / 140 : 0;
				v = Math.min(1, v ** 2.4 + near * 0.55);
				const char = RAMP[Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))];
				if (char === " ") continue;
				const hot = v > 0.62 || near > 0.35;
				ctx!.fillStyle = hot ? accent : ink;
				ctx!.globalAlpha = hot ? 0.55 + near * 0.45 : 0.35 + v * 0.5;
				ctx!.fillText(char, px, py);
			}
		}
		ctx!.globalAlpha = 1;
	}
	function loop(time: number) {
		raf = 0;
		if (!visible || reduced.matches) return;
		if (time - last > 50) {
			last = time;
			draw(time);
		}
		raf = requestAnimationFrame(loop);
	}
	function start() {
		if (!raf && visible && !reduced.matches) raf = requestAnimationFrame(loop);
	}

	colors();
	new ResizeObserver(resize).observe(canvas);
	new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		start();
	}).observe(canvas);
	dark.addEventListener("change", () => {
		colors();
		draw(last);
	});
	reduced.addEventListener("change", () => {
		draw(last);
		start();
	});
	const host = canvas.parentElement ?? canvas;
	host.addEventListener("pointermove", (event) => {
		const rect = canvas.getBoundingClientRect();
		pointer.x = event.clientX - rect.left;
		pointer.y = event.clientY - rect.top;
		if (reduced.matches) draw(last);
	});
	host.addEventListener("pointerleave", () => {
		pointer.x = pointer.y = -1e4;
		if (reduced.matches) draw(last);
	});
	start();
}

function progress(el: HTMLElement) {
	const width = 24;
	let step = 0;
	const render = () => {
		const filled = Math.min(width, step);
		const pct = Math.round((filled / width) * 100);
		el.textContent = `${"█".repeat(filled)}${"░".repeat(width - filled)} ${String(pct).padStart(3, " ")}%`;
	};
	if (reduced.matches) {
		step = width;
		render();
		return;
	}
	render();
	setInterval(() => {
		step = step >= width + 10 ? 0 : step + 1;
		render();
	}, 110);
}

// A slowly turning ASCII globe: Lambert shading plus longitude bands.
function sphere(el: HTMLElement) {
	const rows = Number(el.dataset.rows) || 22;
	const cols = rows * 2 + 2;
	const ramp = " .,:;=+*#%@";
	const render = (t: number) => {
		const lines: string[] = [];
		const lx = Math.cos(t * 0.4) * 0.8;
		const lz = 0.6;
		const ly = -0.45;
		for (let r = 0; r < rows; r++) {
			let line = "";
			const y = ((r + 0.5) / rows) * 2 - 1;
			for (let c = 0; c < cols; c++) {
				const x = ((c + 0.5) / cols) * 2 - 1;
				const d = x * x + y * y;
				if (d > 1) {
					line += " ";
					continue;
				}
				const z = Math.sqrt(1 - d);
				const light = Math.max(0, x * lx + y * ly + z * lz);
				const lon = Math.atan2(x, z) + t * 0.5;
				const lat = Math.asin(y);
				const band =
					(Math.abs(Math.sin(lon * 4)) < 0.12 ? 0.35 : 0) +
					(Math.abs(Math.sin(lat * 5)) < 0.1 ? 0.25 : 0);
				const v = Math.min(0.999, light * 0.85 + band * (0.4 + light));
				line += ramp[Math.floor(v * ramp.length)];
			}
			lines.push(line.replace(/\s+$/, ""));
		}
		el.textContent = lines.join("\n");
	};
	let visible = true;
	new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
	}).observe(el);
	render(0.6);
	if (reduced.matches) return;
	const begin = performance.now();
	setInterval(() => {
		if (visible) render((performance.now() - begin) / 1000 + 0.6);
	}, 60);
}

function spotlight(el: HTMLElement) {
	el.addEventListener("pointermove", (event) => {
		const rect = el.getBoundingClientRect();
		el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
		el.style.setProperty("--my", `${event.clientY - rect.top}px`);
	});
}

for (const el of document.querySelectorAll<HTMLElement>("[data-ascii-sphere]"))
	sphere(el);
for (const el of document.querySelectorAll<HTMLElement>("[data-spotlight]"))
	spotlight(el);
for (const canvas of document.querySelectorAll<HTMLCanvasElement>(
	"canvas[data-ascii-field]",
))
	field(canvas);
for (const el of document.querySelectorAll<HTMLElement>("[data-ascii-progress]"))
	progress(el);
