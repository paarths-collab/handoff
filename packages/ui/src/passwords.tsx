import { useState } from "react";
import type { PasswordDestination, PasswordGuideProps } from "./types";

// Fixed, browser-provided pages. They are shown and copied, never opened from file data.
// Only addresses that are stable across versions are listed; others use menu steps.
const importPage: Partial<Record<PasswordDestination, string>> = {
	chrome: "chrome://password-manager/settings",
	firefox: "about:logins",
};
const importStep: Record<PasswordDestination, string> = {
	chrome: "choose Import passwords, then select the CSV.",
	brave:
		"Open Brave's Password Manager, go to its Settings, choose Import passwords and select the CSV.",
	edge: "Open Settings → Passwords (Microsoft Password Manager), choose Import passwords and select the CSV.",
	vivaldi:
		"Open Vivaldi's password settings, go to the Chromium password manager settings, choose Import passwords and select the CSV.",
	opera:
		"Open Settings, search for Password Manager, open its Settings, choose Import passwords and select the CSV.",
	firefox: "open the ··· menu, choose Import from a File, then select the CSV.",
};
const ARC_EXPORT = "arc://password-manager/settings";

function Address({ value }: { value: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<span className="tm-address">
			<code>{value}</code>
			<button
				type="button"
				className="tm-btn"
				onClick={() =>
					void navigator.clipboard
						.writeText(value)
						.then(() => {
							setCopied(true);
							setTimeout(() => setCopied(false), 1500);
						})
						.catch(() => {})
				}
			>
				{copied ? "Copied" : "Copy"}
			</button>
		</span>
	);
}

export function PasswordGuide({ destination }: PasswordGuideProps) {
	return (
		<section className="tm-passwords" aria-labelledby="tm-passwords-title">
			<h2 id="tm-passwords-title">Move your saved passwords</h2>
			<p>
				Handoff never reads your passwords. Arc and your new browser move them
				directly, using a file only you handle. Website sign-ins themselves
				don't transfer, so expect to sign in once per site.
			</p>
			<ol>
				<li>
					In Arc, paste this into the address bar, choose{" "}
					<strong>Export passwords</strong> and save the CSV somewhere private:{" "}
					<Address value={ARC_EXPORT} />
				</li>
				<li>
					In each browser profile that should have them,{" "}
					{importPage[destination] ? (
						<>
							open <Address value={importPage[destination]} /> and{" "}
							{importStep[destination]}
						</>
					) : (
						importStep[destination]
					)}
				</li>
				<li>
					Check a few sign-ins, then delete the CSV and empty the Trash. The
					file contains readable passwords.
				</li>
			</ol>
			<p>
				Repeat step 1 for each Arc profile whose passwords you want to move.
			</p>
		</section>
	);
}
