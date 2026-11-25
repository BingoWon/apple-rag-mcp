export const DOC_CHANGE_KINDS = [
	"added",
	"deprecated",
	"beta_changed",
	"signature_changed",
	"content_revised",
	"removed",
	"video_added",
] as const;

export type DocChangeKind = (typeof DOC_CHANGE_KINDS)[number];
export type DocChangeSignificance = "high" | "medium" | "low";
export type DocSweepSource = "radar" | "sweep" | "videos" | "backfill";
export type DigestPeriodType = "daily" | "weekly";

export interface DocChangeFlags {
	platforms_added?: string[];
	platforms_changed?: string[];
	beta_added?: boolean;
	beta_removed?: boolean;
	deprecated_added?: boolean;
	declaration_changed?: boolean;
	topics_added?: number;
	topics_removed?: number;
	lines_added?: number;
	lines_removed?: number;
	is_framework_root?: boolean;
}

export interface DocChangeEventItem {
	id: number;
	url: string;
	framework: string;
	title: string;
	symbol_kind: string | null;
	change_kind: DocChangeKind;
	significance: DocChangeSignificance;
	sweep_source: DocSweepSource;
	summary: string;
	change_flags: DocChangeFlags;
	diff_snippet: string | null;
	source_modified_at: string | null;
	detected_at: string;
}

export interface DigestHighlight {
	framework: string;
	title: string;
	summary: string;
	urls: string[];
}

export interface DigestAlert {
	kind: "deprecated" | "beta" | "removed" | "breaking";
	framework: string;
	title: string;
	note: string;
	url: string;
}

export interface DigestLocaleContent {
	headline: string;
	overview: string;
	strategy_notes: string[];
	highlights: DigestHighlight[];
	alerts: DigestAlert[];
}

export interface DigestStats {
	total_events: number;
	high_significance: number;
	frameworks_touched: number;
	by_kind: Record<string, number>;
	top_frameworks: Array<{ framework: string; count: number }>;
}

export interface DocChangeDigest {
	id: number;
	period_type: DigestPeriodType;
	period_key: string;
	window_start: string;
	window_end: string;
	status: "ready" | "fallback";
	provider: string;
	model: string;
	neurons_estimated: number;
	stats: DigestStats;
	content_en: DigestLocaleContent;
	content_zh: DigestLocaleContent;
	generated_at: string;
}

export interface CollectorHeartbeat {
	last_run_at: string | null;
	last_sweep_source: DocSweepSource | null;
	last_duration_ms: number | null;
	scanned_24h: number;
	not_modified_24h: number;
	changed_24h: number;
	changed_7d: number;
	radar_runs_24h: number;
	sweep_runs_24h: number;
}

export interface UpdatesSummaryResponse {
	heartbeat: CollectorHeartbeat;
	latest_daily: DocChangeDigest | null;
	latest_weekly: DocChangeDigest | null;
	top_frameworks_7d: Array<{ framework: string; count: number }>;
	top_frameworks_30d: Array<{ framework: string; count: number }>;
	by_kind_7d: Record<string, number>;
	by_kind_30d: Record<string, number>;
	generated_at: string;
}

export interface UpdatesFeedResponse {
	events: DocChangeEventItem[];
	total: number;
	has_more: boolean;
}

export interface UpdatesDigestsResponse {
	digests: DocChangeDigest[];
}

const KNOWN_FRAMEWORKS: Record<string, string> = {
	swiftui: "SwiftUI",
	uikit: "UIKit",
	appkit: "AppKit",
	foundation: "Foundation",
	foundationmodels: "FoundationModels",
	swift: "Swift",
	swiftdata: "SwiftData",
	coredata: "Core Data",
	coreml: "Core ML",
	coregraphics: "Core Graphics",
	coreaudio: "Core Audio",
	corebluetooth: "Core Bluetooth",
	coreimage: "Core Image",
	corelocation: "Core Location",
	coremedia: "Core Media",
	coremotion: "Core Motion",
	corenfc: "Core NFC",
	corespotlight: "Core Spotlight",
	coretext: "Core Text",
	corevideo: "Core Video",
	realitykit: "RealityKit",
	arkit: "ARKit",
	metal: "Metal",
	metalkit: "MetalKit",
	metalperformanceshaders: "Metal Performance Shaders",
	storekit: "StoreKit",
	widgetkit: "WidgetKit",
	activitykit: "ActivityKit",
	appintents: "App Intents",
	vision: "Vision",
	visionkit: "VisionKit",
	webkit: "WebKit",
	mapkit: "MapKit",
	healthkit: "HealthKit",
	homekit: "HomeKit",
	cloudkit: "CloudKit",
	passkit: "PassKit",
	callkit: "CallKit",
	carplay: "CarPlay",
	avfoundation: "AVFoundation",
	avkit: "AVKit",
	combine: "Combine",
	observation: "Observation",
	network: "Network",
	security: "Security",
	cryptokit: "CryptoKit",
	authenticationservices: "AuthenticationServices",
	localauthentication: "LocalAuthentication",
	usernotifications: "UserNotifications",
	photokit: "PhotoKit",
	photos: "Photos",
	photosui: "PhotosUI",
	charts: "Swift Charts",
	tipkit: "TipKit",
	weatherkit: "WeatherKit",
	musickit: "MusicKit",
	gamekit: "GameKit",
	spritekit: "SpriteKit",
	scenekit: "SceneKit",
	xcode: "Xcode",
	xctest: "XCTest",
	testing: "Swift Testing",
	docc: "DocC",
	technologies: "Technologies",
	updates: "Apple Updates",
	"xcode-release-notes": "Xcode Release Notes",
	"ios-ipados-release-notes": "iOS & iPadOS Release Notes",
	"macos-release-notes": "macOS Release Notes",
	"visionos-release-notes": "visionOS Release Notes",
	"watchos-release-notes": "watchOS Release Notes",
	"tvos-release-notes": "tvOS Release Notes",
	"safari-release-notes": "Safari Release Notes",
};

export function isFrameworkRootUrl(url: string): boolean {
	return /^https:\/\/developer\.apple\.com\/documentation\/[^/?#]+\/?$/i.test(url);
}

export function isReleaseNotesUrl(url: string): boolean {
	return /^https:\/\/developer\.apple\.com\/documentation\/([^/?#]*-release-notes|updates)(\/|$)/i.test(
		url,
	);
}

export function extractFrameworkFromUrl(url: string, moduleHint?: string | null): string {
	if (url.startsWith("https://developer.apple.com/videos/play/")) {
		return "WWDC Videos";
	}
	const trimmedHint = moduleHint?.trim();
	if (trimmedHint && trimmedHint.length <= 64) {
		const lowerHint = trimmedHint.toLowerCase();
		return KNOWN_FRAMEWORKS[lowerHint] ?? trimmedHint;
	}
	try {
		const pathname = new URL(url).pathname.replace(/\/+$/, "");
		const parts = pathname.split("/").filter(Boolean);
		if (parts[0]?.toLowerCase() === "documentation" && parts[1]) {
			const slug = parts[1].toLowerCase();
			if (KNOWN_FRAMEWORKS[slug]) return KNOWN_FRAMEWORKS[slug];
			return slug
				.split("-")
				.map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : ""))
				.join(" ");
		}
	} catch {}
	return "Apple Developer";
}
