import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function LinkedInCookieUploader() {
  const { toast } = useToast();
  const [cookieJson, setCookieJson] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    setLoading(true);
    try {
      let cookies;
      try {
        cookies = JSON.parse(cookieJson);
      } catch {
        toast({ title: "Invalid JSON", description: "Paste valid JSON array of cookies exported from your browser.", variant: "destructive" });
        setLoading(false);
        return;
      }
      if (!Array.isArray(cookies) || cookies.length === 0) {
        toast({ title: "No Cookies", description: "Paste a non-empty JSON array of LinkedIn cookies.", variant: "destructive" });
        setLoading(false);
        return;
      }
      const res = await fetch("/api/linkedin/session-cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies }),
      });
      if (res.ok) {
  toast({ title: "Cookies Uploaded", description: "LinkedIn session cookies updated. Tracker will now use authenticated scraping.", variant: "default" });
        setCookieJson("");
      } else {
        const data = await res.json();
        toast({ title: "Upload Failed", description: data.error || "Failed to upload cookies.", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Unexpected error uploading cookies.", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="linkedin-cookies">Paste LinkedIn Session Cookies (JSON array)</Label>
      <Input
        id="linkedin-cookies"
        type="text"
        value={cookieJson}
        onChange={e => setCookieJson(e.target.value)}
        placeholder='[{"name":"li_at","value":"...","domain":".linkedin.com",...}]'
        className="font-mono"
      />
      <Button onClick={handleUpload} disabled={loading} className="mt-2">
        {loading ? "Uploading..." : "Upload LinkedIn Cookies"}
      </Button>
    </div>
  );
}
