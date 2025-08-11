import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building2, User, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { NewHire } from "@shared/schema";

export default function HiresTable() {
  const { data: hires, isLoading } = useQuery({
    queryKey: ["/api/hires"],
    queryParams: { limit: 5 },
    refetchInterval: 30000,
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-gradient-to-br from-blue-400 to-purple-500',
      'bg-gradient-to-br from-green-400 to-blue-500',
      'bg-gradient-to-br from-purple-400 to-pink-500',
      'bg-gradient-to-br from-red-400 to-orange-500',
      'bg-gradient-to-br from-yellow-400 to-red-500',
      'bg-gradient-to-br from-indigo-400 to-blue-500',
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

  const getConfidenceColor = (score: string) => {
    const numScore = parseFloat(score);
    if (numScore >= 90) return "bg-green-100 text-green-800";
    if (numScore >= 80) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  if (isLoading) {
    return (
      <Card className="shadow-sm border border-gray-100">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-gray-900">Latest New Hires</CardTitle>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mt-1"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border border-gray-100">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">Latest New Hires</CardTitle>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Showing {Math.min(hires?.length || 0, 5)} of {hires?.length || 0}</span>
            <Button variant="ghost" size="sm" className="text-primary hover:text-blue-700">
              View All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {hires?.slice(0, 5).map((hire: NewHire) => (
            <div key={hire.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={`text-white font-semibold ${getAvatarColor(hire.personName)}`}>
                    {getInitials(hire.personName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">{hire.personName}</h4>
                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                    <div className="flex items-center">
                      <Building2 className="mr-1 h-3 w-3" />
                      {hire.company}
                    </div>
                    <div className="flex items-center">
                      <User className="mr-1 h-3 w-3" />
                      {hire.position}
                    </div>
                    <span>{hire.startDate ? new Date(hire.startDate).toLocaleDateString() : 'Recently'}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Badge className={getConfidenceColor(hire.confidenceScore || "0")}>
                  {hire.confidenceScore}%
                </Badge>
                {hire.linkedinProfile && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={hire.linkedinProfile} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
          
          {(!hires || hires.length === 0) && (
            <div className="text-center py-8">
              <User className="mx-auto h-8 w-8 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No new hires</h3>
              <p className="mt-1 text-sm text-gray-500">No new hires have been detected yet.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
