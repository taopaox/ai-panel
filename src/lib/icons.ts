const iconModules = import.meta.glob("../assets/icons/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const iconUrls: Record<string, string> = {};
for (const [path, url] of Object.entries(iconModules)) {
  const name = path.split("/").pop()?.replace(/\.svg$/, "");
  if (name) {
    iconUrls[name] = url;
  }
}

export function iconUrlFor(logo?: string): string | undefined {
  if (!logo) {
    return undefined;
  }
  return iconUrls[logo];
}
