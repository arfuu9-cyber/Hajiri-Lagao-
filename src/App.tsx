import { useState } from 'react';
import { Home as HomeIcon, History as HistoryIcon, Users as UsersIcon, WalletCards, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LangProvider } from '@/context/LangContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { HomeScreen } from '@/screens/HomeScreen';
import { AddWorkerScreen } from '@/screens/AddWorkerScreen';
import { NfcAttendanceScreen } from '@/screens/NfcAttendanceScreen';
import { HistoryScreen } from '@/screens/HistoryScreen';
import { WorkersScreen } from '@/screens/WorkersScreen';
import { PayrollScreen } from '@/screens/PayrollScreen';
import { KhataScreen } from '@/screens/KhataScreen';
import { AlertsScreen } from '@/screens/AlertsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { RegistrationScreen } from '@/screens/RegistrationScreen';
import { GatePassScreen } from '@/screens/GatePassScreen';
import { LoadingView } from '@/components/LoadingView';
import { SplashScreen } from '@/components/SplashScreen';
import { useLang } from '@/context/LangContext';
import type { UserRole } from '@/types/database';

type TabKey = 'home' | 'history' | 'workers' | 'payroll';
type StackScreen =
  | 'tabs'
  | 'addWorker'
  | 'nfcAttendance'
  | 'workerDetail'
  | 'alerts'
  | 'settings'
  | 'registration'
  | 'gatePassThekedar'
  | 'gatePassScanner';
type QuickAction = 'nfcAttendance' | 'addWorker' | 'payroll' | 'alerts' | 'registration' | 'gatePass' | 'gatePassScanner' | 'workerDetail' | 'viewWorkers';

