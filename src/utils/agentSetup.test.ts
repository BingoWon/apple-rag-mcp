import assert from "node:assert/strict";
import test from "node:test";
import { generateCLIInstallPrompt } from "./agentSetup";

test("CLI setup gives agents bounded setup prompts without asking users to handle credentials", () => {
	for (const language of ["en", "zh"]) {
		const prompt = generateCLIInstallPrompt(language);
		for (const command of [
			"apple-rag-cli",
			"22.20",
			"skills/apple-dev-docs/SKILL.md",
			"auth status --json",
			"auth login --no-browser",
			"auth login --device --no-browser",
			"doctor --json",
			"https://apple-rag.com/llms.txt",
		])
			assert.ok(prompt.includes(command));
		assert.match(
			prompt,
			language === "en" ? /wait for me to sign in and approve/ : /等待我在浏览器中登录并确认设备/,
		);
		assert.match(
			prompt,
			language === "en" ? /Do not switch connections/ : /不要遇到错误就自动切换重试/,
		);
		assert.doesNotMatch(prompt, /ar_cli_|at_[a-f0-9]{32}/);
	}
});
