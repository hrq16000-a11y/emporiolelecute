import { useState, useEffect } from 'react';
import { Package, Tags, Calendar, TrendingUp, ArrowUpRight, Plus, Sparkles, DollarSign, ShoppingCart, Users, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDbProducts, useDbCategories, useDbOccasions } from '@/hooks/useProducts';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import AdminRecentActivity from '@/components/admin/AdminRecentActivity';

interface Order {
  id: string;
  order_code: string;
  total: number;
  status: string;
  created_at: string;
  customer_name: string;
}

const COLORS = ['hsl(12, 76%, 61%)', 'hsl(12, 60%, 70%)', 'hsl(12, 50%, 80%)', 'hsl(12, 40%, 85%)', 'hsl(0, 0%, 80%)'];

const AdminDashboard = () => {
  const { data: products, isLoading: loadingProducts } = useDbProducts();
  const { data: categories, isLoading: loadingCategories } = useDbCategories();
  const { data: occasions, isLoading: loadingOccasions } = useDbOccasions();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setOrders(data);
      }
      setLoadingOrders(false);
    };
    fetchOrders();
  }, []);

  // Calculate stats
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total), 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const completedOrders = orders.filter(o => o.status === 'delivered').length;
  const uniqueCustomers = new Set(orders.map(o => o.customer_name.toLowerCase())).size;

  // Sales data for chart (last 7 days)
  const getLast7DaysSales = () => {
    const days: { name: string; vendas: number; pedidos: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' });
      
      const dayOrders = orders.filter(o => 
        o.created_at.split('T')[0] === dateStr
      );
      
      days.push({
        name: dayName.charAt(0).toUpperCase() + dayName.slice(1, 3),
        vendas: dayOrders.reduce((sum, o) => sum + Number(o.total), 0),
        pedidos: dayOrders.length,
      });
    }
    return days;
  };

  // Orders by status for pie chart
  const getOrdersByStatus = () => {
    const statusMap: Record<string, number> = {};
    orders.forEach(o => {
      const status = o.status || 'pending';
      statusMap[status] = (statusMap[status] || 0) + 1;
    });
    
    const statusLabels: Record<string, string> = {
      pending: 'Pendente',
      confirmed: 'Confirmado',
      production: 'Em Produção',
      shipped: 'Enviado',
      delivered: 'Entregue',
      cancelled: 'Cancelado',
    };
    
    return Object.entries(statusMap).map(([status, value]) => ({
      name: statusLabels[status] || status,
      value,
    }));
  };

  const salesData = getLast7DaysSales();
  const statusData = getOrdersByStatus();

  const stats = [
    {
      title: 'Faturamento Total',
      value: loadingOrders ? '...' : `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`,
      icon: DollarSign,
      gradient: 'from-emerald-500 to-emerald-600',
      bgGlow: 'bg-emerald-500/20',
    },
    {
      title: 'Total de Pedidos',
      value: loadingOrders ? '...' : orders.length,
      icon: ShoppingCart,
      gradient: 'from-primary/80 to-primary',
      bgGlow: 'bg-primary/20',
    },
    {
      title: 'Pedidos Pendentes',
      value: loadingOrders ? '...' : pendingOrders,
      icon: Package,
      gradient: 'from-amber-500 to-amber-600',
      bgGlow: 'bg-amber-500/20',
    },
    {
      title: 'Clientes',
      value: loadingOrders ? '...' : uniqueCustomers,
      icon: Users,
      gradient: 'from-violet-500 to-violet-600',
      bgGlow: 'bg-violet-500/20',
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="relative">
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">Bem-vindo de volta!</span>
          </div>
          <h1 className="text-4xl font-display font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Acompanhe suas vendas, pedidos e métricas de desempenho</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, index) => (
          <Card 
            key={stat.title} 
            className={cn(
              "relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group",
              "animate-fade-in-up"
            )}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300", stat.bgGlow, "blur-xl")} />
            <CardContent className="relative p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {stat.title}
                  </p>
                  <p className="text-3xl font-bold text-foreground tracking-tight">{stat.value}</p>
                </div>
                <div className={cn("p-3 rounded-xl bg-gradient-to-br shadow-lg", stat.gradient)}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <Card className="lg:col-span-2 border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-display flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Vendas dos Últimos 7 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesData}>
                  <defs>
                    <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(12, 76%, 61%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(12, 76%, 61%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Vendas']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="vendas" 
                    stroke="hsl(12, 76%, 61%)" 
                    strokeWidth={2}
                    fill="url(#colorVendas)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Orders by Status */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-display flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Pedidos por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <Card className="lg:col-span-2 border-0 shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-display flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Pedidos Recentes
              </CardTitle>
              <Link 
                to="/admin/pedidos" 
                className="text-sm text-primary hover:text-primary-dark font-medium flex items-center gap-1 group"
              >
                Ver todos
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="w-12 h-12 rounded-xl bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : orders.length > 0 ? (
              <div className="space-y-3">
                {orders.slice(0, 5).map((order) => (
                  <Link 
                    key={order.id} 
                    to={`/admin/pedidos?order=${order.order_code}`}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary-light flex items-center justify-center">
                      <Package className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                        #{order.order_code}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {order.customer_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        R$ {Number(order.total).toFixed(2).replace('.', ',')}
                      </p>
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        order.status === 'delivered' && 'bg-emerald-100 text-emerald-700',
                        order.status === 'pending' && 'bg-amber-100 text-amber-700',
                        order.status === 'shipped' && 'bg-blue-100 text-blue-700',
                        order.status === 'production' && 'bg-violet-100 text-violet-700',
                        order.status === 'cancelled' && 'bg-red-100 text-red-700',
                      )}>
                        {order.status === 'pending' ? 'Pendente' :
                         order.status === 'confirmed' ? 'Confirmado' :
                         order.status === 'production' ? 'Em Produção' :
                         order.status === 'shipped' ? 'Enviado' :
                         order.status === 'delivered' ? 'Entregue' :
                         order.status === 'cancelled' ? 'Cancelado' : order.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ShoppingCart className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum pedido ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl font-display flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Ações Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              to="/admin/produtos/novo"
              className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 transition-all group border border-primary/10"
            >
              <div className="p-2.5 rounded-lg bg-primary text-white shadow-lg shadow-primary/25 group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <span className="text-foreground font-medium block">Novo Produto</span>
                <span className="text-xs text-muted-foreground">Adicione ao catálogo</span>
              </div>
            </Link>
            <Link
              to="/admin/pedidos"
              className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 hover:from-emerald-500/20 hover:to-emerald-500/10 transition-all group border border-emerald-500/10"
            >
              <div className="p-2.5 rounded-lg bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 group-hover:scale-110 transition-transform">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <span className="text-foreground font-medium block">Ver Pedidos</span>
                <span className="text-xs text-muted-foreground">Gerencie os pedidos</span>
              </div>
            </Link>
            <Link
              to="/admin/clientes"
              className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-violet-500/5 hover:from-violet-500/20 hover:to-violet-500/10 transition-all group border border-violet-500/10"
            >
              <div className="p-2.5 rounded-lg bg-violet-500 text-white shadow-lg shadow-violet-500/25 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-foreground font-medium block">Clientes</span>
                <span className="text-xs text-muted-foreground">Veja os clientes</span>
              </div>
            </Link>
            <Link
              to="/admin/configuracoes"
              className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-blue-500/5 hover:from-blue-500/20 hover:to-blue-500/10 transition-all group border border-blue-500/10"
            >
              <div className="p-2.5 rounded-lg bg-blue-500 text-white shadow-lg shadow-blue-500/25 group-hover:scale-110 transition-transform">
                <Tags className="w-5 h-5" />
              </div>
              <div>
                <span className="text-foreground font-medium block">Configurações</span>
                <span className="text-xs text-muted-foreground">Configure a loja</span>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>

      <AdminRecentActivity />
    </div>
  );
};

export default AdminDashboard;