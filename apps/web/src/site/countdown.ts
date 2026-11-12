const today = new Date();
const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
const remaining = Math.ceil((Date.UTC(2026, 11, 22) - now) / 86400000);
const badge = document.querySelector("#days");
if (badge && remaining > 0) badge.textContent = ` · ${remaining} days left`;
