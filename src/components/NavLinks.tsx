"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Openings" },
  { href: "/applications", label: "Applications" },
  { href: "/add", label: "Add a post" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="-mx-1 flex min-w-0 gap-1 overflow-x-auto">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" || path.startsWith("/jobs") : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-compact font-semibold transition ${
              active ? "bg-surface text-fg" : "text-fg-2 hover:bg-surface hover:text-fg"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
