import { AUTH_MARK, AUTH_STYLES } from "../../../shared/auth-presentation.js";

type PageState = "success" | "denied" | "error";
const copy = {
	en: {
		success: [
			"Your terminal is connected",
			"You can close this page and return to your terminal. Your CLI is ready to use.",
		],
		denied: [
			"Connection cancelled",
			"No access was granted. Return to your terminal to start a new login.",
		],
		error: [
			"Unable to connect",
			"We couldn't finish signing in. Return to your terminal and try again.",
		],
		label: "Terminal access",
		manage: "Manage connected devices",
		privacy: "Privacy",
		terms: "Terms",
	},
	zh: {
		success: ["终端已连接", "现在可以关闭此页面，返回终端继续使用 Apple RAG CLI。"],
		denied: ["已取消连接", "本次未授予访问权限。需要连接时，请返回终端重新登录。"],
		error: ["暂时无法连接", "登录未能完成，请返回终端重新运行登录命令。"],
		label: "终端访问",
		manage: "管理已连接的设备",
		privacy: "隐私政策",
		terms: "服务条款",
	},
};
const escapeHTML = (value: string) =>
	value.replace(
		/[&<>"']/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
	);
export function loginPage(
	state: PageState,
	origin: string,
	language: string,
	theme?: string,
): string {
	const lang = language.startsWith("zh") ? "zh" : "en",
		t = copy[lang],
		[title, description] = t[state];
	const appearance = theme === "dark" || theme === "light" ? theme : "";
	const icon =
		state === "success" ? '<path d="m6 12 4 4 8-8"/>' : '<path d="m7 7 10 10M17 7 7 17"/>';
	return `<!doctype html><html lang="${lang}" class="${appearance}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="referrer" content="no-referrer"><title>${title} · Apple RAG</title><link rel="icon" href="data:image/svg+xml,${encodeURIComponent(AUTH_MARK)}"><style>html,body{margin:0;padding:0}${AUTH_STYLES}</style></head><body><main class="auth-page"><header class="auth-top"><a class="auth-brand" href="${escapeHTML(origin)}"><span class="auth-brand-mark">${AUTH_MARK}</span>Apple RAG</a></header><div class="auth-center"><section class="auth-card"><div class="auth-status" role="${state === "error" ? "alert" : "status"}"><div class="auth-status-icon" data-tone="${state === "success" ? "success" : state === "denied" ? "neutral" : "error"}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></div><p class="auth-kicker">${t.label}</p><h1 class="auth-title">${title}</h1><p class="auth-description">${description}</p>${state === "success" ? `<div class="auth-actions"><a class="auth-secondary" href="${escapeHTML(origin)}/settings#cli-access" rel="noreferrer">${t.manage} &rarr;</a></div>` : '<div class="auth-command">apple-rag auth login</div>'}</div></section></div><footer class="auth-footer"><span>Apple RAG</span><a href="${escapeHTML(origin)}/privacy-policy" rel="noreferrer">${t.privacy}</a><a href="${escapeHTML(origin)}/terms-of-service" rel="noreferrer">${t.terms}</a></footer></main></body></html>`;
}
