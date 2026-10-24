import { useState, type ReactNode } from 'react';
import { Home as HomeIcon, History as HistoryIcon, Users as UsersIcon, WalletCards } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LangProvider } from '@/context/LangContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { AddWorkerScreen } from '@/screens/AddWorkerScreen';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { WorkersScreen } from '@/screens/WorkersScreen';
import { PayrollScreen } from '@/screens/PayrollScreen';
import { KhataScreen } from '@/screens/KhataScreen';
import { AlertsScreen } from '@/screens/AlertsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { RegistrationScreen } from '@/screens/RegistrationScreen';
import { GatePassScreen } from '@/screens/GatePassScreen';
import { TeamConnectionsScreen } from '@/screens/TeamConnectionsScreen';
import { LoadingView } from '@/components/LoadingView';
import { SplashScreen } from '@/components/SplashScreen';
import { useLang } from '@/context/LangContext';
import type { UserRole } from '@/types/database';

type TabKey = 'home' | 'history' | 'workers' | 'payroll';
type StackScreen =
  | 'tabs'
  | 'addWorker'
  | 'workerDetail'
  | 'alerts'
  | 'settings'
  | 'registration'
  | 'gatePassThekedar'
  | 'gatePassScanner'
  | 'teamConnections';
type QuickAction = 'addWorker' | 'addHelper' | 'addKarigar' | 'payroll' | 'alerts' | 'settings' | 'registration' | 'gatePass' | 'gatePassScanner' | 'workerDetail' | 'viewWorkers' | 'teamConnections';

