import { readFileSync } from "node:fs";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const { version } = JSON.parse(
	readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(version),
	},
	plugins: [cloudflare(), tailwindcss(), react()],
	resolve: {
		alias: {
			"@": "/src",
		},
	},
	server: {
		port: 4200,
	},
});
