
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Users, CreditCard, Mail } from "lucide-react";

const activities = [
  {
    id: 1,
    type: "invoice",
    title: "Invoice INV-2024-001 created",
    description: "€2,500.00 for Malta Tech Solutions",
    time: "2 hours ago",
    icon: FileText,
    status: "created",
  },
  {
    id: 2,
    type: "payment",
    title: "Payment received",
    description: "€1,200.00 from European Logistics Ltd",
    time: "4 hours ago",
    icon: CreditCard,
    status: "received",
  },
  {
    id: 3,
    type: "customer",
    title: "New customer added",
    description: "Mediterranean Services Co.",
    time: "1 day ago",
    icon: Users,
    status: "new",
  },
  {
    id: 4,
    type: "reminder",
    title: "Payment reminder sent",
    description: "To Valletta Holdings for INV-2024-002",
    time: "2 days ago",
    icon: Mail,
    status: "sent",
  },
];

const statusColors = {
  created: "bg-blue-100 text-blue-800",
  received: "bg-green-100 text-green-800",
  new: "bg-purple-100 text-purple-800",
  sent: "bg-orange-100 text-orange-800",
};

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest updates from your receivables</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                <activity.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground truncate">
                    {activity.title}
                  </p>
                  <Badge variant="secondary" className={statusColors[activity.status]}>
                    {activity.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{activity.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
