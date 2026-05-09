export const navKeys = ["/", "/candidates", "/companies", "/jobs", "/manager-review", "/sourcing"] as const;

export function getSelectedMenuKey(pathname: string) {
  if (pathname === "/") return "/";
  const matches = navKeys
    .filter((key) => key !== "/")
    .filter((key) => pathname === key || pathname.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length);
  return matches[0] ?? "/";
}
