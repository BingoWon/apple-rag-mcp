import { defineConfig } from "vite";

export default defineConfig({
	build: {
		ssr: "src/cli.ts",
		target: "node22",
		outDir: "dist",
		emptyOutDir: true,
		minify: false,
		rollupOptions: {
			external: [/^node:/, "@napi-rs/keyring", "zod"],
			output: { entryFileNames: "cli.js" },
		},
	},
});
