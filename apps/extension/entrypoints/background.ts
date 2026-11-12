import { installOwnershipHandler } from "../src/ownership";
import { defineBackground } from "wxt/utils/define-background";
import { api, openImporter } from "../src/api";

export default defineBackground(() => {
	installOwnershipHandler();
	api.runtime.onInstalled.addListener(({ reason }) => {
		if (reason === "install") void openImporter(api);
	});
	// Setting an empty default popup makes the toolbar action launch a full tab.
	void api.action.setPopup({ popup: "" });
	api.action.onClicked.addListener(() => {
		void openImporter(api);
	});
});
