import { ThemeToggle } from "@/components/theme-toggle";
import { TrendingChart } from "@/components/dashboard/TrendingChart";
import { RecentPostings } from "@/components/dashboard/RecentPostings";
import { SkillGapPlaceholder } from "@/components/dashboard/SkillGapPlaceholder";

export function Dashboard() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Skilltrace</h1>
            <p className="text-sm text-muted-foreground">Job market skill intelligence</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-8">
        <TrendingChart />
        <RecentPostings />
        <SkillGapPlaceholder />
      </main>
    </div>
  );
}
