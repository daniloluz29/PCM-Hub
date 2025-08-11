import React, { useState, useEffect } from 'react';
import Modal from '../components/Modal.jsx';
import Select from 'react-select';
import ModalDetalheChamado from './Chamados/DetalheChamado.jsx';
import ModalAlerta from '../components/ModalAlerta.jsx';
import ModalConfirmacao from '../components/ModalConfirmacao.jsx'; // Importar o Modal de Confirmação

const categoriasChamado = ["Hardware", "Software", "Acesso e Permissões", "Suprimentos", "Manutenção Predial"].map(c => ({ value: c, label: c }));
const prioridadesChamado = ["Baixa", "Média", "Alta", "Crítica"].map(p => ({ value: p, label: p }));

const hasPermission = (user, permission) => {
    if (!user || !user.permissoes) return false;
    if (user.perfil_id === 'master_admin') return true;
    return user.permissoes.includes(permission);
};

const FormularioNovoChamado = ({ onClose, onChamadoCriado, usuarios, usuarioLogado }) => {
    const [formState, setFormState] = useState({
        titulo: '', descricao: '', categoria: null, prioridade: null,
        responsavel_id: null, solicitante_id: usuarioLogado.id
    });
    const [error, setError] = useState('');
    const optionsUsuarios = usuarios.map(u => ({ value: u.id, label: u.nome }));

    const handleSelectChange = (name, option) => setFormState(prev => ({ ...prev, [name]: option ? option.value : null }));
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formState.titulo || !formState.categoria || !formState.prioridade || !formState.responsavel_id) {
            setError('Por favor, preencha todos os campos obrigatórios.');
            return;
        }
        setError('');
        try {
            const response = await fetch('http://127.0.0.1:5000/api/chamados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formState)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            onChamadoCriado(result.message);
            onClose();
        } catch (err) {
            setError(`Erro ao criar chamado: ${err.message}`);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="user-form-grid">
                <div className="filter-group"><label>Categoria:*</label><Select options={categoriasChamado} onChange={(opt) => handleSelectChange('categoria', opt)} placeholder="Selecione..." /></div>
                <div className="filter-group"><label>Prioridade:*</label><Select options={prioridadesChamado} onChange={(opt) => handleSelectChange('prioridade', opt)} placeholder="Selecione..." /></div>
            </div>
            <div className="filter-group"><label>Atribuir a (Responsável):*</label><Select options={optionsUsuarios} onChange={(opt) => handleSelectChange('responsavel_id', opt)} placeholder="Selecione um responsável..." /></div>
            <div className="filter-group"><label>Título (Assunto):*</label><input type="text" name="titulo" value={formState.titulo} onChange={handleInputChange} /></div>
            <div className="filter-group"><label>Descrição Detalhada:</label><textarea name="descricao" value={formState.descricao} onChange={handleInputChange} rows="4"></textarea></div>
            {error && <p className="error-message" style={{textAlign: 'center'}}>{error}</p>}
            <div className="modal-footer" style={{borderTop: 'none', paddingTop: '15px'}}>
                <button type="button" className="modal-button cancel" onClick={onClose}>Cancelar</button>
                <button type="submit" className="modal-button confirm" style={{backgroundColor: '#007bff'}}>Enviar Solicitação</button>
            </div>
        </form>
    );
};

