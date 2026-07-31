import { AppShell } from "@/components/layout/AppShell";
import { MarketTicker } from "@/components/dashboard/MarketTicker";
import { TrendingChart } from "@/components/dashboard/TrendingChart";
import { RecentPostings } from "@/components/dashboard/RecentPostings";
import { RecommendedPostings } from "@/components/dashboard/RecommendedPostings";
import { SkillGapCard } from "@/components/dashboard/SkillGapCard";

export function Dashboard() {
  return (
    <AppShell banner={<MarketTicker />}>
      <div className="space-y-10">
        <TrendingChart />
        <RecommendedPostings />
        <RecentPostings />
        <SkillGapCard />
      </div>
    </AppShell>
  );
}
