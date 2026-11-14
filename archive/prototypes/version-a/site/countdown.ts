const today = new Date();
const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
const remaining = Math.ceil((Date.UTC(2026, 11, 22) - now) / 86400000);
if (remaining > 0)
	for (const badge of document.querySelectorAll<HTMLElement>("[data-days]"))
		badge.textContent = badge.dataset.days!.replace("{n}", String(remaining));
