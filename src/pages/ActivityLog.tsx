import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow, subDays, startOfDay, endOfDay } from "date-fns";
import { 
  FileText, 
  CreditCard, 
  Users, 
  Mail, 
  MessageSquare, 
  ArrowLeft,
  ChevronRight,
  Filter,
  Search,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Navigation } from "@/components/Navigation";

interface Activity {
  id: string;
  type: 'invoice' | 'payment' | 'customer' | 'email' | 'whatsapp' | 'credit';
  title: string;
  description: string;
  timestamp: Date;
  status: string;
  linkTo?: string;
}

const ITEMS_PER_PAGE = 25;

const fetchActivities = async (
  userId: string, 
  dateRange: string, 
  activityType: string,
  searchQuery: string,
  page: number
): Promise<{ activities: Activity[]; hasMore: boolean }> => {
  const activities: Activity[] = [];
  
  // Calculate date filter
  let startDate: Date | null = null;
  const now = new Date();
  
  switch (dateRange) {
    case 'today':
      startDate = startOfDay(now);
      break;
    case '7days':
      startDate = subDays(now, 7);
      break;
    case '30days':
      startDate = subDays(now, 30);
      break;
    case '90days':
      startDate = subDays(now, 90);
      break;
    default:
      startDate = null;
  }

  const dateFilter = startDate ? startDate.toISOString() : null;

  // Fetch based on activity type filter
  const shouldFetch = (type: string) => activityType === 'all' || activityType === type;

  // 1. Invoices
  if (shouldFetch('invoices')) {
    let query = supabase
      .from('invoices')
      .select('id, invoice_number, total_amount, issued_at, is_issued, customers(name)')
      .eq('user_id', userId)
      .eq('is_issued', true)
      .order('issued_at', { ascending: false });
    
    if (dateFilter) {
      query = query.gte('issued_at', dateFilter);
    }
    
    const { data: invoices } = await query.limit(50);
    
    if (invoices) {
      invoices.forEach((inv: any) => {
        const customerName = inv.customers?.name || 'Unknown Customer';
        if (!searchQuery || 
            inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customerName.toLowerCase().includes(searchQuery.toLowerCase())) {
          activities.push({
            id: `invoice-${inv.id}`,
            type: 'invoice',
            title: `Invoice ${inv.invoice_number} issued`,
            description: `€${Number(inv.total_amount || 0).toFixed(2)} for ${customerName}`,
            timestamp: new Date(inv.issued_at),
            status: 'issued',
            linkTo: `/invoices/${inv.id}`
          });
        }
      });
    }
  }

  // 2. Payments
  if (shouldFetch('payments')) {
    let query = supabase
      .from('payments')
      .select('id, amount, created_at, invoice_id, invoices!payments_invoice_id_fkey(invoice_number, customers(name))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }
    
    const { data: payments } = await query.limit(50);
    
    if (payments) {
      payments.forEach((pmt: any) => {
        const invoice = pmt.invoices;
        const customerName = invoice?.customers?.name || 'Unknown Customer';
        const invoiceNumber = invoice?.invoice_number || 'Unknown';
        if (!searchQuery || 
            invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customerName.toLowerCase().includes(searchQuery.toLowerCase())) {
          activities.push({
            id: `payment-${pmt.id}`,
            type: 'payment',
            title: 'Payment received',
            description: `€${Number(pmt.amount || 0).toFixed(2)} from ${customerName}`,
            timestamp: new Date(pmt.created_at),
            status: 'received',
            linkTo: `/invoices/${pmt.invoice_id}`
          });
        }
      });
    }
  }

  // 3. Customers
  if (shouldFetch('customers')) {
    let query = supabase
      .from('customers')
      .select('id, name, business_name, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }
    
    const { data: customers } = await query.limit(50);
    
    if (customers) {
      customers.forEach((cust: any) => {
        const displayName = cust.business_name || cust.name;
        if (!searchQuery || displayName.toLowerCase().includes(searchQuery.toLowerCase())) {
          activities.push({
            id: `customer-${cust.id}`,
            type: 'customer',
            title: 'New customer added',
            description: displayName,
            timestamp: new Date(cust.created_at),
            status: 'new',
            linkTo: `/customers/${cust.id}`
          });
        }
      });
    }
  }

  // 4. Document send logs (emails/WhatsApp)
  if (shouldFetch('emails')) {
    let query = supabase
      .from('document_send_logs')
      .select('id, document_type, document_number, channel, sent_at, success, document_id')
      .eq('user_id', userId)
      .eq('success', true)
      .order('sent_at', { ascending: false });
    
    if (dateFilter) {
      query = query.gte('sent_at', dateFilter);
    }
    
    const { data: sendLogs } = await query.limit(50);
    
    if (sendLogs) {
      sendLogs.forEach((log: any) => {
        if (!searchQuery || log.document_number?.toLowerCase().includes(searchQuery.toLowerCase())) {
          const isWhatsApp = log.channel === 'whatsapp';
          activities.push({
            id: `send-${log.id}`,
            type: isWhatsApp ? 'whatsapp' : 'email',
            title: isWhatsApp ? 'WhatsApp message sent' : 'Email sent',
            description: `${log.document_type} ${log.document_number}`,
            timestamp: new Date(log.sent_at),
            status: 'sent',
            linkTo: log.document_type === 'invoice' ? `/invoices/${log.document_id}` : undefined
          });
        }
      });
    }
  }

  // 5. Credit notes
  if (shouldFetch('credits')) {
    let query = supabase
      .from('credit_notes')
      .select('id, credit_note_number, amount, created_at, customers(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }
    
    const { data: creditNotes } = await query.limit(50);
    
    if (creditNotes) {
      creditNotes.forEach((cn: any) => {
        const customerName = cn.customers?.name || 'Unknown Customer';
        if (!searchQuery || 
            cn.credit_note_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            customerName.toLowerCase().includes(searchQuery.toLowerCase())) {
          activities.push({
            id: `credit-${cn.id}`,
            type: 'credit',
            title: `Credit note ${cn.credit_note_number} issued`,
            description: `€${Number(cn.amount || 0).toFixed(2)} for ${customerName}`,
            timestamp: new Date(cn.created_at),
            status: 'credited',
            linkTo: '/credit-notes'
          });
        }
      });
    }
  }

  // Sort by timestamp descending
  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Paginate
  const start = page * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const paginatedActivities = activities.slice(start, end);
  const hasMore = activities.length > end;

  return { activities: paginatedActivities, hasMore };
};

const getActivityIcon = (type: Activity['type']) => {
  switch (type) {
    case 'invoice':
      return <FileText className="h-4 w-4 text-primary" />;
    case 'payment':
      return <CreditCard className="h-4 w-4 text-green-600" />;
    case 'customer':
      return <Users className="h-4 w-4 text-blue-600" />;
    case 'email':
      return <Mail className="h-4 w-4 text-purple-600" />;
    case 'whatsapp':
      return <MessageSquare className="h-4 w-4 text-green-500" />;
    case 'credit':
      return <FileText className="h-4 w-4 text-orange-600" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground" />;
  }
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, string> = {
    issued: 'bg-primary/10 text-primary',
    received: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    sent: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    credited: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };
  
  return (
    <Badge variant="secondary" className={`text-xs ${variants[status] || ''}`}>
      {status}
    </Badge>
  );
};

export default function ActivityLog() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState('30days');
  const [activityType, setActivityType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['activity-log', user?.id, dateRange, activityType, searchQuery, page],
    queryFn: () => fetchActivities(user!.id, dateRange, activityType, searchQuery, page),
    enabled: !!user?.id,
  });

  const activities = data?.activities || [];
  const hasMore = data?.hasMore || false;

  // Reset page when filters change
  const handleFilterChange = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(0);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Navigation />
      <main className="flex-1 p-4 md:p-6 lg:p-8 md:ml-64">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Link 
              to="/" 
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
            <p className="text-muted-foreground">Complete timeline of your business activities</p>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="pt-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search activities..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(0);
                      }}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={dateRange} onValueChange={handleFilterChange(setDateRange)}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="30days">Last 30 days</SelectItem>
                    <SelectItem value="90days">Last 90 days</SelectItem>
                    <SelectItem value="all">All time</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={activityType} onValueChange={handleFilterChange(setActivityType)}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="invoices">Invoices</SelectItem>
                    <SelectItem value="payments">Payments</SelectItem>
                    <SelectItem value="customers">Customers</SelectItem>
                    <SelectItem value="emails">Emails</SelectItem>
                    <SelectItem value="credits">Credit Notes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activities</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No activities found</p>
                  <p className="text-sm text-muted-foreground/70">
                    Try adjusting your filters or date range
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {activities.map((activity, index) => (
                    <div key={activity.id}>
                      {activity.linkTo ? (
                        <Link
                          to={activity.linkTo}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                        >
                          <div className="mt-0.5 p-2 rounded-full bg-muted">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground truncate">
                                {activity.title}
                              </p>
                              {getStatusBadge(activity.status)}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {activity.description}
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                            </p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-2" />
                        </Link>
                      ) : (
                        <div className="flex items-start gap-3 p-3 rounded-lg">
                          <div className="mt-0.5 p-2 rounded-full bg-muted">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground truncate">
                                {activity.title}
                              </p>
                              {getStatusBadge(activity.status)}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {activity.description}
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                              {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      )}
                      {index < activities.length - 1 && (
                        <div className="ml-6 border-l-2 border-muted h-2" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {(hasMore || page > 0) && (
                <div className="flex justify-center gap-2 mt-6 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasMore}
                  >
                    Load More
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
