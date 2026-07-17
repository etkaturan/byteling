/**
 * Release data for the download page. Hardcoded in v4; in v5 this becomes a
 * fetch from the GitHub API or a backend. Pages read from this file rather
 * than fetching directly, so that swap touches one file, not every page.
 */

export type ReleaseAsset = {
  os: "windows" | "macos" | "linux";
  label: string;
  url: string;
  size: string;
  available: boolean;
};

export type Release = {
  version: string;
  headline: string;
  notes: string[];
  assets: ReleaseAsset[];
};

export const LATEST_RELEASE: Release = {
  version: "3.0.0",
  headline: "It moves",
  notes: [
    "Motion and inertia — drag it and its limbs trail behind it.",
    "A glowing trail, in its own hue, toggleable.",
    "Autonomous wandering — off by default, mannered when on.",
    "Clicks pass through empty space, even in games.",
    "Ninety-odd apps recognised by name.",
  ],
  assets: [
    {
      os: "windows",
      label: "Windows (x64)",
      url: "https://github.com/etkaturan/byteling/releases/download/v3.0.0/byteling_3.0.0_x64-setup.exe",
      size: "3.8 MB",
      available: true,
    },
    { os: "macos", label: "macOS", url: "", size: "—", available: false },
    { os: "linux", label: "Linux", url: "", size: "—", available: false },
  ],
};

export function primaryAsset(release: Release): ReleaseAsset {
  return release.assets.find((a) => a.available) ?? release.assets[0];
}