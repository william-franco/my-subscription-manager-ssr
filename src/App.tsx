import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

type BillingCycle = 'monthly' | 'quarterly' | 'semiannual' | 'annual';
type SubscriptionStatus = 'active' | 'cancelled' | 'paused' | 'expired';
type Category = 'streaming' | 'software' | 'gaming' | 'education' | 'fitness' | 'news' | 'music' | 'cloud' | 'other';

interface Subscription {
  id: string;
  name: string;
  description: string;
  category: Category;
  price: number;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  status: SubscriptionStatus;
  website?: string;
  logo?: string;
  createdAt: number;
  startDate: string;
  autoRenew: boolean;
}

interface SubscriptionsData {
  subscriptions: Subscription[];
}

interface Alert {
  id: string;
  subscriptionId: string;
  subscriptionName: string;
  daysUntilRenewal: number;
  amount: number;
  nextBillingDate: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const isClient = typeof window !== 'undefined';

const CATEGORIES: { value: Category; label: string; icon: string; color: string }[] = [
  { value: 'streaming', label: 'Streaming', icon: '📺', color: '#ef4444' },
  { value: 'software', label: 'Software', icon: '💻', color: '#3b82f6' },
  { value: 'gaming', label: 'Gaming', icon: '🎮', color: '#8b5cf6' },
  { value: 'education', label: 'Educação', icon: '📚', color: '#10b981' },
  { value: 'fitness', label: 'Fitness', icon: '💪', color: '#f59e0b' },
  { value: 'news', label: 'Notícias', icon: '📰', color: '#06b6d4' },
  { value: 'music', label: 'Música', icon: '🎵', color: '#ec4899' },
  { value: 'cloud', label: 'Cloud', icon: '☁️', color: '#6366f1' },
  { value: 'other', label: 'Outros', icon: '📦', color: '#64748b' },
];

const BILLING_CYCLES: { value: BillingCycle; label: string; multiplier: number }[] = [
  { value: 'monthly', label: 'Mensal', multiplier: 1 },
  { value: 'quarterly', label: 'Trimestral', multiplier: 3 },
  { value: 'semiannual', label: 'Semestral', multiplier: 6 },
  { value: 'annual', label: 'Anual', multiplier: 12 },
];

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; color: string }> = {
  active: { label: 'Ativa', color: '#10b981' },
  cancelled: { label: 'Cancelada', color: '#ef4444' },
  paused: { label: 'Pausada', color: '#f59e0b' },
  expired: { label: 'Expirada', color: '#64748b' },
};

const DEFAULT_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'sub_1',
    name: 'Netflix',
    description: 'Plano Premium - 4 telas simultâneas',
    category: 'streaming',
    price: 55.90,
    billingCycle: 'monthly',
    nextBillingDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'active',
    website: 'https://netflix.com',
    logo: '🎬',
    createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    autoRenew: true,
  },
  {
    id: 'sub_2',
    name: 'Spotify',
    description: 'Plano Família',
    category: 'music',
    price: 34.90,
    billingCycle: 'monthly',
    nextBillingDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'active',
    website: 'https://spotify.com',
    logo: '🎵',
    createdAt: Date.now() - 180 * 24 * 60 * 60 * 1000,
    startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    autoRenew: true,
  },
  {
    id: 'sub_3',
    name: 'GitHub Pro',
    description: 'Plano Profissional',
    category: 'software',
    price: 4.00,
    billingCycle: 'monthly',
    nextBillingDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'active',
    website: 'https://github.com',
    logo: '💻',
    createdAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    autoRenew: true,
  },
];

// ============================================================================
// STORAGE SERVICE
// ============================================================================

class StorageService {
  private static readonly STORAGE_KEYS = Object.freeze({
    DARK_MODE: 'subscriptions_darkMode',
    SUBSCRIPTIONS_DATA: 'subscriptions_data',
  });

