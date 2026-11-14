// The same sample sidebar the website demo shows.
export type Profile = { name: string; account: string; color: string };
export type Space = {
	id: string;
	name: string;
	folders: { name: string; tabs: string[] }[];
	profile: Profile;
};

// Chrome profiles, each signed in to its own Google account.
export const WORK: Profile = {
	name: "Work",
	account: "Google account · work",
	color: "#1a73e8",
};
export const PERSONAL: Profile = {
	name: "Personal",
	account: "Google account · personal",
	color: "#e8710a",
};
export const SIDE: Profile = {
	name: "Side projects",
	account: "Google account · projects",
	color: "#188038",
};
export const PROFILES = [WORK, PERSONAL, SIDE];

export const SPACES: Space[] = [
	{
		id: "studio",
		name: "Studio",
		profile: WORK,
		folders: [
			{
				name: "Design references",
				tabs: [
					"Color studies",
					"Interface patterns",
					"Typography notes",
					"Layout library",
					"Motion references",
					"Design systems",
					"Inspiration",
				],
			},
			{
				name: "Projects",
				tabs: [
					"Website refresh",
					"Brand assets",
					"Product roadmap",
					"Prototype",
					"Feedback",
				],
			},
		],
	},
	{
		id: "research",
		name: "Research",
		profile: WORK,
		folders: [
			{
				name: "Reading list",
				tabs: ["Research methods", "Field notes", "Interviews", "Synthesis"],
			},
			{
				name: "Resources",
				tabs: ["Articles", "Bookmarks", "Case studies", "Reports"],
			},
		],
	},
	{
		id: "personal",
		name: "Personal",
		profile: PERSONAL,
		folders: [
			{ name: "Everyday", tabs: ["Mail", "Calendar", "Reading"] },
			{ name: "Travel", tabs: ["Places to visit", "Itinerary", "Saved stays"] },
		],
	},
];

export const tabCount = (space: Space) =>
	space.folders.reduce((n, folder) => n + folder.tabs.length, 0);
export const TOTAL_TABS = SPACES.reduce((n, s) => n + tabCount(s), 0);

// Browsers Handoff can open profiles in, as found on this Mac.
export const DETECTED = [
	{ name: "Chrome", image: "chrome.png" },
	{ name: "Brave", image: "brave.png" },
	{ name: "Edge", image: "edge.png" },
	{ name: "Vivaldi", image: "vivaldi.png" },
];

export const BROWSERS = [
	"chrome.png",
	"brave.png",
	"edge.png",
	"firefox.png",
	"safari.png",
	"vivaldi.png",
	"opera.png",
];
