"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ListOrdered, Menu } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Início", Icon: Home },
  { href: "/lancamentos", label: "Lançamentos", Icon: ListOrdered },
  { href: "/mais", label: "Mais", Icon: Menu },
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
