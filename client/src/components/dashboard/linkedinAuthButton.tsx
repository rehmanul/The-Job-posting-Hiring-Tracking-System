import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink, CheckCircle } from "lucide-react";

export default function LinkedInAuthButton() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: linkedinStatus } = useQuery({
    queryKey: ["/api/linkedin/status"],
    refetchInterval: 5000,
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/linkedin/auth");
      return response;
    },
    onSuccess: (data) => {
      if (data.authUrl) {
        window.open(data.authUrl, '_blank', 'width=600,height=600');
        toast({
          title: "LinkedIn Login",
          description: "Please complete authentication in the popup window.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to initiate LinkedIn login.",
        variant: "destructive",
      });
    },
  });

  const isAuthenticated = linkedinStatus?.authenticated;
  const isConfigured = linkedinStatus?.configured;

  if (!isConfigured) {
    return (
      <Button variant="outline" disabled>
        LinkedIn Not Configured
      </Button>
    );
  }

  if (isAuthenticated) {
    return (
      <Button variant="outline" disabled className="text-green-600">
        <CheckCircle className="mr-2 h-4 w-4" />
        LinkedIn Connected
      </Button>
    );
  }

  return (
    <Button
      onClick={() => {
        const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=869k65ec8a2utg&redirect_uri=${encodeURIComponent('http://localhost:3000/')}&scope=openid%20profile%20w_member_social%20email`;
        console.log('Opening LinkedIn auth URL:', authUrl);
        window.open(authUrl, '_blank', 'width=600,height=600');
      }}
      disabled={loginMutation.isPending}
      className="bg-blue-600 hover:bg-blue-700 text-white"
    >
      <ExternalLink className="mr-2 h-4 w-4" />
      Login to LinkedIn
    </Button>
  );
}