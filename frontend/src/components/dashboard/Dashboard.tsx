import { AppHeader } from "@/components/layout/AppHeader";
import { TrendingChart } from "@/components/dashboard/TrendingChart";
import { RecentPostings } from "@/components/dashboard/RecentPostings";
import { SkillGapPlaceholder } from "@/components/dashboard/SkillGapPlaceholder";

export function Dashboard() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-8">
        <TrendingChart />
        <RecentPostings />
        <SkillGapPlaceholder />
      </main>
    </div>
  );
}