function MainApp() {
  const { session, profile, myWorker, loading } = useAuth();
  const { t } = useLang();
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [stackScreen, setStackScreen] = useState<StackScreen>('tabs');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [initialWorkerRole, setInitialWorkerRole] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  const returnToTabs = () => {
    setStackScreen('tabs');
    setRefreshKey((k) => k + 1);
  };

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <LoadingView message="Loading..." />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  // If logged in but no profile yet, force registration
  if (!profile) {
    return <RegistrationScreen onBack={returnToTabs} onSaved={returnToTabs} />;
  }

  const role: UserRole = profile.role;

  if (stackScreen === 'addWorker') {
    return <AddWorkerScreen key={initialWorkerRole || 'new-worker'} initialRole={initialWorkerRole} onBack={returnToTabs} onSaved={returnToTabs} />;
  }

  if (stackScreen === 'nfcAttendance') {
    return <NfcAttendanceScreen onBack={returnToTabs} />;
  }

  if (stackScreen === 'workerDetail' && selectedWorkerId) {
    return <KhataScreen workerId={selectedWorkerId} onBack={returnToTabs} readOnly={profile?.role === 'labour'} />;
  }

  if (stackScreen === 'alerts') {
    return <AlertsScreen isActive={true} />;
  }

  if (stackScreen === 'settings') {
    return <SettingsScreen onBack={returnToTabs} />;
  }

  if (stackScreen === 'registration') {
    return <RegistrationScreen onBack={returnToTabs} onSaved={returnToTabs} existingProfile />;
  }

  if (stackScreen === 'gatePassThekedar') {
    return <GatePassScreen onBack={returnToTabs} mode="thekedar" />;
  }

  if (stackScreen === 'gatePassScanner') {
    return <GatePassScreen onBack={returnToTabs} mode="gatekeeper" />;
  }

  const handleNavigate = async (action: QuickAction) => {
    if (action === 'nfcAttendance') setStackScreen('nfcAttendance');
    else if (action === 'addWorker') { setInitialWorkerRole(''); setStackScreen('addWorker'); }
    else if (action === 'registration') setStackScreen('registration');
    else if (action === 'gatePass') setStackScreen('gatePassThekedar');
    else if (action === 'gatePassScanner') setStackScreen('gatePassScanner');
    else if (action === 'payroll') {
      setActiveTab('payroll');
      setRefreshKey((k) => k + 1);
    } else if (action === 'alerts') setStackScreen('alerts');
    else if (action === 'viewWorkers') {
      setActiveTab('workers');
      setRefreshKey((k) => k + 1);
    } else if (action === 'workerDetail') {
      if (myWorker?.id) {
        setSelectedWorkerId(myWorker.id);
        setStackScreen('workerDetail');
        return;
      }
      const workerName = profile?.display_name?.trim();
      if (workerName) {
        const { data } = await supabase
          .from('workers')
          .select('id')
          .ilike('name', workerName)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          setSelectedWorkerId(data.id);
          setStackScreen('workerDetail');
        }
      }
    }
  };

  const handleViewDetail = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setStackScreen('workerDetail');
  };

  const visibleTabs: TabKey[] = getTabsForRole(role);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {activeTab === 'home' && (
        <HomeScreen
          key={refreshKey}
          onNavigate={handleNavigate}
          role={role}
        />
      )}
      {activeTab === 'history' && (
        <HistoryScreen key={`history-${refreshKey}`} isActive={activeTab === 'history'} />
      )}
      {visibleTabs.includes('workers') && activeTab === 'workers' && (
        <WorkersScreen
          key={`workers-${refreshKey}`}
          isActive={activeTab === 'workers'}
          onAddWorker={(initialRole) => { setInitialWorkerRole(initialRole ?? ''); setStackScreen('addWorker'); }}
          onViewDetail={handleViewDetail}
        />
      )}
      {visibleTabs.includes('payroll') && activeTab === 'payroll' && (
        <PayrollScreen key={`payroll-${refreshKey}`} isActive={activeTab === 'payroll'} />
      )}

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 safe-bottom">
        <div className="mx-auto max-w-2xl">
          <div className="mx-3 mb-3 rounded-2xl bg-white/95 backdrop-blur-lg border border-gray-200 shadow-2xl shadow-navy-900/15">
            <div className="flex items-center gap-1 px-1 py-2">
              <TabButton
                label={t('home')}
                icon={HomeIcon}
                active={activeTab === 'home'}
                onClick={() => {
                  setActiveTab('home');
                  setRefreshKey((k) => k + 1);
                }}
              />
              {visibleTabs.includes('history') && (
                <TabButton
                  label={t('history')}
                  icon={HistoryIcon}
                  active={activeTab === 'history'}
                  onClick={() => setActiveTab('history')}
                />
              )}
              {visibleTabs.includes('workers') && (
                <TabButton
                  label={t('workers')}
                  icon={UsersIcon}
                  active={activeTab === 'workers'}
                  onClick={() => setActiveTab('workers')}
                />
              )}
              {visibleTabs.includes('payroll') && (
                <TabButton
                  label={t('payroll')}
                  icon={WalletCards}
                  active={activeTab === 'payroll'}
                  onClick={() => setActiveTab('payroll')}
                />
              )}
              <TabButton
                label={t('settings')}
                icon={SettingsIcon}
                active={false}
                onClick={() => setStackScreen('settings')}
              />
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}

function getTabsForRole(role: UserRole): TabKey[] {
  switch (role) {
    case 'thekedar':
      return ['history', 'workers', 'payroll'];
    case 'gatekeeper':
      return ['history', 'workers'];
    case 'labour':
      return ['history'];
    default:
      return ['history', 'workers', 'payroll'];
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
      onClick={onClick}
      className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-all duration-300 ${
        active
          ? 'bg-navy-50 text-navy-700'
          : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 ${active ? 'scale-110' : ''}`}>
        <Icon className={`h-5 w-5 ${active ? 'animate-nav-bounce' : ''}`} />
      </div>
      <span className={`max-w-full whitespace-nowrap text-[11px] font-semibold leading-none ${active ? 'text-navy-700' : ''}`}>{label}</span>
      {active && (
        <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full bg-gradient-to-r from-saffron-400 to-coral-400" />
      )}
    </button>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <LangProvider>
        <MainApp />
      </LangProvider>
    </AuthProvider>
  );
}
