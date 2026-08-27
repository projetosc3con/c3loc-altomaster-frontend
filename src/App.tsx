import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Rentals from './pages/Rentals';
import Users from './pages/Users';
import UserForm from './pages/UserForm';
import EquipmentForm from './pages/EquipmentForm';
import EquipmentEdit from './pages/EquipmentEdit';
import LoginPage from './pages/LoginPage';
import Profile from './pages/Profile';
import SetPassword from './pages/SetPassword';
import Clients from './pages/Clients';
import ClientForm from './pages/ClientForm';
import RentalForm from './pages/RentalForm';
import RentalEdit from './pages/RentalEdit';
import Parts from './pages/Parts';
import PartForm from './pages/PartForm';
import MaintenanceForm from './pages/MaintenanceForm';
import Maintenance from './pages/Maintenance';
import Logistics from './pages/Logistics';
import LogisticsTriagem from './pages/LogisticsTriagem';
import HR from './pages/HR/HR';
import EmployeeDetail from './pages/HR/EmployeeDetail';
import OnboardingPage from './pages/HR/OnboardingPage';
import ClockIn from './pages/ClockIn';
import {
  PositionsTab,
  DocumentsTab,
  IntegrationsTab,
  TrainingsTab
} from './pages/HR/tabs';
import Financeiro from './pages/Financeiro/Financeiro';
import { ScoreTab, ExtratoTab, ConciliacaoTab } from './pages/Financeiro/tabs';
import CRM from './pages/CRM/CRM';
import {
  PipelineTab,
  LeadsTab,
  ContactsTab,
  TasksTab,
  SettingsTab
} from './pages/CRM/tabs';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Redireciona para /definir-senha se o usuário ainda não definiu sua senha
const PasswordGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();

  // Se o perfil carregou e password_set é false, redireciona
  if (profile && profile.password_set === false) {
    return <Navigate to="/definir-senha" replace />;
  }

  return <>{children}</>;
};

const Placeholder = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900/50 p-12 text-center transition-colors">
    <div className="w-20 h-20 bg-mustard-500/10 dark:bg-mustard-500/5 rounded-full flex items-center justify-center mb-6 shadow-inner">
      <span className="material-symbols-outlined text-mustard-600 dark:text-mustard-500 text-4xl">construction</span>
    </div>
    <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h2>
    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Este módulo está em desenvolvimento e estará disponível em breve.</p>
    <div className="mt-8 px-6 py-2 bg-slate-50 dark:bg-slate-800 rounded-full border border-slate-100 dark:border-slate-700">
      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">C3LOC</span>
    </div>
  </div>
);

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/definir-senha" element={<SetPassword />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              {/* Clock-in: sem sidebar */}
              <Route path="/ponto" element={<PasswordGuard><ClockIn /></PasswordGuard>} />

              <Route element={<PasswordGuard><AppLayout /></PasswordGuard>}>

                {/* Routes accessible by all allowed roles (except Financeiro and Usuário) */}
                <Route element={<ProtectedRoute allowedRoles={['Administrador', 'Diretoria', 'Gerente', 'Comercial', 'Manutenção', 'Recursos Humanos', 'Logística']} />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/perfil" element={<Profile />} />
                </Route>

                {/* FULL ACCESS ONLY: Locações, Equipamentos, Usuários, Financeiro, Configurações */}
                <Route element={<ProtectedRoute allowedRoles={['Administrador', 'Diretoria', 'Gerente']} />}>
                  <Route path="/locacoes" element={<Rentals />} />
                  <Route path="/locacoes/novo" element={<RentalForm />} />
                  <Route path="/locacoes/editar/:id" element={<RentalEdit />} />
                  <Route path="/equipamentos" element={<Inventory />} />
                  <Route path="/equipamentos/novo" element={<EquipmentForm />} />
                  <Route path="/equipamentos/editar/:id" element={<EquipmentEdit />} />
                  <Route path="/usuarios" element={<Users />} />
                  <Route path="/usuarios/novo" element={<UserForm />} />
                  <Route path="/usuarios/editar/:id" element={<UserForm />} />
                  <Route path="/financeiro" element={<Financeiro />}>
                    <Route index element={<Navigate to="extrato" replace />} />
                    <Route path="extrato" element={<ExtratoTab />} />
                    <Route path="conciliacao" element={<ConciliacaoTab />} />
                    <Route path="score" element={<ScoreTab />} />
                  </Route>
                  <Route path="/configuracoes" element={<Placeholder title="Configurações" />} />
                  <Route path="/clientes/novo" element={<ClientForm />} />
                </Route>

                {/* COMERCIAL ACCESS: CRM and Clientes */}
                <Route element={<ProtectedRoute allowedRoles={['Administrador', 'Diretoria', 'Gerente', 'Comercial']} />}>
                  <Route path="/clientes" element={<Clients />} />
                  <Route path="/clientes/:id" element={<ClientForm />} />
                  <Route path="/crm" element={<CRM />}>
                    <Route index element={<Navigate to="pipeline" replace />} />
                    <Route path="pipeline" element={<PipelineTab />} />
                    <Route path="leads" element={<LeadsTab />} />
                    <Route path="contatos" element={<ContactsTab />} />
                    <Route path="tarefas" element={<TasksTab />} />
                    <Route path="configuracoes" element={<SettingsTab />} />
                  </Route>
                </Route>

                {/* MAINTENANCE / MATERIALS ACCESS */}
                <Route element={<ProtectedRoute allowedRoles={['Administrador', 'Diretoria', 'Gerente', 'Manutenção']} />}>
                  <Route path="/materiais" element={<Parts />} />
                  <Route path="/materiais/novo" element={<PartForm />} />
                  <Route path="/materiais/editar/:id" element={<PartForm />} />
                  <Route path="/pecas" element={<Navigate to="/materiais" replace />} />
                  <Route path="/pecas/novo" element={<Navigate to="/materiais/novo" replace />} />
                  <Route path="/manutencoes" element={<Maintenance />} />
                  <Route path="/manutencoes/nova" element={<MaintenanceForm />} />
                  <Route path="/manutencoes/editar/:id" element={<MaintenanceForm />} />
                </Route>

                {/* RH ACCESS: RH Module */}
                <Route element={<ProtectedRoute allowedRoles={['Administrador', 'Diretoria', 'Gerente', 'Recursos Humanos']} />}>
                  <Route path="/rh" element={<HR />}>
                    <Route index element={<Navigate to="cargos" replace />} />
                    <Route path="cargos" element={<PositionsTab />} />
                    <Route path="documentacao" element={<DocumentsTab />} />
                    <Route path="integracoes" element={<IntegrationsTab />} />
                    <Route path="treinamentos" element={<TrainingsTab />} />
                  </Route>
                  <Route path="/rh/colaboradores/:id" element={<EmployeeDetail />} />
                  <Route path="/rh/colaboradores/:id/onboarding" element={<OnboardingPage />} />
                </Route>

                <Route element={<ProtectedRoute allowedRoles={['Administrador', 'Diretoria', 'Gerente', 'Logística']} />}>
                  <Route path="/logistica" element={<Logistics />} />
                  <Route path="/logistica/triagem/:id" element={<LogisticsTriagem />} />
                </Route>

              </Route>
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
