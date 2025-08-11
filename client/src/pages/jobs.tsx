import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ExternalLink, MapPin, Building2, Calendar, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { JobPosting } from "@shared/schema";

export default function Jobs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["/api/jobs"],
    refetchInterval: 30000,
  });

  const filteredJobs = jobs?.filter((job: JobPosting) => {
    const matchesSearch = !searchTerm || 
      job.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCompany = !selectedCompany || job.company === selectedCompany;

    const matchesSource = selectedSources.length === 0 || selectedSources.includes(job.source);

    const matchesDepartment = selectedDepartments.length === 0 || 
      (job.department && selectedDepartments.includes(job.department));

    return matchesSearch && matchesCompany && matchesSource && matchesDepartment;
  });

  const companies = [...new Set(jobs?.map((job: JobPosting) => job.company) || [])];
  const sources = [...new Set(jobs?.map((job: JobPosting) => job.source) || [])];
  const departments = [...new Set(jobs?.map((job: JobPosting) => job.department) || [])].filter(Boolean) as string[];

  const getConfidenceColor = (score: string) => {
    const numScore = parseFloat(score);
    if (numScore >= 90) return "bg-green-100 text-green-800";
    if (numScore >= 80) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "linkedin": return { color: "bg-blue-100 text-blue-800", label: "LinkedIn" };
      case "website": return { color: "bg-gray-100 text-gray-800", label: "Website" };
      case "careers_page": return { color: "bg-purple-100 text-purple-800", label: "Careers" };
      default: return { color: "bg-gray-100 text-gray-800", label: source };
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64">
          <div className="p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-64">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-8 py-4">
            <h2 className="text-2xl font-semibold text-gray-900">Job Postings</h2>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search jobs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="border-gray-300">
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Sources</h4>
                      {sources.map(source => (
                        <div key={source} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`source-${source}`}
                            checked={selectedSources.includes(source)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedSources([...selectedSources, source]);
                              } else {
                                setSelectedSources(selectedSources.filter(s => s !== source));
                              }
                            }}
                          />
                          <Label htmlFor={`source-${source}`} className="text-sm">
                            {source}
                          </Label>
                        </div>
                      ))}
                    </div>
                    {departments.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Departments</h4>
                        {departments.map(dept => (
                          <div key={dept} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`dept-${dept}`}
                              checked={selectedDepartments.includes(dept)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedDepartments([...selectedDepartments, dept]);
                                } else {
                                  setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                                }
                              }}
                            />
                            <Label htmlFor={`dept-${dept}`} className="text-sm">
                              {dept}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="pt-2 border-t">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedSources([]);
                          setSelectedDepartments([]);
                        }}
                      >
                        Clear All
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          {/* Company Filter */}
          <div className="mb-6">
            <div className="flex items-center space-x-2 flex-wrap">
              <Button
                variant={selectedCompany === "" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCompany("")}
              >
                All Companies
              </Button>
              {companies.slice(0, 6).map((company: string) => (
                <Button
                  key={company}
                  variant={selectedCompany === company ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCompany(company)}
                >
                  {company}
                </Button>
              ))}
            </div>
          </div>

          {/* Jobs List */}
          <div className="space-y-4">
            {filteredJobs?.map((job: JobPosting) => {
              const sourceBadge = getSourceBadge(job.source);

              return (
                <Card key={job.id} className="shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                              {job.jobTitle}
                            </h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <div className="flex items-center">
                                <Building2 className="mr-1 h-4 w-4" />
                                {job.company}
                              </div>
                              {job.location && (
                                <div className="flex items-center">
                                  <MapPin className="mr-1 h-4 w-4" />
                                  {job.location}
                                </div>
                              )}
                              {job.department && (
                                <div className="flex items-center">
                                  <span className="text-gray-400">•</span>
                                  <span className="ml-1">{job.department}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Badge className={getConfidenceColor(job.confidenceScore || "0")}>
                              {job.confidenceScore}% confidence
                            </Badge>
                            <Badge className={sourceBadge.color}>
                              {sourceBadge.label}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <div className="flex items-center">
                              <Calendar className="mr-1 h-4 w-4" />
                              Posted: {job.postedDate 
                                ? new Date(job.postedDate).toLocaleDateString()
                                : 'Unknown'
                              }
                            </div>
                            <div className="flex items-center">
                              <Calendar className="mr-1 h-4 w-4" />
                              Found: {job.foundDate 
                                ? new Date(job.foundDate).toLocaleDateString()
                                : 'Unknown'
                              }
                            </div>
                          </div>

                          {job.url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={job.url} target="_blank" rel="noopener noreferrer">
                                View Job
                                <ExternalLink className="ml-1 h-3 w-3" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredJobs?.length === 0 && (
            <div className="text-center py-12">
              <Search className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No jobs found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || selectedCompany || selectedSources.length > 0 || selectedDepartments.length > 0
                  ? "Try adjusting your search criteria." 
                  : "No job postings have been found yet."
                }
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}