import React, { useState, useEffect, useRef, useMemo } from 'react';
import Notificacoes from './Notificacoes.jsx';

function Menu({ currentUser, onNavigate, paginaAtual, onLogout }) {
    const [notificacoesAbertas, setNotificacoesAbertas] = useState(false);
    const [notificacoes, setNotificacoes] = useState([]);
    const notificationRef = useRef(null);

    const fetchNotificacoes = async () => {
        if (!currentUser) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/notificacoes/${currentUser.id}`);
            if (response.ok) {
                const data = await response.json();
                setNotificacoes(data);
            }
        } catch (error) {
            console.error("Falha ao buscar notificações:", error);
        }
    };

    useEffect(() => {
        fetchNotificacoes();
        const interval = setInterval(fetchNotificacoes, 60000); // A cada 1 minuto
        return () => clearInterval(interval);
    }, [currentUser]);


    useEffect(() => {
        function handleClickOutside(event) {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setNotificacoesAbertas(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [notificationRef]);

    const userAccessSet = useMemo(() => new Set(currentUser?.acessos?.split(',') || []), [currentUser]);

    const hasAccess = (panelId) => {
        if (!currentUser) return false;
        if (currentUser.perfil_id === 'master_admin') return true;
        return userAccessSet.has(panelId);
    };
    
    const hasPermission = (perm) => {
        if (!currentUser) return false;
        if (currentUser.perfil_id === 'master_admin') return true;
        return currentUser.permissoes?.includes(perm);
    };

    const canSeeOsMenu = hasAccess('os_corretivas') || hasAccess('os_preventivas');
    const canSeeKpiMenu = hasAccess('kpi_disponibilidade') || hasAccess('kpi_mtbf') || hasAccess('kpi_mttr');
    const canSeeDiagMenu = hasAccess('diag_oleo') || hasAccess('diag_telemetria');
    const canSeeCustosMenu = hasAccess('custo_gerencial') || hasAccess('custo_contabil') || hasAccess('custo_realocacao') || hasAccess('custo_simulador');
    const canSeeProcessosMenu = hasAccess('proc_atendimento') || hasAccess('proc_mapeamento');


    const getClassName = (pageName) => paginaAtual === pageName ? 'nav-link selected' : 'nav-link';
    const unreadCount = notificacoes.filter(n => !n.lida).length;

    const isOsPageActive = ['os_corretivas', 'os_preventivas'].includes(paginaAtual);
    const isKpiPageActive = ['kpi_disponibilidade', 'kpi_mtbf', 'kpi_mttr'].includes(paginaAtual);
    const isDiagPageActive = ['diag_oleo', 'diag_telemetria'].includes(paginaAtual);
    const isCustoPageActive = ['custo_gerencial', 'custo_contabil', 'custo_realocacao', 'custo_simulador'].includes(paginaAtual);
    const isProcessosPageActive = ['proc_atendimento', 'proc_mapeamento'].includes(paginaAtual);

    return (
        <nav className="menu-bar">
            <div className="menu-logo">
                <a onClick={() => onNavigate('visao_geral')}>
                    <img src="/images/logo tradimaq branca.png" alt="Logo Tradimaq" />
                </a>
            </div>

            <ul className="menu-list">
                {canSeeOsMenu && (
                    <li className="menu-item">
                        <a className={isOsPageActive ? 'nav-link selected' : 'nav-link'}> OS's</a>
                        <div className="dropdown-content">
                            {hasAccess('os_corretivas') && <a className={getClassName('os_corretivas')} onClick={() => onNavigate('os_corretivas')}>Corretivas</a>}
                            {hasAccess('os_preventivas') && <a className={getClassName('os_preventivas')} onClick={() => onNavigate('os_preventivas')}>Preventivas</a>}
                        </div>
                    </li>
                )}
                {hasAccess('maquina_parada') && <li className="menu-item"><a className={getClassName('maquina_parada')} onClick={() => onNavigate('maquina_parada')}>RDM</a></li>}
                {canSeeKpiMenu && (
                    <li className="menu-item">
                        <a className={isKpiPageActive ? 'nav-link selected' : 'nav-link'}>Confiabilidade</a>
                        <div className="dropdown-content">
                            {hasAccess('kpi_disponibilidade') && <a className={getClassName('kpi_disponibilidade')} onClick={() => onNavigate('kpi_disponibilidade')}>Disponibilidade Física</a>}
                            {hasAccess('kpi_mtbf') && <a className={getClassName('kpi_mtbf')} onClick={() => onNavigate('kpi_mtbf')}>MTBF</a>}
                            {hasAccess('kpi_mttr') && <a className={getClassName('kpi_mttr')} onClick={() => onNavigate('kpi_mttr')}>MTTR</a>}
                        </div>
                    </li>
                )}
                {canSeeDiagMenu && (
                    <li className="menu-item">
                        <a className={isDiagPageActive ? 'nav-link selected' : 'nav-link'}>Diagnósticos</a>
                        <div className="dropdown-content">
                            {hasAccess('diag_oleo') && <a className={getClassName('diag_oleo')} onClick={() => onNavigate('diag_oleo')}>Análise de Óleo</a>}
                            {hasAccess('diag_telemetria') && <a className={getClassName('diag_telemetria')} onClick={() => onNavigate('diag_telemetria')}>Telemetria</a>}
                        </div>
                    </li>
                )}
                {hasAccess('controle_pneus') && <li className="menu-item"><a className={getClassName('controle_pneus')} onClick={() => onNavigate('controle_pneus')}>Controle de Pneus</a></li>}
                {canSeeCustosMenu && (
                    <li className="menu-item">
                        <a className={isCustoPageActive ? 'nav-link selected' : 'nav-link'}>Custos</a>
                        <div className="dropdown-content">
                            {hasAccess('custo_gerencial') && <a className={getClassName('custo_gerencial')} onClick={() => onNavigate('custo_gerencial')}>Custo Gerencial</a>}
                            {hasAccess('custo_contabil') && <a className={getClassName('custo_contabil')} onClick={() => onNavigate('custo_contabil')}>Custo Contábil</a>}
                            {hasAccess('custo_realocacao') && <a className={getClassName('custo_realocacao')} onClick={() => onNavigate('custo_realocacao')}>Extrato de Realocação</a>}
                            {hasAccess('custo_simulador') && <a className={getClassName('custo_simulador')} onClick={() => onNavigate('custo_simulador')}>Simulador de Orçamentos</a>}
                        </div>
                    </li>
                )}
                 {canSeeProcessosMenu && (
                    <li className="menu-item">
                        <a className={isProcessosPageActive ? 'nav-link selected' : 'nav-link'}>Processos</a>
                        <div className="dropdown-content">
                            {hasAccess('proc_atendimento') && <a className={getClassName('proc_atendimento')} onClick={() => onNavigate('proc_atendimento')}>Nível de Atendimento</a>}
                            {hasAccess('proc_mapeamento') && <a className={getClassName('proc_mapeamento')} onClick={() => onNavigate('proc_mapeamento')}>Mapeamento de Processos</a>}
                        </div>
                    </li>
                )}
                {hasAccess('equipview') && <li className="menu-item"><a className={getClassName('equipview')} onClick={() => onNavigate('equipview')}>EquipView</a></li>}
                {hasAccess('painel_gerencial') && <li className="menu-item"><a className={getClassName('painel_gerencial')} onClick={() => onNavigate('painel_gerencial')}>Painel Gerencial</a></li>}
            </ul>
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className="notification-bell-container" ref={notificationRef}>
                    <i className="bi bi-bell-fill" onClick={() => setNotificacoesAbertas(!notificacoesAbertas)}></i>
                    {unreadCount > 0 && <span className="notification-badge-menu">{unreadCount}</span>}
                    <Notificacoes 
                        isOpen={notificacoesAbertas} 
                        notificacoes={notificacoes}
                        currentUser={currentUser}
                        onNavigate={onNavigate}
                        onClose={() => setNotificacoesAbertas(false)}
                        onRefresh={fetchNotificacoes}
                    />
                </div>
                <div className="menu-options">
                    <div className="menu-item">
                        <a className="nav-link"><i className="bi bi-list" style={{fontSize: '24px'}}></i></a>
                        <div className="dropdown-content">
                            {hasPermission('bi_acesso') && (
                                <a className="nav-link" onClick={() => onNavigate('bi_paineis')}><i className="bi bi-bar-chart-line-fill"></i> BI & Análises</a>
                            )}
                            {hasPermission('fluxograma_acesso') && (
                                <a className={getClassName('fluxograma')} onClick={() => onNavigate('fluxograma')}><i className="bi bi-bar-chart-steps"></i> Fluxograma</a>
                            )}
                            {hasPermission('gestao_acoes_acesso') && (
                                <a className="nav-link" onClick={() => onNavigate('gestao_acoes')}><i className="bi bi-kanban"></i> Gestão de Ações</a>
                            )}
                            {hasPermission('assistente_pcm_acesso') && (
                                <a className="nav-link" onClick={() => onNavigate('assistente_pcm')}><i className="bi bi-robot"></i> Assistente PCM</a>
                            )}
                            {hasPermission('comunidade_acesso') && (
                                <a className="nav-link" onClick={() => onNavigate('comunidade')}><i className="bi bi-people-fill"></i> Comunidade</a>
                            )}
                            {hasPermission('documentacao_acesso') && (
                                <a className="nav-link" onClick={() => onNavigate('documentacao')}><i className="bi bi-book"></i> Documentação</a>
                            )}
                            {hasPermission('chamados_acesso') && (
                                <a className="nav-link" onClick={() => onNavigate('portal_chamados')}><i className="bi bi-headset"></i> Portal de Chamados</a>
                            )}
                            {hasPermission('cadastros_acesso') && (
                                <a className="nav-link" onClick={() => onNavigate('cadastros')}><i className="bi bi-clipboard"></i> Cadastros</a>
                            )}
                            
                            {(hasPermission('gestao_acoes_acesso') || hasPermission('assistente_pcm_acesso') || hasPermission('comunidade_acesso') || hasPermission('documentacao_acesso') || hasPermission('portal_chamados_acesso') || hasPermission('cadastros_acesso')) && 
                             (hasPermission('faq_acesso') || hasPermission('iqd_acesso')) && (
                                <li className="menu-divider"></li>
                            )}
                            
                            {hasPermission('faq_acesso') && (
                                <a className="nav-link" onClick={() => onNavigate('faq')}><i className="bi bi-question-circle"></i> FAQ</a>
                            )}
                            {hasPermission('iqd_acesso') && (
                                <a className="nav-link" onClick={() => onNavigate('iQD')}><i className="bi bi-star"></i> IQD</a>
                            )}
                            
                            <li className="menu-divider"></li>
                            <a className="nav-link" onClick={() => onNavigate('perfil')}>
                                <i className="bi bi-person-circle"></i> Perfil
                            </a>
                            <a className="nav-link" onClick={() => onNavigate('att_backup')}>
                                <i className="bi bi-cloud-arrow-up-fill"></i> Atualização e backup
                            </a>
                            <a className="nav-link" onClick={onLogout}>
                                <i className="bi bi-box-arrow-right"></i> Sair
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}

export default Menu;