  static saveToStorage(key: string, value: any): void {
    if (!isClient) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving ${key} to storage:`, error);
    }
  }

  static loadFromStorage<T>(key: string, defaultValue: T): T {
    if (!isClient) return defaultValue;
    try {
      const saved = sessionStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key} from storage:`, error);
      return defaultValue;
    }
  }

  static clearStorage(): void {
    if (!isClient) return;
    try {
      sessionStorage.removeItem(this.STORAGE_KEYS.DARK_MODE);
      sessionStorage.removeItem(this.STORAGE_KEYS.SUBSCRIPTIONS_DATA);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  static getKeys() {
    return this.STORAGE_KEYS;
  }
}

// ============================================================================
// MODEL LAYER
// ============================================================================

class SubscriptionsModel {
  private subscriptions: Subscription[];

  constructor(initialData?: SubscriptionsData) {
    this.subscriptions = initialData?.subscriptions || [...DEFAULT_SUBSCRIPTIONS];
  }

  getAllSubscriptions(): Subscription[] {
    return [...this.subscriptions];
  }

  getActiveSubscriptions(): Subscription[] {
    return this.subscriptions.filter(s => s.status === 'active');
  }

  getSubscriptionById(id: string): Subscription | null {
    return this.subscriptions.find(s => s.id === id) || null;
  }

  addSubscription(subscription: Omit<Subscription, 'id' | 'createdAt'>): Subscription {
    const newSubscription: Subscription = {
      ...subscription,
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
    };
    this.subscriptions.push(newSubscription);
    return newSubscription;
  }

  updateSubscription(id: string, updates: Partial<Subscription>): Subscription | null {
    const index = this.subscriptions.findIndex(s => s.id === id);
    if (index === -1) return null;
    this.subscriptions[index] = { ...this.subscriptions[index], ...updates };
    return this.subscriptions[index];
  }

  deleteSubscription(id: string): boolean {
    const initialLength = this.subscriptions.length;
    this.subscriptions = this.subscriptions.filter(s => s.id !== id);
    return this.subscriptions.length < initialLength;
  }

  searchSubscriptions(term: string): Subscription[] {
    const lowerTerm = term.toLowerCase();
    return this.subscriptions.filter(s =>
      s.name.toLowerCase().includes(lowerTerm) ||
      s.description.toLowerCase().includes(lowerTerm)
    );
  }

  filterByCategory(category: Category): Subscription[] {
    return this.subscriptions.filter(s => s.category === category);
  }

  filterByStatus(status: SubscriptionStatus): Subscription[] {
    return this.subscriptions.filter(s => s.status === status);
  }

  calculateMonthlyCost(subscription: Subscription): number {
    const cycle = BILLING_CYCLES.find(c => c.value === subscription.billingCycle);
    if (!cycle) return 0;
    return subscription.price / cycle.multiplier;
  }

  getTotalMonthlySpending(): number {
    return this.getActiveSubscriptions().reduce((total, sub) => {
      return total + this.calculateMonthlyCost(sub);
    }, 0);
  }

  getTotalAnnualSpending(): number {
    return this.getTotalMonthlySpending() * 12;
  }

  getSpendingByCategory(): Record<string, number> {
    const spending: Record<string, number> = {};
    this.getActiveSubscriptions().forEach(sub => {
      const monthlyCost = this.calculateMonthlyCost(sub);
      spending[sub.category] = (spending[sub.category] || 0) + monthlyCost;
    });
    return spending;
  }

  getSpendingByBillingCycle(): Record<string, number> {
    const spending: Record<string, number> = {};
    this.getActiveSubscriptions().forEach(sub => {
      const monthlyCost = this.calculateMonthlyCost(sub);
      spending[sub.billingCycle] = (spending[sub.billingCycle] || 0) + monthlyCost;
    });
    return spending;
  }

  getRenewalAlerts(daysThreshold: number = 7): Alert[] {
    const now = new Date();
    const alerts: Alert[] = [];

    this.getActiveSubscriptions().forEach(sub => {
      const nextBilling = new Date(sub.nextBillingDate);
      const daysUntil = Math.ceil((nextBilling.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil <= daysThreshold && daysUntil >= 0) {
        alerts.push({
          id: `alert_${sub.id}`,
          subscriptionId: sub.id,
          subscriptionName: sub.name,
          daysUntilRenewal: daysUntil,
          amount: sub.price,
          nextBillingDate: sub.nextBillingDate,
        });
      }
    });

    return alerts.sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);
  }

  getOverdueSubscriptions(): Subscription[] {
    const now = new Date();
    return this.getActiveSubscriptions().filter(sub => {
      const nextBilling = new Date(sub.nextBillingDate);
      return nextBilling < now;
    });
  }

  getStatistics(): {
    total: number;
    active: number;
    cancelled: number;
    monthlyTotal: number;
    annualTotal: number;
    averageCost: number;
    mostExpensive: Subscription | null;
  } {
    const active = this.getActiveSubscriptions();
    const total = this.subscriptions.length;
    const activeCount = active.length;
    const cancelled = this.subscriptions.filter(s => s.status === 'cancelled').length;
    const monthlyTotal = this.getTotalMonthlySpending();
    const annualTotal = this.getTotalAnnualSpending();
    const averageCost = activeCount > 0 ? monthlyTotal / activeCount : 0;

    const mostExpensive = active.length > 0
      ? active.reduce((max, sub) => {
        const maxCost = this.calculateMonthlyCost(max);
        const subCost = this.calculateMonthlyCost(sub);
        return subCost > maxCost ? sub : max;
      })
      : null;

    return {
      total,
      active: activeCount,
      cancelled,
      monthlyTotal,
      annualTotal,
      averageCost,
      mostExpensive,
    };
  }

  comparePlans(subscriptionIds: string[]): Array<{
    subscription: Subscription;
    monthlyCost: number;
    annualCost: number;
  }> {
    return subscriptionIds
      .map(id => this.getSubscriptionById(id))
      .filter((sub): sub is Subscription => sub !== null)
      .map(sub => ({
        subscription: sub,
        monthlyCost: this.calculateMonthlyCost(sub),
        annualCost: this.calculateMonthlyCost(sub) * 12,
      }))
      .sort((a, b) => a.monthlyCost - b.monthlyCost);
  }

  syncToStorage(): void {
    StorageService.saveToStorage(StorageService.getKeys().SUBSCRIPTIONS_DATA, {
      subscriptions: this.subscriptions,
    });
  }

  static loadFromStorage(): SubscriptionsModel {
    const data = StorageService.loadFromStorage<SubscriptionsData | null>(
      StorageService.getKeys().SUBSCRIPTIONS_DATA,
      null
    );
    return new SubscriptionsModel(data || undefined);
  }
}

// ============================================================================
// CONTROLLER LAYER
// ============================================================================

class SubscriptionsController {
  private model: SubscriptionsModel;
  private listeners: Set<() => void>;

  constructor(model: SubscriptionsModel) {
    this.model = model;
    this.listeners = new Set();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.model.syncToStorage();
    this.listeners.forEach(listener => listener());
  }

  getAllSubscriptions = () => this.model.getAllSubscriptions();
  getActiveSubscriptions = () => this.model.getActiveSubscriptions();
  getSubscriptionById = (id: string) => this.model.getSubscriptionById(id);
  searchSubscriptions = (term: string) => this.model.searchSubscriptions(term);
  filterByCategory = (category: Category) => this.model.filterByCategory(category);
  filterByStatus = (status: SubscriptionStatus) => this.model.filterByStatus(status);

  addSubscription(subscription: Omit<Subscription, 'id' | 'createdAt'>): void {
    this.model.addSubscription(subscription);
    this.notify();
  }

  updateSubscription(id: string, updates: Partial<Subscription>): void {
    this.model.updateSubscription(id, updates);
    this.notify();
  }

  deleteSubscription(id: string): void {
    this.model.deleteSubscription(id);
    this.notify();
  }

  calculateMonthlyCost = (subscription: Subscription) => this.model.calculateMonthlyCost(subscription);
  getTotalMonthlySpending = () => this.model.getTotalMonthlySpending();
  getTotalAnnualSpending = () => this.model.getTotalAnnualSpending();
  getSpendingByCategory = () => this.model.getSpendingByCategory();
  getSpendingByBillingCycle = () => this.model.getSpendingByBillingCycle();
  getRenewalAlerts = (daysThreshold?: number) => this.model.getRenewalAlerts(daysThreshold);
  getOverdueSubscriptions = () => this.model.getOverdueSubscriptions();
  getStatistics = () => this.model.getStatistics();
  comparePlans = (subscriptionIds: string[]) => this.model.comparePlans(subscriptionIds);
}

// ============================================================================
// CONTEXT
// ============================================================================

interface SubscriptionsContextType {
  controller: SubscriptionsController;
  forceUpdate: () => void;
}

const SubscriptionsContext = createContext<SubscriptionsContextType | null>(null);

const useSubscriptions = () => {
  const context = useContext(SubscriptionsContext);
  if (!context) throw new Error('useSubscriptions must be used within SubscriptionsProvider');
  return context;
};

// ============================================================================
// DEFAULT FORM DATA
// ============================================================================

const getDefaultFormData = () => ({
  name: '',
  description: '',
  category: 'other' as Category,
  price: '',
  billingCycle: 'monthly' as BillingCycle,
  nextBillingDate: '',
  status: 'active' as SubscriptionStatus,
  website: '',
  logo: '',
  startDate: new Date().toISOString().split('T')[0],
  autoRenew: true,
});

// ============================================================================
// VIEW COMPONENTS
// ============================================================================

const Header: React.FC<{
  darkMode: boolean;
  toggleTheme: () => void;
  onNavigate: (view: string) => void;
  currentView: string;
}> = ({ darkMode, toggleTheme, onNavigate, currentView }) => {
  const { controller } = useSubscriptions();
  const alerts = controller.getRenewalAlerts(7);

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-brand" onClick={() => onNavigate('dashboard')}>
          <svg className="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <h1>Subscription Manager</h1>
        </div>

        <nav className="header-nav">
          <button
            onClick={() => onNavigate('dashboard')}
            className={currentView === 'dashboard' ? 'active' : ''}
          >
            Dashboard
          </button>
          <button
            onClick={() => onNavigate('subscriptions')}
            className={currentView === 'subscriptions' ? 'active' : ''}
          >
            Assinaturas
          </button>
          <button
            onClick={() => onNavigate('analytics')}
            className={currentView === 'analytics' ? 'active' : ''}
          >
            Análises
          </button>
        </nav>

        <div className="header-actions">
          {alerts.length > 0 && (
            <button onClick={() => onNavigate('alerts')} className="alert-button">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="badge">{alerts.length}</span>
            </button>
          )}
          <button onClick={toggleTheme} className="theme-toggle">
            {darkMode ? (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

const SubscriptionCard: React.FC<{ subscription: Subscription; onClick: () => void }> = ({
  subscription,
  onClick,
}) => {
  const { controller } = useSubscriptions();
  const monthlyCost = controller.calculateMonthlyCost(subscription);
  const category = CATEGORIES.find(c => c.value === subscription.category);
  const status = STATUS_CONFIG[subscription.status];
  const billingCycle = BILLING_CYCLES.find(c => c.value === subscription.billingCycle);

  const daysUntilRenewal = Math.ceil(
    (new Date(subscription.nextBillingDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div className="subscription-card" onClick={onClick}>
      <div className="card-header">
        <div className="card-logo">{subscription.logo || category?.icon}</div>
        <div className="card-status" style={{ backgroundColor: status.color }}>
          {status.label}
        </div>
      </div>

      <h3 className="card-title">{subscription.name}</h3>
      <p className="card-description">{subscription.description}</p>

      <div className="card-pricing">
        <div className="price-main">
          <span className="price-value">R$ {subscription.price.toFixed(2)}</span>
          <span className="price-cycle">/ {billingCycle?.label}</span>
        </div>
        <div className="price-monthly">R$ {monthlyCost.toFixed(2)}/mês</div>
      </div>

      <div className="card-footer">
        <div className="card-category" style={{ color: category?.color }}>
          {category?.icon} {category?.label}
        </div>
        <div className={`card-renewal ${daysUntilRenewal < 7 ? 'urgent' : ''}`}>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {daysUntilRenewal > 0 ? `${daysUntilRenewal} dias` : 'Vencida'}
        </div>
      </div>
    </div>
  );
};

const DashboardView: React.FC<{ onSubscriptionClick: (id: string) => void }> = ({
  onSubscriptionClick,
}) => {
  const { controller } = useSubscriptions();
  const stats = controller.getStatistics();
  const alerts = controller.getRenewalAlerts(7);
  const recentSubscriptions = controller.getActiveSubscriptions().slice(0, 6);

  return (
    <div className="dashboard-view">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <p className="dashboard-subtitle">Visão geral das suas assinaturas</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats.active}</div>
            <div className="stat-label">Assinaturas Ativas</div>
          </div>
        </div>

        <div className="stat-card monthly">
          <div className="stat-icon">💳</div>
          <div className="stat-content">
            <div className="stat-value">R$ {stats.monthlyTotal.toFixed(2)}</div>
            <div className="stat-label">Gasto Mensal</div>
          </div>
        </div>

        <div className="stat-card annual">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <div className="stat-value">R$ {stats.annualTotal.toFixed(2)}</div>
            <div className="stat-label">Gasto Anual</div>
          </div>
        </div>

        <div className="stat-card average">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <div className="stat-value">R$ {stats.averageCost.toFixed(2)}</div>
            <div className="stat-label">Custo Médio</div>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="alerts-section">
          <h3>Renovações Próximas</h3>
          <div className="alerts-list">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className="alert-item"
                onClick={() => onSubscriptionClick(alert.subscriptionId)}
              >
                <div className="alert-icon">
                  {alert.daysUntilRenewal === 0 && '🔴'}
                  {alert.daysUntilRenewal > 0 && alert.daysUntilRenewal <= 3 && '🟡'}
                  {alert.daysUntilRenewal > 3 && '🟢'}
                </div>
                <div className="alert-content">
                  <h4>{alert.subscriptionName}</h4>
                  <p>
                    {alert.daysUntilRenewal === 0
                      ? 'Renovação hoje'
                      : alert.daysUntilRenewal === 1
                        ? 'Renovação amanhã'
                        : `Renovação em ${alert.daysUntilRenewal} dias`}
                  </p>
                </div>
                <div className="alert-amount">R$ {alert.amount.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="recent-subscriptions">
        <h3>Assinaturas Recentes</h3>
        <div className="subscriptions-grid">
          {recentSubscriptions.map(sub => (
            <SubscriptionCard
              key={sub.id}
              subscription={sub}
              onClick={() => onSubscriptionClick(sub.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const SubscriptionsListView: React.FC<{
  onSubscriptionClick: (id: string) => void;
  onAddSubscription: () => void;
}> = ({ onSubscriptionClick, onAddSubscription }) => {
  const { controller, forceUpdate } = useSubscriptions();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<SubscriptionStatus | null>(null);

  const [renderKey, setRenderKey] = useState(0);

  useEffect(() => {
    setRenderKey(prev => prev + 1);
  }, [controller]);

  const allSubscriptions = controller.getAllSubscriptions();

  const filteredSubscriptions = useMemo(() => {
    let subs = [...allSubscriptions];

    if (searchTerm) {
      const searchResults = controller.searchSubscriptions(searchTerm);
      subs = subs.filter(s => searchResults.some(sr => sr.id === s.id));
    }

    if (selectedCategory) {
      subs = subs.filter(s => s.category === selectedCategory);
    }

    if (selectedStatus) {
      subs = subs.filter(s => s.status === selectedStatus);
    }

    return subs.sort((a, b) => b.createdAt - a.createdAt);
  }, [allSubscriptions, searchTerm, selectedCategory, selectedStatus, renderKey]);

  return (
    <div className="subscriptions-list-view">
      <div className="list-header">
        <h2>Minhas Assinaturas</h2>
        <button onClick={onAddSubscription} className="btn-primary">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Assinatura
        </button>
      </div>

      <div className="filters-section">
        <div className="search-box">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar assinaturas..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-buttons">
          <div className="filter-group">
            <span className="filter-label">Categoria:</span>
            <button
              onClick={() => setSelectedCategory(null)}
              className={`filter-btn ${!selectedCategory ? 'active' : ''}`}
            >
              Todas
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`filter-btn ${selectedCategory === cat.value ? 'active' : ''}`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>

          <div className="filter-group">
            <span className="filter-label">Status:</span>
            <button
              onClick={() => setSelectedStatus(null)}
              className={`filter-btn ${!selectedStatus ? 'active' : ''}`}
            >
              Todos
            </button>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setSelectedStatus(key as SubscriptionStatus)}
                className={`filter-btn ${selectedStatus === key ? 'active' : ''}`}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="subscriptions-count">
        {filteredSubscriptions.length}{' '}
        {filteredSubscriptions.length === 1 ? 'assinatura encontrada' : 'assinaturas encontradas'}
      </div>

      {filteredSubscriptions.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma assinatura encontrada</p>
          <button onClick={onAddSubscription} className="btn-primary">
            Adicionar Primeira Assinatura
          </button>
        </div>
      ) : (
        <div className="subscriptions-grid">
          {filteredSubscriptions.map(sub => (
            <SubscriptionCard
              key={sub.id}
              subscription={sub}
              onClick={() => onSubscriptionClick(sub.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const AnalyticsView: React.FC = () => {
  const { controller } = useSubscriptions();
  const spendingByCategory = controller.getSpendingByCategory();
  const spendingByBillingCycle = controller.getSpendingByBillingCycle();
  const stats = controller.getStatistics();

  const categoryData = Object.entries(spendingByCategory).map(([category, amount]) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return { category, amount, label: cat?.label || category, color: cat?.color || '#64748b' };
  });

  const total = categoryData.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="analytics-view">
      <div className="analytics-header">
        <h2>Análises Financeiras</h2>
        <p className="analytics-subtitle">Detalhamento dos seus gastos com assinaturas</p>
      </div>

      <div className="comparison-cards">
        <div className="comparison-card">
          <h3>Gasto Mensal</h3>
          <div className="comparison-value">R$ {stats.monthlyTotal.toFixed(2)}</div>
          <div className="comparison-detail">{stats.active} assinaturas ativas</div>
        </div>

        <div className="comparison-card">
          <h3>Gasto Anual</h3>
          <div className="comparison-value">R$ {stats.annualTotal.toFixed(2)}</div>
          <div className="comparison-detail">Projeção baseada no mês atual</div>
        </div>

        <div className="comparison-card">
          <h3>Mais Cara</h3>
          <div className="comparison-value">
            {stats.mostExpensive
              ? `R$ ${controller.calculateMonthlyCost(stats.mostExpensive).toFixed(2)}/mês`
              : 'N/A'}
          </div>
          <div className="comparison-detail">{stats.mostExpensive?.name || '-'}</div>
        </div>
      </div>

      <div className="spending-section">
        <h3>Gastos por Categoria</h3>
        <div className="spending-chart">
          {categoryData.map(item => {
            const percentage = total > 0 ? (item.amount / total) * 100 : 0;
            return (
              <div key={item.category} className="chart-item">
                <div className="chart-label">
                  <span className="chart-category">{item.label}</span>
                  <span className="chart-amount">R$ {item.amount.toFixed(2)}/mês</span>
                </div>
                <div className="chart-bar">
                  <div
                    className="chart-fill"
                    style={{ width: `${percentage}%`, backgroundColor: item.color }}
                  />
                </div>
                <div className="chart-percentage">{percentage.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="billing-cycle-section">
        <h3>Gastos por Ciclo de Cobrança</h3>
        <div className="billing-cycle-grid">
          {Object.entries(spendingByBillingCycle).map(([cycle, amount]) => {
            const cycleConfig = BILLING_CYCLES.find(c => c.value === cycle);
            return (
              <div key={cycle} className="billing-card">
                <div className="billing-label">{cycleConfig?.label}</div>
                <div className="billing-amount">R$ {amount.toFixed(2)}/mês</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SubscriptionFormModal: React.FC<{
  isOpen: boolean;
  subscriptionId: string | null;
  onClose: () => void;
}> = ({ isOpen, subscriptionId, onClose }) => {
  const { controller } = useSubscriptions();
  const existingSubscription = subscriptionId ? controller.getSubscriptionById(subscriptionId) : null;

  const [formData, setFormData] = useState<any>(getDefaultFormData());

  useEffect(() => {
    if (isOpen) {
      if (existingSubscription) {
        setFormData(existingSubscription);
      } else {
        setFormData(getDefaultFormData());
      }
    }
  }, [isOpen, subscriptionId, existingSubscription]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      price: parseFloat(formData.price),
    };

    if (subscriptionId) {
      controller.updateSubscription(subscriptionId, data);
    } else {
      controller.addSubscription(data);
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal subscription-form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{subscriptionId ? 'Editar Assinatura' : 'Nova Assinatura'}</h2>
          <button onClick={onClose} className="modal-close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="subscription-form">
          <div className="form-group">
            <label>Nome *</label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Descrição</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Categoria</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
              >
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Preço *</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Ciclo de Cobrança</label>
              <select
                value={formData.billingCycle}
                onChange={e => setFormData({ ...formData, billingCycle: e.target.value })}
              >
                {BILLING_CYCLES.map(cycle => (
                  <option key={cycle.value} value={cycle.value}>
                    {cycle.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Data de Início</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Próxima Cobrança *</label>
              <input
                type="date"
                value={formData.nextBillingDate}
                onChange={e => setFormData({ ...formData, nextBillingDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Website</label>
            <input
              type="url"
              value={formData.website}
              onChange={e => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://exemplo.com"
            />
          </div>

          <div className="form-group">
            <label>Ícone/Emoji</label>
            <input
              type="text"
              value={formData.logo}
              onChange={e => setFormData({ ...formData, logo: e.target.value })}
              placeholder="🎬"
            />
          </div>

          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                checked={formData.autoRenew}
                onChange={e => setFormData({ ...formData, autoRenew: e.target.checked })}
              />
              Renovação Automática
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              {subscriptionId ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SubscriptionDetailView: React.FC<{
  subscriptionId: string;
  onBack: () => void;
  onEdit: () => void;
}> = ({ subscriptionId, onBack, onEdit }) => {
  const { controller } = useSubscriptions();
  const subscription = controller.getSubscriptionById(subscriptionId);

  if (!subscription) {
    return (
      <div className="subscription-detail-view">
        <div className="empty-state">
          <p>Assinatura não encontrada</p>
          <button onClick={onBack} className="btn-primary">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const monthlyCost = controller.calculateMonthlyCost(subscription);
  const annualCost = monthlyCost * 12;
  const category = CATEGORIES.find(c => c.value === subscription.category);
  const billingCycle = BILLING_CYCLES.find(c => c.value === subscription.billingCycle);
  const status = STATUS_CONFIG[subscription.status];

  const handleDelete = () => {
    if (confirm('Deseja realmente excluir esta assinatura?')) {
      controller.deleteSubscription(subscriptionId);
      onBack();
    }
  };

  return (
    <div className="subscription-detail-view">
      <div className="detail-header">
        <button onClick={onBack} className="btn-back">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Voltar
        </button>
        <div className="detail-actions">
          <button onClick={onEdit} className="btn-secondary">
            Editar
          </button>
          <button onClick={handleDelete} className="btn-danger">
            Excluir
          </button>
        </div>
      </div>

      <div className="detail-content">
        <div className="detail-hero">
          <div className="detail-logo">{subscription.logo || category?.icon}</div>
          <div className="detail-info">
            <h1>{subscription.name}</h1>
            <p>{subscription.description}</p>
            <div className="detail-badges">
              <span className="badge-category" style={{ backgroundColor: category?.color }}>
                {category?.icon} {category?.label}
              </span>
              <span className="badge-status" style={{ backgroundColor: status.color }}>
                {status.label}
              </span>
            </div>
          </div>
        </div>

        <div className="detail-pricing">
          <div className="pricing-card">
            <h3>Valor da Assinatura</h3>
            <div className="pricing-value">R$ {subscription.price.toFixed(2)}</div>
            <div className="pricing-cycle">{billingCycle?.label}</div>
          </div>

          <div className="pricing-card">
            <h3>Custo Mensal</h3>
            <div className="pricing-value">R$ {monthlyCost.toFixed(2)}</div>
            <div className="pricing-cycle">por mês</div>
          </div>

          <div className="pricing-card">
            <h3>Custo Anual</h3>
            <div className="pricing-value">R$ {annualCost.toFixed(2)}</div>
            <div className="pricing-cycle">por ano</div>
          </div>
        </div>

        <div className="detail-info-grid">
          <div className="info-item">
            <span className="info-label">Próxima Cobrança</span>
            <span className="info-value">
              {new Date(subscription.nextBillingDate).toLocaleDateString('pt-BR')}
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">Data de Início</span>
            <span className="info-value">
              {new Date(subscription.startDate).toLocaleDateString('pt-BR')}
            </span>
          </div>

          <div className="info-item">
            <span className="info-label">Renovação Automática</span>
            <span className="info-value">{subscription.autoRenew ? 'Sim' : 'Não'}</span>
          </div>

          {subscription.website && (
            <div className="info-item">
              <span className="info-label">Website</span>
              <a href={subscription.website} target="_blank" rel="noopener noreferrer" className="info-link">
                Visitar site
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

const App: React.FC = () => {
  const [darkMode, setDarkMode] = useState(() => {
    return StorageService.loadFromStorage(StorageService.getKeys().DARK_MODE, false);
  });

  const [controller] = useState(() => {
    const model = SubscriptionsModel.loadFromStorage();
    return new SubscriptionsController(model);
  });

  const [, setUpdateCount] = useState(0);
  const forceUpdate = () => setUpdateCount(prev => prev + 1);

  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = controller.subscribe(() => {
      forceUpdate();
    });
    return unsubscribe;
  }, [controller]);

  useEffect(() => {
    if (isClient) {
      document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
      StorageService.saveToStorage(StorageService.getKeys().DARK_MODE, darkMode);
    }
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(!darkMode);

  const handleSubscriptionClick = (id: string) => {
    setSelectedSubscriptionId(id);
    setCurrentView('detail');
  };

  const handleAddSubscription = () => {
    setEditingSubscriptionId(null);
    setShowSubscriptionForm(true);
  };

  const handleEditSubscription = () => {
    setEditingSubscriptionId(selectedSubscriptionId);
    setShowSubscriptionForm(true);
  };

  const handleBackFromDetail = () => {
    setSelectedSubscriptionId(null);
    setCurrentView('subscriptions');
  };

  const handleCloseForm = () => {
    setShowSubscriptionForm(false);
    setEditingSubscriptionId(null);
  };

  return (
    <SubscriptionsContext.Provider value={{ controller, forceUpdate }}>
      <div className="app">
        <Header
          darkMode={darkMode}
          toggleTheme={toggleTheme}
          onNavigate={setCurrentView}
          currentView={currentView}
        />

        <main className="main-content">
          {currentView === 'dashboard' && (
            <DashboardView onSubscriptionClick={handleSubscriptionClick} />
          )}

          {currentView === 'subscriptions' && (
            <SubscriptionsListView
              onSubscriptionClick={handleSubscriptionClick}
              onAddSubscription={handleAddSubscription}
            />
          )}

          {currentView === 'analytics' && <AnalyticsView />}

          {currentView === 'detail' && selectedSubscriptionId && (
            <SubscriptionDetailView
              subscriptionId={selectedSubscriptionId}
              onBack={handleBackFromDetail}
              onEdit={handleEditSubscription}
            />
          )}

          {currentView === 'alerts' && (
            <DashboardView onSubscriptionClick={handleSubscriptionClick} />
          )}
        </main>

        <SubscriptionFormModal
          isOpen={showSubscriptionForm}
          subscriptionId={editingSubscriptionId}
          onClose={handleCloseForm}
        />
      </div>
    </SubscriptionsContext.Provider>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const APP_STYLES = `
:root {
  --primary: #3b82f6;
  --primary-dark: #2563eb;
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --info: #06b6d4;
  
  --bg: #f8fafc;
  --surface: #ffffff;
  --card-bg: #ffffff;
  --text: #0f172a;
  --text-secondary: #64748b;
  --border: #e2e8f0;
  --shadow: rgba(0, 0, 0, 0.1);
  --shadow-lg: rgba(0, 0, 0, 0.15);
  
  --header-bg: #ffffff;
  --header-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

[data-theme="dark"] {
  --bg: #0f172a;
  --surface: #1e293b;
  --card-bg: #1e293b;
  --text: #f1f5f9;
  --text-secondary: #94a3b8;
  --border: #334155;
  --shadow: rgba(0, 0, 0, 0.3);
  --shadow-lg: rgba(0, 0, 0, 0.5);
  
  --header-bg: #1e293b;
  --header-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background: var(--bg);
  color: var(--text);
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.header {
  background: var(--header-bg);
  box-shadow: var(--header-shadow);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}

.header-icon {
  width: 32px;
  height: 32px;
  color: var(--primary);
}

.header h1 {
  font-size: 1.5rem;
  font-weight: 700;
}

.header-nav {
  display: flex;
  gap: 0.5rem;
}

.header-nav button {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-nav button:hover {
  background: var(--surface);
}

.header-nav button.active {
  background: var(--primary);
  color: white;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.alert-button {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--surface);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px var(--shadow);
}

.alert-button:hover {
  transform: scale(1.05);
  background: var(--warning);
  color: white;
}

.alert-button svg {
  width: 20px;
  height: 20px;
}

.theme-toggle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: var(--surface);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px var(--shadow);
}

.theme-toggle:hover {
  transform: scale(1.05);
  background: var(--primary);
  color: white;
}

.theme-toggle svg {
  width: 20px;
  height: 20px;
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--danger);
  color: white;
  border-radius: 10px;
  padding: 0.125rem 0.375rem;
  font-size: 0.75rem;
  font-weight: 700;
  min-width: 20px;
  text-align: center;
}

/* Main Content */
.main-content {
  flex: 1;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem;
}

/* Dashboard */
.dashboard-header {
  margin-bottom: 2rem;
}

.dashboard-header h2 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.dashboard-subtitle {
  color: var(--text-secondary);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-lg);
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.stat-card.monthly .stat-value {
  color: var(--success);
}

.stat-card.annual .stat-value {
  color: var(--warning);
}

/* Alerts */
.alerts-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.alerts-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.alert-item:hover {
  transform: translateX(4px);
  box-shadow: 0 2px 8px var(--shadow);
}

.alert-icon {
  font-size: 1.5rem;
}

.alert-content {
  flex: 1;
}

.alert-content h4 {
  font-size: 0.9375rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.alert-content p {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.alert-amount {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--danger);
}

/* Subscriptions Grid */
.recent-subscriptions h3,
.list-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
}

.subscriptions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

/* Subscription Card */
.subscription-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.subscription-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px var(--shadow-lg);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.card-logo {
  font-size: 2.5rem;
}

.card-status {
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}

.card-title {
  font-size: 1.125rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.card-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1rem;
  line-height: 1.5;
}

.card-pricing {
  margin-bottom: 1rem;
  padding: 1rem;
  background: var(--surface);
  border-radius: 8px;
}

.price-main {
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  margin-bottom: 0.375rem;
}

.price-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primary);
}

.price-cycle {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.price-monthly {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.card-category {
  font-size: 0.875rem;
  font-weight: 500;
}

.card-renewal {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.card-renewal svg {
  width: 16px;
  height: 16px;
}

.card-renewal.urgent {
  color: var(--danger);
  font-weight: 600;
}

/* Filters */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.filters-section {
  margin-bottom: 1.5rem;
}

.search-box {
  position: relative;
  margin-bottom: 1rem;
}

.search-box svg {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
}

.search-box input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 3rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
}

.filter-buttons {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.filter-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-btn:hover {
  background: var(--border);
}

.filter-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.subscriptions-count {
  margin-bottom: 1rem;
  color: var(--text-secondary);
}

/* Analytics */
.analytics-header {
  margin-bottom: 2rem;
}

.analytics-header h2 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.analytics-subtitle {
  color: var(--text-secondary);
}

.comparison-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.comparison-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
}

.comparison-card h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.comparison-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 0.5rem;
}

.comparison-detail {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.spending-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.spending-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.spending-chart {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.chart-item {
  display: grid;
  grid-template-columns: 150px 1fr 60px;
  align-items: center;
  gap: 1rem;
}

.chart-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.chart-category {
  font-size: 0.875rem;
  font-weight: 500;
}

.chart-amount {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.chart-bar {
  height: 32px;
  background: var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.chart-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.3s ease;
}

.chart-percentage {
  text-align: right;
  font-size: 0.875rem;
  font-weight: 600;
}

.billing-cycle-section {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
}

.billing-cycle-section h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.billing-cycle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
}

.billing-card {
  padding: 1rem;
  background: var(--surface);
  border-radius: 8px;
  text-align: center;
}

.billing-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.billing-amount {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--primary);
}

/* Detail View */
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  cursor: pointer;
}

.btn-back svg {
  width: 20px;
  height: 20px;
}

.detail-actions {
  display: flex;
  gap: 0.75rem;
}

.detail-hero {
  display: flex;
  align-items: start;
  gap: 2rem;
  margin-bottom: 2rem;
  padding: 2rem;
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.detail-logo {
  font-size: 4rem;
}

.detail-info {
  flex: 1;
}

.detail-info h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.detail-info p {
  color: var(--text-secondary);
  margin-bottom: 1rem;
  line-height: 1.6;
}

.detail-badges {
  display: flex;
  gap: 0.75rem;
}

.badge-category,
.badge-status {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
}

.detail-pricing {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.pricing-card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  text-align: center;
}

.pricing-card h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.pricing-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 0.5rem;
}

.pricing-cycle {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.detail-info-grid {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.info-value {
  font-size: 1rem;
  font-weight: 500;
}

.info-link {
  color: var(--primary);
  text-decoration: none;
  font-weight: 500;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal {
  background: var(--surface);
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1.5rem;
}

.subscription-form {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--text);
  font-family: inherit;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-group.checkbox {
  display: flex;
  align-items: center;
}

.form-group.checkbox label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

.form-group.checkbox input {
  width: auto;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

/* Buttons */
.btn-primary,
.btn-secondary,
.btn-danger {
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-primary svg,
.btn-secondary svg {
  width: 18px;
  height: 18px;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    padding: 1rem;
    flex-wrap: wrap;
  }

  .header-nav {
    order: 3;
    width: 100%;
    justify-content: center;
  }

  .main-content {
    padding: 1rem;
  }

  .subscriptions-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .chart-item {
    grid-template-columns: 1fr;
  }
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.subscription-card {
  animation: fadeIn 0.3s ease-out;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: var(--bg);
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 5px;
}
`;

// ============================================================================
// SSR SETUP & EXPORT
// ============================================================================

if (isClient) {
  const styleId = 'app-styles';
  let styleElement = document.getElementById(styleId);
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = APP_STYLES;
    document.head.appendChild(styleElement);
  }
}

export default App;
