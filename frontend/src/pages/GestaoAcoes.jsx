import React, { useState, useEffect, useMemo, useRef } from 'react';
import ModalNovaTarefa from './GestaoAcoes/Tarefa.jsx';
import ModalNovoPlanoDeAcao from './GestaoAcoes/PlanoDeAcao.jsx';
import DetTarefas from './GestaoAcoes/DetTarefas.jsx';
import DetPlanoDeAcao from './GestaoAcoes/DetPlanoDeAcao.jsx';
import ModalConfirmacao from '../components/ModalConfirmacao.jsx';
import ModalAlerta from '../components/ModalAlerta.jsx';
import Select from 'react-select';
import PainelInsights from './GestaoAcoes/PainelInsights.jsx'; // 1. Importar o novo painel

// Helper function to check user permissions.
const hasPermission = (user, permission) => {
    if (!user || !user.permissoes) return false;
    if (user.perfil_id === 'master_admin') return true;
    return user.permissoes.includes(permission);
};

const getPriorityClassName = (priority) => {
    if (!priority) return 'default';
    return priority.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};
const getTypeClassName = (tipo) => {
    if (!tipo) return '';
    return tipo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-');
};

// --- Componente do Cartão Kanban ---
const KanbanCard = ({ item, onClick, onContextMenu }) => {
    
    const isNearDeadline = useMemo(() => {
        if (!item.data_prazo || !item.data_criacao) return false;
        const hoje = new Date();
        const prazo = new Date(item.data_prazo);
        const criacao = new Date(item.data_criacao);

        if (hoje > prazo) return true;

        const totalTime = prazo.getTime() - criacao.getTime();
        const remainingTime = prazo.getTime() - hoje.getTime();
        
        return totalTime > 0 ? (remainingTime / totalTime) <= 0.1 : false;
    }, [item.data_prazo, item.data_criacao]);

    const progress = item.subtasks_total > 0
        ? Math.round((item.subtasks_completed / item.subtasks_total) * 100)
        : null;

    return (
        <div 
            className={`kanban-card type-${getTypeClassName(item.tipo)}`} 
            onClick={() => onClick(item)}
            onContextMenu={(e) => onContextMenu(e, item)}
        >
            <div className="card-header">
                <span className="card-tag">{item.tipo}</span>
                <span className={`card-priority ${getPriorityClassName(item.prioridade)}`}>{item.prioridade}</span>
            </div>
            <p className="card-title">{item.titulo}</p>
            <div className="card-footer">
                <div className="card-assignees">
                    {item.responsaveis.map((resp, index) => <span key={index} className="assignee-avatar" title={resp.nome}>{resp.iniciais}</span>)}
                </div>
                <div className="card-details">
                    {progress !== null && (
                        <span className="card-progress" title={`${item.subtasks_completed} de ${item.subtasks_total} concluídas`}>
                            <i className="bi bi-speedometer2"></i> {progress}%
                        </span>
                    )}
                    <span className={`card-due-date ${isNearDeadline ? 'deadline-warning' : ''}`}>
                        <i className="bi bi-calendar-check"></i> {item.data_prazo}
                    </span>
                </div>
            </div>
        </div>
    );
};


