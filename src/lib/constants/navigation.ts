export const isActiveRoute = (pathname: string | null, href: string) => {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
};
