import { AppHeader } from "@/components/layout/AppHeader";
import { TrendingChart } from "@/components/dashboard/TrendingChart";
import { RecentPostings } from "@/components/dashboard/RecentPostings";
import { RecommendedPostings } from "@/components/dashboard/RecommendedPostings";
import { SkillGapCard } from "@/components/dashboard/SkillGapCard";

export function Dashboard() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-6 py-8">
        <TrendingChart />
        <RecommendedPostings />
        <RecentPostings />
        <SkillGapCard />
      </main>
    </div>
  );
}
