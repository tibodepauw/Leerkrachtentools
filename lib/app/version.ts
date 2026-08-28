import packageJson from "../../package.json";

export interface AppVersionInfo {
  version: string;
  commit: string | null;
  githubRepo: string | null;
}

export function getAppVersionInfo(): AppVersionInfo {
  const version =
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() || packageJson.version;
  const commit = process.env.NEXT_PUBLIC_APP_COMMIT?.trim() || null;
  const githubRepo = process.env.NEXT_PUBLIC_GITHUB_REPO?.trim() || null;

  return { version, commit, githubRepo };
}
