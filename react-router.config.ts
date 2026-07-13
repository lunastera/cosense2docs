import { copyFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "@react-router/dev/config";

/** Determine the base path for GitHub Pages */
function getBasePath(): string | undefined {
  const repo = process.env.GITHUB_REPOSITORY?.split("/").pop();
  return repo ? `/${repo}/` : undefined;
}

export default {
  ssr: false,
  basename: getBasePath() ?? "/",
  splitRouteModules: true,
  // SPA fallback for GitHub Pages: it serves 404.html for unknown paths, so a
  // direct visit / reload on a sub-route still loads the app.
  buildEnd({ reactRouterConfig }) {
    const clientDir = join(reactRouterConfig.buildDirectory, "client");
    copyFileSync(join(clientDir, "index.html"), join(clientDir, "404.html"));
  },
} satisfies Config;