function PaginaPortalChamados({ currentUser }) {
    const [chamados, setChamados] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [abaAtiva, setAbaAtiva] = useState('minhas_solicitacoes');
    const [modalNovoChamadoAberto, setModalNovoChamadoAberto] = useState(false);
    const [chamadoSelecionado, setChamadoSelecionado] = useState(null);
    const [alerta, setAlerta] = useState({ aberto: false, mensagem: '' });
    
    // NOVOS ESTADOS: Para o menu de contexto e exclusão
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, chamado: null });
    const [chamadoParaExcluir, setChamadoParaExcluir] = useState(null);

    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [chamadosRes, usuariosRes] = await Promise.all([
                fetch('http://127.0.0.1:5000/api/chamados'),
                fetch('http://127.0.0.1:5000/api/usuarios')
            ]);
            if (!chamadosRes.ok) throw new Error('Falha ao buscar chamados.');
            if (!usuariosRes.ok) throw new Error('Falha ao buscar usuários.');
            const chamadosData = await chamadosRes.json();
            const usuariosData = await usuariosRes.json();
            setChamados(chamadosData);
            setUsuarios(usuariosData.filter(u => u.ativo));
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Adiciona um listener para fechar o menu de contexto ao clicar em qualquer lugar
        const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, chamado: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    const handleDataChange = (mensagem) => {
        fetchData();
        setAlerta({ aberto: true, mensagem: mensagem });
    };

    // NOVA FUNÇÃO: Lida com o clique direito na linha da tabela
    const handleContextMenu = (event, chamado) => {
        event.preventDefault();
        // Verifica se o usuário tem permissão para excluir
        if (hasPermission(currentUser, 'chamados_excluir')) {
            setContextMenu({ visible: true, x: event.pageX, y: event.pageY, chamado });
        }
    };

    // NOVA FUNÇÃO: Inicia o processo de exclusão a partir do menu
    const handleDeleteClick = () => {
        setChamadoParaExcluir(contextMenu.chamado);
        setContextMenu({ visible: false, x: 0, y: 0, chamado: null });
    };

    // NOVA FUNÇÃO: Confirma e executa a exclusão
    const handleDeleteConfirm = async () => {
        if (!chamadoParaExcluir) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/chamados/${chamadoParaExcluir.id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            handleDataChange(result.message); // Recarrega os dados e mostra o alerta
        } catch (err) {
            setAlerta({ aberto: true, mensagem: `Erro: ${err.message}` });
        }
        setChamadoParaExcluir(null); // Fecha o modal de confirmação
    };

    const getStatusClassName = (status) => status ? status.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-') : 'default';
    const getPriorityClassName = (priority) => priority ? priority.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '-') : 'default';
    
    const renderTabelaChamados = (dados) => {
        if (isLoading) return <p>A carregar chamados...</p>;
        if (error) return <p className="error-message">{error}</p>;
        if (dados.length === 0) return <p>Nenhum chamado encontrado nesta visualização.</p>;

        return (
            <table className="ticket-list-table">
                <thead>
                    <tr>
                        <th>ID do Chamado</th>
                        <th>Status</th>
                        <th>{abaAtiva === 'minhas_solicitacoes' ? 'Responsável' : 'Solicitante'}</th>
                        <th>Data de Abertura</th>
                    </tr>
                </thead>
                <tbody>
                    {dados.map(chamado => (
                        <tr 
                            key={chamado.id} 
                            onClick={() => setChamadoSelecionado(chamado)}
                            onContextMenu={(e) => handleContextMenu(e, chamado)} // Adiciona o evento de clique direito
                        >
                            <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span className={`priority-bubble ${getPriorityClassName(chamado.prioridade)}`} title={`Prioridade: ${chamado.prioridade}`}></span>
                                    <div>
                                        <strong>#{String(chamado.id).padStart(4, '0')}</strong>
                                        <br/>
                                        <small>{chamado.titulo}</small>
                                    </div>
                                </div>
                            </td>
                            <td><span className={`status-badge status-${getStatusClassName(chamado.status)}`}>{chamado.status}</span></td>
                            <td>{abaAtiva === 'minhas_solicitacoes' ? (chamado.responsavel_nome || 'Não atribuído') : chamado.solicitante_nome}</td>
                            <td>{new Date(chamado.data_abertura).toLocaleString('pt-BR')}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    const minhasSolicitacoes = chamados.filter(c => c.solicitante_id === currentUser.id);
    const minhaFila = chamados.filter(c => c.responsavel_id === currentUser.id);
    const todosChamados = chamados;
    let dadosParaExibir = [];
    if (abaAtiva === 'minhas_solicitacoes') dadosParaExibir = minhasSolicitacoes;
    else if (abaAtiva === 'fila_atendimento') dadosParaExibir = minhaFila;
    else if (abaAtiva === 'todos_chamados') dadosParaExibir = todosChamados;
    
    return (
        <>
            <div className="page-container">
                <main className="content-area" style={{marginLeft: '2rem'}}>
                    <div className="page-header"><h1>Portal de Chamados</h1><p>Abra e acompanhe suas solicitações de TI e manutenção.</p></div>
                    {hasPermission(currentUser, 'chamados_cadastrar') && (
                        <div className="admin-actions-bar" style={{justifyContent: 'flex-start'}}>
                            <button className="admin-button" onClick={() => setModalNovoChamadoAberto(true)}><i className="bi bi-plus-circle-fill"></i> Iniciar Solicitação</button>
                        </div>
                    )}
                    <div className="tabs-container">
                        <button className={`tab-item ${abaAtiva === 'minhas_solicitacoes' ? 'active' : ''}`} onClick={() => setAbaAtiva('minhas_solicitacoes')}>Minhas Solicitações</button>
                        <button className={`tab-item ${abaAtiva === 'fila_atendimento' ? 'active' : ''}`} onClick={() => setAbaAtiva('fila_atendimento')}>Minha Fila de Atendimento</button>
                        {hasPermission(currentUser, 'chamados_ver_tudo') && (<button className={`tab-item ${abaAtiva === 'todos_chamados' ? 'active' : ''}`} onClick={() => setAbaAtiva('todos_chamados')}>Todos os Chamados</button>)}
                    </div>
                    <div className="tab-content"><div className="card">{renderTabelaChamados(dadosParaExibir)}</div></div>
                </main>
            </div>

            {/* NOVO COMPONENTE: Menu de Contexto */}
            {contextMenu.visible && (
                <div className="context-menu-container" style={{ top: contextMenu.y, left: contextMenu.x }}>
                    <div className="context-menu-item delete" onClick={handleDeleteClick}>
                        <i className="bi bi-trash-fill"></i> Excluir Chamado
                    </div>
                </div>
            )}

            <Modal isOpen={modalNovoChamadoAberto} onClose={() => setModalNovoChamadoAberto(false)} title="Abrir Nova Solicitação">
                <FormularioNovoChamado 
                    onClose={() => setModalNovoChamadoAberto(false)} 
                    onChamadoCriado={handleDataChange} 
                    usuarios={usuarios}
                    usuarioLogado={currentUser}
                />
            </Modal>
            <ModalDetalheChamado 
                isOpen={!!chamadoSelecionado} 
                onClose={() => setChamadoSelecionado(null)} 
                chamado={chamadoSelecionado} 
                onChamadoAtualizado={handleDataChange} 
                usuarioLogado={currentUser}
            />
            <ModalAlerta isOpen={alerta.aberto} onClose={() => setAlerta({ aberto: false, mensagem: '' })} title="Operação Realizada"><p>{alerta.mensagem}</p></ModalAlerta>
            
            {/* NOVO COMPONENTE: Modal de Confirmação para Exclusão */}
            <ModalConfirmacao
                isOpen={!!chamadoParaExcluir}
                onClose={() => setChamadoParaExcluir(null)}
                onConfirm={handleDeleteConfirm}
                title="Confirmar Exclusão"
            >
                <p>Você tem certeza que deseja excluir o chamado <strong>#{String(chamadoParaExcluir?.id).padStart(4, '0')}</strong>?</p>
                <p>Esta ação é irreversível e removerá todos os comentários e anexos associados.</p>
            </ModalConfirmacao>
        </>
    );
}

export default PaginaPortalChamados;