function MainApp() {
  const { session, profile, myWorker, loading, profileLoadError, reloadProfile, signOut } = useAuth();
  const { t } = useLang();
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [stackScreen, setStackScreen] = useState<StackScreen>('tabs');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [initialWorkerRole, setInitialWorkerRole] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  const returnToTabs = () => {
    setStackScreen('tabs');
    setRefreshKey((key) => key + 1);
  };

  if (showSplash) return <SplashScreen onFinish={() => setShowSplash(false)} />;

  if (loading) {
    return (
      <AppScreenViewport>
        <div className="flex min-h-full items-center justify-center bg-white px-5">
          <LoadingView message="Loading..." />
        </div>
      </AppScreenViewport>
    );
  }

  if (!session) return <LoginScreen />;

  // A failed profile lookup must never masquerade as a new account.
  if (!profile && profileLoadError) {
    return (
      <AppScreenViewport>
        <main className="flex min-h-full items-center justify-center bg-[#F7F9F7] px-5 py-8">
          <section className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-6 shadow-xl shadow-slate-900/5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
              <span className="text-2xl" aria-hidden="true">↻</span>
            </div>
            <h1 className="mt-4 text-center text-xl font-black text-slate-900">Account load nahi ho saka</h1>
            <p className="mt-2 text-center text-sm leading-6 text-slate-600">Tumhara Google login mil gaya hai, lekin saved profile load nahi hua. Naya account banane ke bajaye dobara try karo.</p>
            <p role="alert" className="mt-4 break-words rounded-xl bg-amber-50 p-3 text-xs text-amber-900">{profileLoadError}</p>
            <button type="button" onClick={() => { void reloadProfile().catch(() => undefined); }} className="mt-4 min-h-12 w-full rounded-xl bg-emerald-800 px-4 py-3 font-extrabold text-white">Dobara try karein</button>
            <button type="button" onClick={() => { void signOut(); }} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">Logout</button>
          </section>
        </main>
      </AppScreenViewport>
    );
  }

  // A confirmed missing profile starts first-time registration only.
  if (!profile) {
    return <AppScreenViewport><RegistrationScreen onBack={returnToTabs} onSaved={returnToTabs} /></AppScreenViewport>;
  }

  const role: UserRole = profile.role;

  if (stackScreen === 'addWorker') {
    return <AppScreenViewport><AddWorkerScreen key={initialWorkerRole || 'new-worker'} initialRole={initialWorkerRole} onBack={returnToTabs} onSaved={returnToTabs} /></AppScreenViewport>;
  }
  if (stackScreen === 'workerDetail' && selectedWorkerId) {
    return <AppScreenViewport><KhataScreen workerId={selectedWorkerId} onBack={returnToTabs} readOnly={profile.role === 'labour'} /></AppScreenViewport>;
  }
  if (stackScreen === 'alerts') return <AppScreenViewport><AlertsScreen isActive={true} /></AppScreenViewport>;
  if (stackScreen === 'settings') return <AppScreenViewport><SettingsScreen onBack={returnToTabs} /></AppScreenViewport>;
  if (stackScreen === 'registration') return <AppScreenViewport><RegistrationScreen onBack={returnToTabs} onSaved={returnToTabs} existingProfile /></AppScreenViewport>;
  if (stackScreen === 'gatePassThekedar') return <AppScreenViewport><GatePassScreen onBack={returnToTabs} mode="thekedar" /></AppScreenViewport>;
  if (stackScreen === 'gatePassScanner') return <AppScreenViewport><GatePassScreen onBack={returnToTabs} mode="gatekeeper" /></AppScreenViewport>;
  if (stackScreen === 'teamConnections') return <AppScreenViewport><TeamConnectionsScreen onBack={returnToTabs} /></AppScreenViewport>;

  const handleNavigate = (action: QuickAction) => {
    if (action === 'addWorker') { setInitialWorkerRole(''); setStackScreen('addWorker'); }
    else if (action === 'addHelper') { setInitialWorkerRole('Helper'); setStackScreen('addWorker'); }
    else if (action === 'addKarigar') { setInitialWorkerRole('Mason'); setStackScreen('addWorker'); }
    else if (action === 'registration') setStackScreen('registration');
    else if (action === 'settings') setStackScreen('settings');
    else if (action === 'gatePass') setStackScreen('gatePassThekedar');
    else if (action === 'gatePassScanner') setStackScreen('gatePassScanner');
    else if (action === 'teamConnections') setStackScreen('teamConnections');
    else if (action === 'payroll') { setActiveTab('payroll'); setRefreshKey((key) => key + 1); }
    else if (action === 'alerts') setStackScreen('alerts');
    else if (action === 'viewWorkers') { setActiveTab('workers'); setRefreshKey((key) => key + 1); }
    else if (action === 'workerDetail') {
      if (myWorker?.id) {
        setSelectedWorkerId(myWorker.id);
        setStackScreen('workerDetail');
      } else if (profile.role === 'labour') {
        setStackScreen('teamConnections');
      }
    }
  };

  const handleViewDetail = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setStackScreen('workerDetail');
  };
  const visibleTabs: TabKey[] = getTabsForRole(role);

  return (
    <div className="app-viewport bg-[#F5F8F6]">
      <main className="app-tab-scroll" key={`tab-${activeTab}`}>
        {activeTab === 'home' && <HomeScreen key={refreshKey} onNavigate={handleNavigate} role={role} />}
        {activeTab === 'history' && <HistoryScreen key={`history-${refreshKey}`} isActive={activeTab === 'history'} />}
        {visibleTabs.includes('workers') && activeTab === 'workers' && (
          <WorkersScreen
            key={`workers-${refreshKey}`}
            isActive={activeTab === 'workers'}
            onAddWorker={(initialRole) => { setInitialWorkerRole(initialRole ?? ''); setStackScreen('addWorker'); }}
            onViewDetail={handleViewDetail}
          />
        )}
        {visibleTabs.includes('payroll') && activeTab === 'payroll' && <PayrollScreen key={`payroll-${refreshKey}`} isActive={activeTab === 'payroll'} />}
      </main>

      <nav className="app-bottom-nav safe-bottom" aria-label="Primary navigation">
        <div className="mx-auto max-w-2xl">
          <div className="app-bottom-nav-items">
            <TabButton label={t('home')} icon={HomeIcon} active={activeTab === 'home'} onClick={() => { setActiveTab('home'); setRefreshKey((key) => key + 1); }} />
            {visibleTabs.includes('history') && <TabButton label={t('history')} icon={HistoryIcon} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />}
            {visibleTabs.includes('workers') && <TabButton label={t('workers')} icon={UsersIcon} active={activeTab === 'workers'} onClick={() => setActiveTab('workers')} />}
            {visibleTabs.includes('payroll') && <TabButton label={t('payroll')} icon={WalletCards} active={activeTab === 'payroll'} onClick={() => setActiveTab('payroll')} />}
          </div>
        </div>
      </nav>
    </div>
  );
}

function AppScreenViewport({ children }: { children: ReactNode }) {
  return <div className="app-screen-viewport">{children}</div>;
}

function getTabsForRole(role: UserRole): TabKey[] {
  switch (role) {
    case 'thekedar': return ['history', 'workers', 'payroll'];
    case 'gatekeeper': return ['history', 'workers'];
    case 'labour': return ['history'];
    default: return ['history', 'workers', 'payroll'];
  }
}

function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof HomeIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition-colors duration-200 ${active ? 'text-emerald-800' : 'text-slate-400 hover:text-slate-600'}`}
    >
      <div className={`flex h-7 w-8 items-center justify-center rounded-xl transition-colors duration-200 ${active ? 'bg-emerald-50' : ''}`}>
        <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
      </div>
      <span className={`max-w-full truncate whitespace-nowrap text-[10px] font-bold leading-tight sm:text-[11px] ${active ? 'text-emerald-900' : 'text-slate-500'}`}>{label}</span>
      {active && <span className="absolute -bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-emerald-600" />}
    </button>
  );
}

export default function App() {
  return <AuthProvider><LangProvider><MainApp /></LangProvider></AuthProvider>;
}
