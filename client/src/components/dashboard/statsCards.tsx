import { Card, CardContent } from "@/components/ui/card";
import { Building2, Briefcase, Users, Heart, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const cards = [
    {
      title: "Companies Tracked",
      value: stats?.companiesTracked || 0,
      change: "+2 this month",
      icon: Building2,
      iconBg: "bg-blue-100",
      iconColor: "text-primary"
    },
    {
      title: "New Jobs Today",
      value: stats?.newJobsToday || 0,
      change: "+15% vs yesterday",
      icon: Briefcase,
      iconBg: "bg-green-100",
      iconColor: "text-secondary"
    },
    {
      title: "New Hires Today",
      value: stats?.newHiresToday || 0,
      change: "+3 from LinkedIn",
      icon: Users,
      iconBg: "bg-purple-100",
      iconColor: "text-accent"
    },
    {
      title: "Success Rate",
      value: `${stats?.successRate || 96.8}%`,
      change: "System healthy",
      icon: Heart,
      iconBg: "bg-green-100",
      iconColor: "text-secondary"
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </div>
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        
        return (
          <Card key={index} className="shadow-sm border border-gray-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="text-3xl font-semibold text-gray-900 mt-2">{card.value}</p>
                  <p className="text-sm text-secondary mt-1 flex items-center">
                    <TrendingUp className="mr-1 h-3 w-3" />
                    {card.change}
                  </p>
                </div>
                <div className={`w-12 h-12 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`text-xl ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
