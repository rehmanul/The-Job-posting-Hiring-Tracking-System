import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Plus, UserPlus, RefreshCw, AlertTriangle, Database } from "lucide-react";

export default function ActivityFeed() {
  const { data: activities, isLoading } = useQuery({
    queryKey: ["/api/dashboard/activity"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getActivityIcon = (type: string, service: string) => {
    if (service === 'job_tracker' && type === 'info') return Plus;
    if (service === 'hire_tracker' && type === 'info') return UserPlus;
    if (type === 'error') return AlertTriangle;
    if (service === 'google_sheets') return Database;
    return RefreshCw;
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'error': return 'bg-red-100 text-red-600';
      case 'warn': return 'bg-yellow-100 text-warning';
      case 'info': default: return 'bg-green-100 text-secondary';
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm border border-gray-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">Recent Activity</CardTitle>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start space-x-3 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mt-1"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const defaultActivities = [
    {
      id: '1',
      type: 'info',
      service: 'job_tracker',
      message: 'New job found at Stripe - Senior Software Engineer',
      timestamp: new Date(Date.now() - 2 * 60 * 1000)
    },
    {
      id: '2',
      type: 'info',
      service: 'hire_tracker',
      message: 'New hire detected at OpenAI - Sarah Johnson, ML Engineer',
      timestamp: new Date(Date.now() - 5 * 60 * 1000)
    },
    {
      id: '3',
      type: 'info',
      service: 'job_tracker',
      message: 'Scan completed for Google - 3 new jobs, 1 new hire',
      timestamp: new Date(Date.now() - 8 * 60 * 1000)
    },
    {
      id: '4',
      type: 'warn',
      service: 'linkedin',
      message: 'Rate limit reached for LinkedIn - Pausing for 30 minutes',
      timestamp: new Date(Date.now() - 15 * 60 * 1000)
    },
    {
      id: '5',
      type: 'info',
      service: 'google_sheets',
      message: 'Google Sheets updated - 45 new records synced',
      timestamp: new Date(Date.now() - 18 * 60 * 1000)
    },
  ];

  const displayActivities = activities && activities.length > 0 ? activities : defaultActivities;

  return (
    <Card className="shadow-sm border border-gray-100">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Recent Activity</CardTitle>
          <Button variant="ghost" size="sm" className="text-primary hover:text-blue-700">
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayActivities.slice(0, 5).map((activity: any) => {
            const Icon = getActivityIcon(activity.type, activity.service);
            const timeAgo = Math.floor((Date.now() - new Date(activity.timestamp).getTime()) / (1000 * 60));
            
            return (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getActivityColor(activity.type)}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {timeAgo < 1 ? 'Just now' : `${timeAgo} minute${timeAgo > 1 ? 's' : ''} ago`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
