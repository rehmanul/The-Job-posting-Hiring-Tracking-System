import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, ExternalLink, Calendar, Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Company } from "@shared/schema";

export default function Companies() {
  const { data: companies, isLoading } = useQuery({
    queryKey: ["/api/companies"],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64">
          <div className="p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
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
            <h2 className="text-2xl font-semibold text-gray-900">Companies</h2>
            <Button className="bg-primary hover:bg-blue-600 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Add Company
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies?.map((company: Company) => (
              <Card key={company.id} className="shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-primary bg-opacity-10 rounded-lg flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-gray-900">{company.name}</CardTitle>
                        <Badge variant={company.isActive ? "default" : "secondary"} className="mt-1">
                          {company.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {company.website && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Globe className="h-4 w-4" />
                      <a 
                        href={company.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-primary flex items-center"
                      >
                        Website
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  )}
                  
                  {company.linkedinUrl && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Building2 className="h-4 w-4" />
                      <a 
                        href={company.linkedinUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-primary flex items-center"
                      >
                        LinkedIn
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  )}
                  
                  {company.careerPageUrl && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Globe className="h-4 w-4" />
                      <a 
                        href={company.careerPageUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-primary flex items-center"
                      >
                        Careers
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2 text-sm text-gray-500 pt-2 border-t">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Last scanned: {company.lastScanned 
                        ? new Date(company.lastScanned).toLocaleDateString()
                        : 'Never'
                      }
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {companies?.length === 0 && (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No companies</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding a new company to track.</p>
              <div className="mt-6">
                <Button className="bg-primary hover:bg-blue-600 text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Company
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
