
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Filter } from "lucide-react";

export function DashboardFilters() {
  return (
    <div className="flex items-center space-x-4 mb-6">
      <div className="flex items-center space-x-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filter by:</span>
      </div>
      
      <Select defaultValue="30-days">
        <SelectTrigger className="w-48">
          <Calendar className="h-4 w-4 mr-2" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7-days">Last 7 days</SelectItem>
          <SelectItem value="30-days">Last 30 days</SelectItem>
          <SelectItem value="90-days">Last 90 days</SelectItem>
          <SelectItem value="year">This year</SelectItem>
          <SelectItem value="custom">Custom range</SelectItem>
        </SelectContent>
      </Select>

      <Select defaultValue="all-customers">
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all-customers">All customers</SelectItem>
          <SelectItem value="acme">Acme Corporation</SelectItem>
          <SelectItem value="tech-solutions">Tech Solutions Ltd</SelectItem>
          <SelectItem value="global">Global Enterprises</SelectItem>
          <SelectItem value="local">Local Business</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm">
        Apply Filters
      </Button>
    </div>
  );
}
