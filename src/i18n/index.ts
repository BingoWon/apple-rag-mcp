import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import zh from "./zh.json";

const STORAGE_KEY = "apple-rag-lang";

function detectLanguage(): string {
	try {
		if (typeof localStorage !== "undefined") {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved === "en" || saved === "zh") return saved;
		}
	} catch {
		// Ignore restricted storage environments (e.g. private browsing / SSR)
	}
	if (typeof navigator !== "undefined" && typeof navigator.language === "string") {
		return navigator.language.startsWith("zh") ? "zh" : "en";
	}
	return "en";
}

i18n.use(initReactI18next).init({
	resources: {
		en: { translation: en },
		zh: { translation: zh },
	},
	lng: detectLanguage(),
	fallbackLng: "en",
	interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
	try {
		if (typeof localStorage !== "undefined") {
			localStorage.setItem(STORAGE_KEY, lng);
		}
	} catch {
		// Ignore restricted storage environments
	}
	if (typeof document !== "undefined" && document.documentElement) {
		document.documentElement.lang = lng;
	}
});

export default i18n;
