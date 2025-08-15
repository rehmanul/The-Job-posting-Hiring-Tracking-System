import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, ExternalLink, Building2, Calendar, User, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { NewHire } from "@shared/schema";

export default function Hires() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("");

  const { data: hires, isLoading } = useQuery({
    queryKey: ["/api/hires"],
    refetchInterval: 10000,
  });

  const filteredHires = hires?.filter((hire: NewHire) => {
    const matchesSearch = !searchTerm || 
      hire.personName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hire.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hire.position.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCompany = !selectedCompany || hire.company === selectedCompany;
    
    return matchesSearch && matchesCompany;
  });

  const companies = [...new Set(hires?.map((hire: NewHire) => hire.company) || [])];

  const getConfidenceColor = (score: string) => {
    const numScore = parseFloat(score);
    if (numScore >= 90) return "bg-green-100 text-green-800";
    if (numScore >= 80) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "linkedin_scrape": return { color: "bg-blue-100 text-blue-800", label: "LinkedIn Scrape" };
      case "linkedin_announcement": return { color: "bg-blue-100 text-blue-800", label: "LinkedIn Post" };
      case "company_announcement": return { color: "bg-purple-100 text-purple-800", label: "Company Post" };
      default: return { color: "bg-gray-100 text-gray-800", label: source };
    }
  };

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
            <h2 className="text-2xl font-semibold text-gray-900">New Hires</h2>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search hires..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
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

          {/* Hires List */}
          <div className="space-y-4">
            {filteredHires?.map((hire: NewHire) => {
              const sourceBadge = getSourceBadge(hire.source);
              
              return (
                <Card key={hire.id} className="shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className={`text-white font-semibold ${getAvatarColor(hire.personName)}`}>
                            {getInitials(hire.personName)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                {hire.personName}
                              </h3>
                              <div className="flex items-center space-x-4 text-sm text-gray-600">
                                <div className="flex items-center">
                                  <Building2 className="mr-1 h-4 w-4" />
                                  {hire.company}
                                </div>
                                <div className="flex items-center">
                                  <User className="mr-1 h-4 w-4" />
                                  {hire.position}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Badge className={getConfidenceColor(hire.confidenceScore || "0")}>
                                {hire.confidenceScore}% confidence
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
                                Started: {hire.startDate 
                                  ? new Date(hire.startDate).toLocaleDateString()
                                  : 'Unknown'
                                }
                              </div>
                              <div className="flex items-center">
                                <Calendar className="mr-1 h-4 w-4" />
                                Found: {hire.foundDate 
                                  ? new Date(hire.foundDate).toLocaleDateString()
                                  : 'Unknown'
                                }
                              </div>
                            </div>
                            
                            {hire.linkedinProfile && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={hire.linkedinProfile} target="_blank" rel="noopener noreferrer">
                                  View Profile
                                  <ExternalLink className="ml-1 h-3 w-3" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {filteredHires?.length === 0 && (
            <div className="text-center py-12">
              <User className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hires found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || selectedCompany 
                  ? "Try adjusting your search criteria." 
                  : "No new hires have been detected yet."
                }
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
