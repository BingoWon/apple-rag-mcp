import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import zh from "./zh.json";

const STORAGE_KEY = "apple-rag-lang";

function detectLanguage(): string {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved === "en" || saved === "zh") return saved;
	return navigator.language.startsWith("zh") ? "zh" : "en";
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
	localStorage.setItem(STORAGE_KEY, lng);
	document.documentElement.lang = lng;
});

export default i18n;
