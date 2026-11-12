import { createRoot } from "react-dom/client";
import { Importer } from "../../src/importer";
import "./style.css";

const fragment = location.hash;
if (fragment)
	history.replaceState(null, "", location.pathname + location.search);
createRoot(document.getElementById("root")!).render(
	<Importer fragment={fragment} />,
);
