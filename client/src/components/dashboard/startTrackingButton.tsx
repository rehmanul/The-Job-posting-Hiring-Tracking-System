import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Play } from "lucide-react";

export default function StartTrackingButton() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const runNowMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/system/run-now"),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hires"] });
      toast({
        title: "Manual Scan Complete",
        description: (data as any)?.message || "The manual scan has finished successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to trigger manual scan.",
        variant: "destructive",
      });
    },
  });

  return (
    <Button
      onClick={() => runNowMutation.mutate()}
      disabled={runNowMutation.isPending}
      className="bg-blue-600 hover:bg-blue-700 text-white"
    >
      <Play className="mr-2 h-4 w-4" />
      Run Manual Scan
    </Button>
  );
}