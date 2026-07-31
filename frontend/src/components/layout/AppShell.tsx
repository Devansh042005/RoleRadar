"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/ask", label: "Ask" },
  { href: "/profile", label: "Profile" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "border-l-2 px-4 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--signal)]",
              isActive
                ? "border-signal text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function RailFooter() {
  return (
    <div className="mt-auto flex items-center justify-between border-t border-border px-4 py-3">
      <div className="flex size-6 items-center justify-center rounded-sm border border-border font-mono text-[11px] text-muted-foreground">
        N
      </div>
      <ThemeToggle />
    </div>
  );
}

function SideRail() {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[220px] flex-col border-r border-border bg-surface md:flex">
      <div className="px-4 py-5">
        <span className="font-display text-lg font-medium tracking-tight text-foreground">
          Skilltrace
        </span>
      </div>
      <NavLinks />
      <RailFooter />
    </aside>
  );
}

function MobileTopBar() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
      <span className="font-display text-base font-medium tracking-tight text-foreground">
        Skilltrace
      </span>
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-4" />
        </Button>
        <SheetContent side="left" className="w-[220px] gap-0 border-r border-border bg-surface p-0 sm:max-w-[220px]">
          <div className="px-4 py-5">
            <span className="font-display text-lg font-medium tracking-tight text-foreground">
              Skilltrace
            </span>
          </div>
          <NavLinks onNavigate={() => setOpen(false)} />
          <RailFooter />
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function AppShell({
  children,
  banner,
}: {
  children: React.ReactNode;
  banner?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background md:pl-[220px]">
      <SideRail />
      <MobileTopBar />
      {banner}
      <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">{children}</main>
    </div>
  );
}
