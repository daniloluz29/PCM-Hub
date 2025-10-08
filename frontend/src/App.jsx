import React, { useState, useEffect } from 'react';
import Menu from './components/Menu.jsx';
import StatusBar from './components/StatusBar.jsx';
import PaginaLogin from './pages/Login.jsx';
import PaginaSolicitacaoCadastro from './pages/SolicitacaoCadastro.jsx';
import PaginaOrdensPreventivas from './pages/Preventivas.jsx';
import PaginaControlePneus from './pages/ControlePneus.jsx'; 
import PaginaDiagTelemetria from './pages/Telemetria.jsx';
import PaginaFAQ from './pages/FAQ.jsx';
import PaginaCadastros from './pages/Cadastros.jsx';
import PaginaDocumentacao from './pages/Documentacao.jsx';
import PaginaComunidade from './pages/Comunidade.jsx';
import PaginaPortalChamados from './pages/PortalChamados.jsx';
import PaginaGestaoAcoes from './pages/GestaoAcoes.jsx';
import AttBackupBD from './pages/AttBackupBD.jsx';
import PaginaPerfil from './pages/Perfil.jsx';
import PaginaAssistente from './pages/AssistentePCM.jsx'; 
import PaginaBI from './pages/BI.jsx';
import PaginaFluxograma from './pages/Fluxograma.jsx';
import './styles/app.css';


import ModalConfirmacao from './components/ModalConfirmacao.jsx';
import FloatingUserInfo from './components/FloatingUserInfo.jsx';
import FloatingFilters from './components/FloatingFilters.jsx';

// --- COMPONENTES DE PÁGINA (PLACEHOLDERS) ---
function PaginaVisaoGeral() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>Visão Geral 📈</h1></div></main></div>) }
function PaginaOrdensCorretivas() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>Ordens de Serviço: Corretivas</h1></div></main></div>) }
function PaginaMaquinaParada() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>Análise de Máquina Parada (RDM)</h1></div></main></div>) }
function PaginaKpiDisponibilidade() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>KPI: Disponibilidade Física</h1></div></main></div>) }
function PaginaKpiMtbf() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>KPI: MTBF (Tempo Médio Entre Falhas)</h1></div></main></div>) }
function PaginaKpiMttr() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>KPI: MTTR (Tempo Médio Para Reparo)</h1></div></main></div>) }
function PaginaDiagOleo() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>Diagnósticos: Análise de Óleo</h1></div></main></div>) }
function PaginaCustoGerencial() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>Custos: Análise Gerencial</h1></div></main></div>) }
function PaginaCustoContabil() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>Custos: Análise Contábil</h1></div></main></div>) }
function PaginaCustoRealocacao() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>Custos: Extrato de Realocação Orçamentária</h1></div></main></div>) }
function PaginaCustoSimulador() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>Custos: Simulador de Orçamentos</h1></div></main></div>) }
function PaginaProcAtendimento() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>Processos: Nível de Atendimento</h1></div></main></div>) }
function PaginaProcMapeamento() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>Processos: Mapeamento</h1></div></main></div>) }
function PaginaEquipView() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>EquipView</h1></div></main></div>) }
function PaginaPainelGerencial() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>Painel Gerencial (D-7)</h1></div></main></div>) }
function PaginaIQD() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>IQD - Pesquisa de Satisfação</h1></div></main></div>) }
function PaginaAcessoNegado() { return(<div className="page-container"><main className="content-area"><div className="card"><h1>Acesso Negado</h1><p>Você não tem permissão para visualizar esta página.</p></div></main></div>) }