function PaginaGestaoAcoes({ currentUser }) {
    const [itens, setItens] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTarefaModalOpen, setIsTarefaModalOpen] = useState(false);
    const [isPlanoModalOpen, setIsPlanoModalOpen] = useState(false);
    const [itemSelecionado, setItemSelecionado] = useState(null);
    const [showCanceled, setShowCanceled] = useState(false);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, item: null });
    const [itemParaExcluir, setItemParaExcluir] = useState(null);
    const [alerta, setAlerta] = useState({ aberto: false, mensagem: '' });
    
    const [abaAtiva, setAbaAtiva] = useState('minhas_tarefas');
    const [filtroResponsavel, setFiltroResponsavel] = useState(null);
    const [viewMode, setViewMode] = useState('kanban'); // 2. Novo estado para controlar a visão

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [itensRes, usuariosRes] = await Promise.all([
                fetch('http://127.0.0.1:5000/api/gestao-acoes'),
                fetch('http://127.0.0.1:5000/api/usuarios')
            ]);
            if (!itensRes.ok || !usuariosRes.ok) throw new Error('Falha ao buscar dados do servidor.');
            
            const itensData = await itensRes.json();
            const usuariosData = await usuariosRes.json();
            setItens(itensData);
            setUsuarios(usuariosData);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, item: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const itensVisiveisNaAba = useMemo(() => {
        if (!currentUser) return [];

        if (abaAtiva === 'minhas_tarefas') {
            return itens.filter(item => 
                item.responsaveis.some(resp => resp.id === currentUser.id)
            );
        } 
        if (abaAtiva === 'tarefas_equipe') {
            if (hasPermission(currentUser, 'gestao_acoes_ver_tudo')) {
                return itens;
            }
            return itens.filter(item => item.criado_por_id === currentUser.id);
        }
        return [];
    }, [itens, currentUser, abaAtiva]);

    const itensFiltrados = useMemo(() => {
        if (filtroResponsavel) {
            return itensVisiveisNaAba.filter(item => 
                item.responsaveis.some(resp => resp.id === filtroResponsavel.value)
            );
        }
        return itensVisiveisNaAba;
    }, [itensVisiveisNaAba, filtroResponsavel]);

    const optionsUsuariosFiltro = useMemo(() => {
        const responsaveisIds = new Set();
        itensVisiveisNaAba.forEach(item => {
            item.responsaveis.forEach(resp => {
                responsaveisIds.add(resp.id);
            });
        });
        
        return usuarios
            .filter(user => responsaveisIds.has(user.id))
            .map(user => ({ value: user.id, label: user.nome }));
    }, [itensVisiveisNaAba, usuarios]);


    const handleCardClick = (item) => {
        setItemSelecionado(item);
    };

    const handleCloseDetailModal = () => {
        setItemSelecionado(null);
        fetchData();
    };

    const handleContextMenu = (event, item) => {
        event.preventDefault();
        if (hasPermission(currentUser, 'gestao_acoes_excluir')) {
            setContextMenu({ visible: true, x: event.pageX, y: event.pageY, item });
        }
    };

    const handleDeleteClick = () => {
        setItemParaExcluir(contextMenu.item);
        setContextMenu({ visible: false, x: 0, y: 0, item: null });
    };

    const handleDeleteConfirm = async () => {
        if (!itemParaExcluir) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/gestao-acoes/${itemParaExcluir.id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ aberto: true, mensagem: result.message });
            fetchData();
        } catch (err) {
            setAlerta({ aberto: true, mensagem: `Erro: ${err.message}` });
        }
        setItemParaExcluir(null);
    };

    const aFazer = itensFiltrados.filter(item => item.status === 'A Fazer');
    const emAndamento = itensFiltrados.filter(item => item.status === 'Em Andamento');
    const concluido = itensFiltrados.filter(item => item.status === 'Concluído');
    const cancelado = itensFiltrados.filter(item => item.status === 'Cancelado');

    return (
        <>
            <div className="page-container">
                <main className="content-area" style={{marginLeft: '2rem'}}>
                    <div className="page-header-container">
                        <div className="page-header">
                            <h1>Gestão de Ações</h1>
                            <p>Crie e acompanhe projetos, planos de ação e tarefas da sua equipe.</p>
                        </div>
                        <div className="page-header-actions">
                            <button className="toggle-canceled-btn" onClick={() => setShowCanceled(!showCanceled)}>
                                <i className={`bi ${showCanceled ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i>
                                {showCanceled ? 'Ocultar Cancelados' : 'Exibir Cancelados'}
                            </button>
                        </div>
                    </div>

                    <div className="admin-actions-bar" style={{justifyContent: 'space-between', marginBottom: '10px'}}>
                        {hasPermission(currentUser, 'gestao_acoes_cadastrar') ? (
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <button className="admin-button" onClick={() => setIsPlanoModalOpen(true)}><i className="bi bi-list-check"></i> Novo Plano de Ação</button>
                                <button className="admin-button" onClick={() => setIsTarefaModalOpen(true)}><i className="bi bi-card-checklist"></i> Nova Tarefa</button>
                            </div>
                        ) : <div />}
                        
                        {abaAtiva === 'tarefas_equipe' && (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <div className="filter-group" style={{ width: '250px', marginBottom: '0' }}>
                                    <Select
                                        options={optionsUsuariosFiltro}
                                        value={filtroResponsavel}
                                        onChange={setFiltroResponsavel}
                                        isClearable
                                        placeholder="Filtrar por responsável..."
                                    />
                                </div>
                                {/* 3. Botão para alternar a visão */}
                                <button className="sidebar-toggle-btn" onClick={() => setViewMode(viewMode === 'kanban' ? 'insights' : 'kanban')} title={viewMode === 'kanban' ? 'Ver Insights' : 'Ver Kanban'}>
                                    <i className={`bi ${viewMode === 'kanban' ? 'bi-bar-chart-line-fill' : 'bi-kanban-fill'}`}></i>
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="tabs-container">
                        <button className={`tab-item ${abaAtiva === 'minhas_tarefas' ? 'active' : ''}`} onClick={() => setAbaAtiva('minhas_tarefas')}>Minhas Tarefas</button>
                        {hasPermission(currentUser, 'gestao_acoes_cadastrar') && (
                            <button className={`tab-item ${abaAtiva === 'tarefas_equipe' ? 'active' : ''}`} onClick={() => setAbaAtiva('tarefas_equipe')}>Tarefas da Equipe</button>
                        )}
                    </div>
                    
                    {/* 4. Renderização condicional */}
                    {isLoading ? <p>A carregar...</p> : error ? <p style={{color: 'red'}}>{error}</p> : (
                        viewMode === 'insights' && abaAtiva === 'tarefas_equipe' ? (
                            <PainelInsights itens={itensFiltrados} usuarios={usuarios} />
                        ) : (
                            <div className="kanban-board">
                                <div className="kanban-column"><h3><i className="bi bi-list-ul"></i> A Fazer ({aFazer.length})</h3>{aFazer.map(item => <KanbanCard key={item.id} item={item} onClick={handleCardClick} onContextMenu={handleContextMenu} />)}</div>
                                <div className="kanban-column"><h3><i className="bi bi-hourglass-split"></i> Em Andamento ({emAndamento.length})</h3>{emAndamento.map(item => <KanbanCard key={item.id} item={item} onClick={handleCardClick} onContextMenu={handleContextMenu} />)}</div>
                                <div className="kanban-column"><h3><i className="bi bi-check2-circle"></i> Concluído ({concluido.length})</h3>{concluido.map(item => <KanbanCard key={item.id} item={item} onClick={handleCardClick} onContextMenu={handleContextMenu} />)}</div>
                                {showCanceled && (
                                    <div className="kanban-column canceled">
                                        <h3><i className="bi bi-x-circle-fill"></i> Cancelado ({cancelado.length})</h3>
                                        {cancelado.map(item => <KanbanCard key={item.id} item={item} onClick={handleCardClick} onContextMenu={handleContextMenu} />)}
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </main>
            </div>
            {contextMenu.visible && (
                <div className="context-menu-container" style={{ top: contextMenu.y, left: contextMenu.x }}>
                    <div className="context-menu-item delete" onClick={handleDeleteClick}>
                        <i className="bi bi-trash-fill"></i> Excluir Item
                    </div>
                </div>
            )}
            <ModalNovaTarefa isOpen={isTarefaModalOpen} onClose={() => setIsTarefaModalOpen(false)} usuarios={usuarios} onSaveSuccess={fetchData} />
            <ModalNovoPlanoDeAcao isOpen={isPlanoModalOpen} onClose={() => setIsPlanoModalOpen(false)} usuarios={usuarios} onSaveSuccess={fetchData} />
            
            <DetTarefas isOpen={!!itemSelecionado && itemSelecionado.tipo === 'Tarefa'} onClose={handleCloseDetailModal} tarefa={itemSelecionado} usuarios={usuarios} currentUser={currentUser} />
            <DetPlanoDeAcao isOpen={!!itemSelecionado && itemSelecionado.tipo === 'Plano de Ação'} onClose={handleCloseDetailModal} plano={itemSelecionado} usuarios={usuarios} currentUser={currentUser} />

            <ModalConfirmacao
                isOpen={!!itemParaExcluir}
                onClose={() => setItemParaExcluir(null)}
                onConfirm={handleDeleteConfirm}
                title="Confirmar Exclusão"
            >
                <p>Você tem certeza que deseja excluir o item <strong>"{itemParaExcluir?.titulo}"</strong>?</p>
                <p>Esta ação é irreversível e removerá todas as subtarefas e comentários associados.</p>
            </ModalConfirmacao>
            
            <ModalAlerta isOpen={alerta.aberto} onClose={() => setAlerta({ aberto: false, mensagem: '' })} title="Operação Concluída">
                <p>{alerta.mensagem}</p>
            </ModalAlerta>
        </>
    );
}

export default PaginaGestaoAcoes;
