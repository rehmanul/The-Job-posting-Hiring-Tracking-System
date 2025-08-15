import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { JobPosting } from "@shared/schema";

export default function JobsTable() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["/api/jobs"],
    refetchInterval: 10000,
  });

  const getCompanyInitial = (company: string) => {
    return company.charAt(0).toUpperCase();
  };

  const getCompanyColor = (company: string) => {
    const colors = [
      'bg-primary bg-opacity-10 text-primary',
      'bg-secondary bg-opacity-10 text-secondary',
      'bg-accent bg-opacity-10 text-accent',
      'bg-warning bg-opacity-10 text-warning',
      'bg-error bg-opacity-10 text-error',
    ];
    const index = company.length % colors.length;
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
            <CardTitle className="text-lg font-semibold text-gray-900">Latest Job Postings</CardTitle>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-3 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
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
          <CardTitle className="text-lg font-semibold text-gray-900">Latest Job Postings</CardTitle>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Showing {Math.min(jobs?.length || 0, 5)} of {jobs?.length || 0}</span>
            <Button variant="ghost" size="sm" className="text-primary hover:text-blue-700" asChild>
              <Link href="/jobs">View All</Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {jobs?.slice(0, 5).map((job: JobPosting) => (
            <div key={job.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getCompanyColor(job.company)}`}>
                  <span className="font-semibold text-sm">{getCompanyInitial(job.company)}</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">{job.jobTitle}</h4>
                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                    <div className="flex items-center">
                      <Building2 className="mr-1 h-3 w-3" />
                      {job.company}
                    </div>
                    {job.location && (
                      <div className="flex items-center">
                        <MapPin className="mr-1 h-3 w-3" />
                        {job.location}
                      </div>
                    )}
                    <span>{job.foundDate ? new Date(job.foundDate).toLocaleDateString() : 'Recently'}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Badge className={getConfidenceColor(job.confidenceScore || "0")}>
                  {job.confidenceScore}%
                </Badge>
                {job.url && (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={job.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
          
          {(!jobs || jobs.length === 0) && (
            <div className="text-center py-8">
              <Building2 className="mx-auto h-8 w-8 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs found</h3>
              <p className="mt-1 text-sm text-gray-500">No job postings have been discovered yet.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
