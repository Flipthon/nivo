"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, List, MoreHorizontal } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Início", Icon: Home },
  { href: "/lancamentos", label: "Lançamentos", Icon: List },
  { href: "/mais", label: "Mais", Icon: MoreHorizontal },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <Icon size={22} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
