import { AlertCircle } from "lucide-react";
import { ArcCard } from "@/components/ArcCard";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center gradient-bg">
      <ArcCard glowColor="purple" className="w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-rose-400" />
            <h1 className="text-2xl font-bold text-white">404 Page Not Found</h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Did you forget to add the page to the router?
          </p>
        </div>
      </ArcCard>
    </div>
  );
}
