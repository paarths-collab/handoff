import { api, openImporter } from "../../src/api";
import "./popup.css";
document.querySelector("button")!.addEventListener("click", async () => {
	await openImporter(api);
	window.close();
});
