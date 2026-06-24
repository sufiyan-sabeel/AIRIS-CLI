/**
 * AIRIS Android Automation Types
 * Natural language -> ADB bridge
 */

/** Supported Android automation actions */
export type AndroidAction =
	| "check_device"
	| "screen_size"
	| "battery_status"
	| "back"
	| "home"
	| "recent_apps"
	| "tap"
	| "tap_center"
	| "swipe"
	| "scroll_up"
	| "scroll_down"
	| "input_text"
	| "keyevent"
	| "open_settings"
	| "open_camera"
	| "open_whatsapp"
	| "open_app"
	| "screenshot"
	| "pull_screenshot"
	| "dump_ui"
	| "read_screen"
	| "click_text"
	| "click_word"
	| "turn_flashlight_on"
	| "turn_flashlight_off"
	| "nl_execute";

/** Confidence level for intent detection */
export type IntentConfidence = "high" | "medium" | "low";

/** Confidence percentage thresholds for Android automation routing */
export const CONFIDENCE_THRESHOLDS = {
	high: 95,
	medium: 70,
	low: 50,
} as const;

export const AUTOMATION_CONFIDENCE_THRESHOLD = 85;

/** Safety category for actions */
export type SafetyCategory = "allowed" | "confirm" | "blocked";

/** Parsed Android intent from natural language */
export interface AndroidIntent {
	action: AndroidAction;
	confidence: IntentConfidence;
	safety: SafetyCategory;
	/** Confidence percentage (0-100) */
	confidencePercent: number;
	/** Extracted parameters (text, coordinates, app name, etc.) */
	params: Record<string, string | number>;
	/** Original user text */
	originalText: string;
	/** Human-readable description of what will happen */
	description: string;
}

/** Request to Python bridge */
export interface AndroidBridgeRequest {
	action: AndroidAction;
	/** Action-specific parameters */
	[key: string]: string | number | undefined;
}

/** Response from Python bridge */
export interface AndroidBridgeResponse {
	ok: boolean;
	action: string;
	message: string;
	data?: Record<string, unknown>;
	error?: string;
	help?: string;
}

/** Sensitive terms that are blocked from Android automation. */
export const BLOCKED_TERMS: readonly string[] = [
	"password",
	"passcode",
	"otp",
	"one time password",
	"upi",
	"upi pin",
	"payment",
	"pay ",
	"send money",
	"bank",
	"banking",
	"credential",
	"credentials",
	"private key",
	"seed phrase",
	"pin code",
	"cvv",
	"card number",
	"factory reset",
	"delete account",
	"delete file",
	"delete files",
	"wipe data",
	"format phone",
	"erase all",
	"uninstall",
	"remove app",
	"install apk",
	"install unknown",
	"login",
	"logout",
	"log out",
	"sign in",
	"sign out",
	"security settings",
	"change password",
	"change pin",
	"lock screen",
];

/** Sensitive actions that require explicit user confirmation before automation. */
export const CONFIRM_TERMS: readonly string[] = [
	"send message",
	"send whatsapp",
	"send sms",
	"call ",
	"phone call",
	"video call",
	"delete ",
	"uninstall",
	"remove app",
	"install apk",
	"install unknown",
	"payment",
	"pay ",
	"send money",
	"login",
	"logout",
	"log out",
	"sign in",
	"sign out",
	"security settings",
	"change password",
	"change pin",
];

/** Actions requiring confirmation when the intent is otherwise recognized. */
export const CONFIRM_ACTIONS: readonly AndroidAction[] = ["open_app"];

/** Actions that are safe without confirmation after sensitive-term screening. */
export const SAFE_ACTIONS: readonly AndroidAction[] = [
	"check_device",
	"screen_size",
	"battery_status",
	"back",
	"home",
	"recent_apps",
	"tap",
	"tap_center",
	"swipe",
	"scroll_up",
	"scroll_down",
	"input_text",
	"keyevent",
	"screenshot",
	"pull_screenshot",
	"dump_ui",
	"read_screen",
	"click_text",
	"click_word",
	"open_settings",
	"open_camera",
	"open_whatsapp",
	"turn_flashlight_on",
	"turn_flashlight_off",
	"nl_execute",
];

/** Common app package mappings */
export const APP_PACKAGES: Record<string, string> = {
	whatsapp: "com.whatsapp",
	settings: "com.android.settings",
	camera: "com.android.camera2",
	gallery: "com.android.gallery3d",
	photos: "com.google.android.apps.photos",
	chrome: "com.android.chrome",
	youtube: "com.google.android.youtube",
	maps: "com.google.android.apps.maps",
	music: "com.google.android.music",
	clock: "com.google.android.deskclock",
	calculator: "com.google.android.calculator",
	calendar: "com.google.android.calendar",
	contacts: "com.android.contacts",
	phone: "com.android.dialer",
	messages: "com.android.messaging",
	gmail: "com.google.android.gm",
	playstore: "com.android.vending",
	files: "com.android.filemanager",
};
