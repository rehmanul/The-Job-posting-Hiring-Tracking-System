import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Building2, 
  Briefcase, 
  Users, 
  BarChart3, 
  Heart, 
  Settings, 
  Search,
  Clock,
  Moon,
  Sun
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Companies", href: "/companies", icon: Building2, badge: "companiesCount" },
  { name: "Job Postings", href: "/jobs", icon: Briefcase, badge: "newJobsCount" },
  { name: "New Hires", href: "/hires", icon: Users, badge: "newHiresCount" },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Health Metrics", href: "/health", icon: Heart },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getBadgeValue = (badgeKey: string) => {
    switch (badgeKey) {
      case "companiesCount":
        return stats?.companiesTracked || 0;
      case "newJobsCount":
        return stats?.newJobsToday || 0;
      case "newHiresCount":
        return stats?.newHiresToday || 0;
      default:
        return 0;
    }
  };

  return (
    <aside className="w-64 bg-white shadow-lg fixed h-full z-10 border-r border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Search className="text-white text-lg" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Job Tracker</h1>
              <p className="text-sm text-gray-500">System v1.0.0</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-6 px-4">
        <div className="space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            const badgeValue = item.badge ? getBadgeValue(item.badge) : 0;
            
            return (
              <Link key={item.name} href={item.href}>
                <div className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                  isActive
                    ? "text-primary bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}>
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                  {item.badge && badgeValue > 0 && (
                    <span className={cn(
                      "ml-auto text-xs px-2 py-1 rounded-full",
                      item.badge === "companiesCount" && "bg-gray-200 text-gray-700",
                      item.badge === "newJobsCount" && "bg-secondary text-white",
                      item.badge === "newHiresCount" && "bg-accent text-white"
                    )}>
                      {badgeValue}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* System Status */}
        <div className="mt-8 px-4">
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              System Status
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">LinkedIn</span>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                  <span className="ml-2 text-xs text-gray-500">Active</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Google Sheets</span>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                  <span className="ml-2 text-xs text-gray-500">Synced</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Slack</span>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                  <span className="ml-2 text-xs text-gray-500">Connected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Last Scan Info */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="mr-2 h-4 w-4" />
            <span>
              Last scan: {stats?.lastScanTime 
                ? new Date(stats.lastScanTime).toLocaleTimeString()
                : 'Never'
              }
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
