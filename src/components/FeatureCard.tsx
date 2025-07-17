
import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  action: string;
  onClick: () => void;
}

export function FeatureCard({ title, description, icon: Icon, action, onClick }: FeatureCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" className="w-full">
          {action}
        </Button>
      </CardContent>
    </Card>
  );
}