// --- COMPONENTE PRINCIPAL DA APLICAÇÃO ---
function App() {
    const getInitialUser = () => {
        const sessionUser = sessionStorage.getItem('currentUser');
        if (sessionUser) return JSON.parse(sessionUser);
        const localUser = localStorage.getItem('currentUser');
        if (localUser) return JSON.parse(localUser);
        return null;
    };

    const [currentUser, setCurrentUser] = useState(getInitialUser);
    const [authStatus, setAuthStatus] = useState(currentUser ? 'autenticado' : 'login');
    const [paginaAtual, setPaginaAtual] = useState(() => sessionStorage.getItem('paginaAtual') || 'visao_geral');
    const [modalSairAberto, setModalSairAberto] = useState(false);
    
    const [globalFilters, setGlobalFilters] = useState({
        superintendencias: [], nucleos: [], contratos: [],
        estados: [], controladores: [], gestores: [],
        visao: { value: 'Contrato', label: 'Contrato' },
        exibicao: { value: 'ativos', label: 'Somente Ativos' }
    });

    useEffect(() => {
        sessionStorage.setItem('paginaAtual', paginaAtual);
    }, [paginaAtual]);

    const handleLoginSuccess = (userData, rememberMe) => {
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('currentUser', JSON.stringify(userData));
        setCurrentUser(userData);
        setAuthStatus('autenticado');
        setPaginaAtual('visao_geral');
    };

    const handleLogoutConfirm = () => {
        setModalSairAberto(false);
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('paginaAtual');
        setCurrentUser(null);
        setAuthStatus('login');
    };

    const handleFiltersApply = (filters) => {
        setGlobalFilters(filters);
    };
    
    const hasAccess = (panelId) => {
        if (!currentUser) return false;
        if (currentUser.perfil_id === 'master_admin') return true;
        const userAccessList = currentUser.acessos ? currentUser.acessos.split(',') : [];
        return userAccessList.includes(panelId);
    };

    const hasPermission = (permissionId) => {
        if (!currentUser || !currentUser.permissoes) return false;
        if (currentUser.perfil_id === 'master_admin') return true;
        return currentUser.permissoes.includes(permissionId);
    };

    const paginasDePainel = [
        'os_preventivas', 'os_corretivas', 'maquina_parada', 'kpi_disponibilidade',
        'kpi_mtbf', 'kpi_mttr', 'diag_oleo', 'diag_telemetria', 'controle_pneus',
        'custo_gerencial', 'custo_contabil', 'custo_realocacao', 'custo_simulador',
        'proc_atendimento', 'proc_mapeamento', 'equipview', 'painel_gerencial'
    ];
    
    const podeVerPaineis = paginasDePainel.some(p => hasAccess(p));
    const isPaginaDePainel = paginasDePainel.includes(paginaAtual);

    const renderCurrentDashboardPage = () => {
        const pageAccessMapping = {
            'os_corretivas': 'os_corretivas', 'os_preventivas': 'os_preventivas', 'maquina_parada': 'maquina_parada',
            'kpi_disponibilidade': 'kpi_disponibilidade', 'kpi_mtbf': 'kpi_mtbf', 'kpi_mttr': 'kpi_mttr',
            'diag_oleo': 'diag_oleo', 'diag_telemetria': 'diag_telemetria', 'controle_pneus': 'controle_pneus',
            'custo_gerencial': 'custo_gerencial', 'custo_contabil': 'custo_contabil', 'custo_realocacao': 'custo_realocacao', 'custo_simulador': 'custo_simulador',
            'proc_atendimento': 'proc_atendimento', 'proc_mapeamento': 'proc_mapeamento', 'equipview': 'equipview', 'painel_gerencial': 'painel_gerencial',
            'gestao_acoes': 'gestao_acoes_acesso', 'assistente_pcm': 'assistente_pcm_acesso', 'comunidade': 'comunidade_acesso',
            'documentacao': 'documentacao_acesso', 'portal_chamados': 'chamados_acesso', 'cadastros': 'cadastros_acesso',
            'faq': 'faq_acesso', 'iQD': 'iqd_acesso', 'perfil': 'perfil_acesso', 
            'att_backup': 'att_backup_acesso',
            'bi_paineis': 'bi_acesso',
            'fluxograma': 'fluxograma_acesso'
        };

        const requiredAccess = pageAccessMapping[paginaAtual];
        const isPanelPage = paginasDePainel.includes(paginaAtual);
        const canViewPage = paginaAtual === 'perfil' ? true : (requiredAccess ? (isPanelPage ? hasAccess(requiredAccess) : hasPermission(requiredAccess)) : true);

        if (!canViewPage) {
            return <PaginaAcessoNegado />;
        }

        const paginas = {
            'os_corretivas': <PaginaOrdensCorretivas globalFilters={globalFilters} currentUser={currentUser} />,
            'os_preventivas': <PaginaOrdensPreventivas globalFilters={globalFilters} currentUser={currentUser} />,
            'maquina_parada': <PaginaMaquinaParada globalFilters={globalFilters} currentUser={currentUser} />,
            'kpi_disponibilidade': <PaginaKpiDisponibilidade globalFilters={globalFilters} currentUser={currentUser} />,
            'kpi_mtbf': <PaginaKpiMtbf globalFilters={globalFilters} currentUser={currentUser} />,
            'kpi_mttr': <PaginaKpiMttr globalFilters={globalFilters} currentUser={currentUser} />,
            'diag_oleo': <PaginaDiagOleo globalFilters={globalFilters} currentUser={currentUser} />,
            'diag_telemetria': <PaginaDiagTelemetria globalFilters={globalFilters} currentUser={currentUser} />,
            'controle_pneus': <PaginaControlePneus currentUser={currentUser} />, // ATUALIZADO
            'custo_gerencial': <PaginaCustoGerencial globalFilters={globalFilters} currentUser={currentUser} />,
            'custo_contabil': <PaginaCustoContabil globalFilters={globalFilters} currentUser={currentUser} />,
            'custo_realocacao': <PaginaCustoRealocacao globalFilters={globalFilters} currentUser={currentUser} />,
            'custo_simulador': <PaginaCustoSimulador globalFilters={globalFilters} currentUser={currentUser} />,
            'proc_atendimento': <PaginaProcAtendimento globalFilters={globalFilters} currentUser={currentUser} />,
            'proc_mapeamento': <PaginaProcMapeamento globalFilters={globalFilters} currentUser={currentUser} />,
            'equipview': <PaginaEquipView globalFilters={globalFilters} currentUser={currentUser} />,
            'painel_gerencial': <PaginaPainelGerencial globalFilters={globalFilters} currentUser={currentUser} />,
            'gestao_acoes': <PaginaGestaoAcoes currentUser={currentUser} />,
            'assistente_pcm': <PaginaAssistente currentUser={currentUser} />,
            'comunidade': <PaginaComunidade currentUser={currentUser} />,
            'documentacao': <PaginaDocumentacao />,
            'portal_chamados': <PaginaPortalChamados currentUser={currentUser} />,
            'cadastros': <PaginaCadastros currentUser={currentUser} />,
            'faq': <PaginaFAQ currentUser={currentUser} />,
            'iQD': <PaginaIQD />,
            'perfil': <PaginaPerfil currentUser={currentUser} />,
            'att_backup': <AttBackupBD currentUser={currentUser} />,
            'bi_paineis': <PaginaBI currentUser={currentUser} />,
            'fluxograma': <PaginaFluxograma currentUser={currentUser} />
        };
        return paginas[paginaAtual] || <PaginaVisaoGeral />;
    };

    if (authStatus !== 'autenticado') {
        if (authStatus === 'solicitacao') {
            return <PaginaSolicitacaoCadastro onNavigateToLogin={() => setAuthStatus('login')} />;
        }
        return <PaginaLogin 
                    onLoginSuccess={handleLoginSuccess} 
                    onNavigateToSolicitacao={() => setAuthStatus('solicitacao')} 
                />;
    }

    return (
        <>
            <div className="main-content-wrapper">
                <Menu 
                    currentUser={currentUser}
                    onNavigate={setPaginaAtual} 
                    paginaAtual={paginaAtual}
                    onLogout={() => setModalSairAberto(true)}
                />
                {renderCurrentDashboardPage()}

                <FloatingUserInfo currentUser={currentUser} />
                
                {podeVerPaineis && (
                    <div className={isPaginaDePainel ? 'floating-filters-container visible' : 'floating-filters-container hidden'}>
                        <FloatingFilters 
                            onFiltersApply={handleFiltersApply} 
                            currentUser={currentUser}
                            globalFilters={globalFilters} 
                        />
                    </div>
                )}

                <ModalConfirmacao
                    isOpen={modalSairAberto}
                    onClose={() => setModalSairAberto(false)}
                    onConfirm={handleLogoutConfirm}
                    title="Confirmar Saída"
                >
                    <p>Você tem certeza que deseja sair do portal?</p>
                </ModalConfirmacao>
            </div>
            <StatusBar />
        </>
    );
}

export default App;
