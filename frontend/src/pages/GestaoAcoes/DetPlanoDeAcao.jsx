import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from '../../components/Modal.jsx';
import Select from 'react-select';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';

const EMOJI_REACTIONS = ['👍', '👏', '❤️', '💡', '😂'];

const hasPermission = (user, permission) => {
    if (!user || !user.permissoes) return false;
    if (user.perfil_id === 'master_admin') return true;
    return user.permissoes.includes(permission);
};

// --- Componentes de Chat ---
const MessageOptionsMenu = ({ podeModificar, onEdit, onDelete, onReact, onClose, podeReagir }) => {
    const [showReactions, setShowReactions] = useState(false);
    return (
        <div className="options-menu-container" onClick={(e) => e.stopPropagation()}>
            {showReactions ? (
                <div className="options-menu-section reactions">
                    {EMOJI_REACTIONS.map(emoji => (
                        <span key={emoji} className="emoji-reaction" onClick={() => { onReact(emoji); onClose(); }}>{emoji}</span>
                    ))}
                </div>
            ) : (
                <div className="options-menu-section">
                    {podeReagir && (<div className="options-menu-item" onClick={() => setShowReactions(true)}><i className="bi bi-emoji-smile"></i> Reagir</div>)}
                    {podeModificar && (<>
                        <div className="options-menu-item" onClick={onEdit}><i className="bi bi-pencil-square"></i> Editar</div>
                        <div className="options-menu-item" onClick={onDelete}><i className="bi bi-trash"></i> Excluir</div>
                    </>)}
                </div>
            )}
        </div>
    );
};

const ChatItem = ({ item, isLast, usuarioLogado, onUpdate, onDelete, onReact }) => {
    const [menuPosition, setMenuPosition] = useState(null);
    const [editando, setEditando] = useState(false);
    const [textoEditado, setTextoEditado] = useState(item.conteudo);
    const menuRef = useRef(null);
    const podeModificar = (isLast && item.usuario_id === usuarioLogado.id) || hasPermission(usuarioLogado, 'gestao_acoes_chat_excluir');
    const podeReagir = item.usuario_id !== usuarioLogado.id;

    useEffect(() => {
        if (!menuPosition) return;
        const handleOutsideClick = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) setMenuPosition(null);
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [menuPosition]);

    const handleSaveEdit = () => {
        if (textoEditado.trim()) onUpdate(item.id, textoEditado);
        setEditando(false);
    };
    
    const handleOpenMenu = (e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuPosition({ top: rect.bottom + 5, left: rect.left - 160 });
    };

    if (editando) {
        return (
            <div className="history-item-edit-mode">
                <textarea value={textoEditado} onChange={(e) => setTextoEditado(e.target.value)} autoFocus />
                <div className="edit-actions">
                    <button onClick={() => setEditando(false)}>Cancelar</button>
                    <button onClick={handleSaveEdit}>Salvar</button>
                </div>
            </div>
        );
    }

    return (
        <div className={`history-item ${item.usuario_id === usuarioLogado.id ? 'sent' : 'received'}`}>
            <div className="history-item-content">
                <div className="history-item-header">
                    <span>{item.usuario_nome}</span>
                    <small>{new Date(item.data_hora).toLocaleString('pt-BR')}</small>
                </div>
                <p className="history-item-body">{item.conteudo}</p>
                {item.reacao && (<div className="reaction-bubble" onClick={() => onReact(item.id, null)}>{item.reacao}</div>)}
                {(podeModificar || podeReagir) && (<div className="message-action-trigger"><i className="bi bi-three-dots-vertical" onClick={handleOpenMenu}></i></div>)}
            </div>
            {menuPosition && (
                <div ref={menuRef} className="floating-menu-wrapper" style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}>
                    <MessageOptionsMenu
                        podeModificar={podeModificar} podeReagir={podeReagir}
                        onEdit={() => { setEditando(true); setMenuPosition(null); }}
                        onDelete={() => { onDelete(item.id); setMenuPosition(null); }}
                        onReact={(emoji) => { onReact(item.id, emoji); setMenuPosition(null); }}
                        onClose={() => setMenuPosition(null)}
                    />
                </div>
            )}
        </div>
    );
};

const ChatComponent = ({ planoId, usuarioLogado }) => {
    const [chatHistory, setChatHistory] = useState([]);
    const [novoComentario, setNovoComentario] = useState('');
    const [mensagemParaExcluir, setMensagemParaExcluir] = useState(null);

    const fetchChat = async () => {
        if (!planoId) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/planos-acao/${planoId}/chat`);
            const data = await response.json();
            setChatHistory(data);
        } catch (error) { console.error("Erro ao buscar chat:", error); }
    };

    useEffect(() => { fetchChat(); }, [planoId]);

    const handleEnviarComentario = async () => {
        if (!novoComentario.trim()) return;
        try {
            await fetch(`http://127.0.0.1:5000/api/planos-acao/${planoId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conteudo: novoComentario, usuario_id: usuarioLogado.id })
            });
            setNovoComentario('');
            fetchChat();
        } catch (error) { console.error("Erro ao enviar comentário:", error); }
    };
    
    const handleUpdateMensagem = async (msgId, novoConteudo) => {
        // ATUALIZADO: Envia as permissões do usuário no payload
        const payload = { 
            conteudo: novoConteudo, 
            usuario_id_sessao: usuarioLogado.id,
            permissoes: usuarioLogado.permissoes
        };
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/planos-acao/chat/mensagens/${msgId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error((await response.json()).message);
            fetchChat();
        } catch (error) { alert(error.message); }
    };

    const handleConfirmDeleteMensagem = async () => {
        // ATUALIZADO: Envia as permissões do usuário no payload
        const payload = { 
            usuario_id_sessao: usuarioLogado.id,
            permissoes: usuarioLogado.permissoes
        };
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/planos-acao/chat/mensagens/${mensagemParaExcluir}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error((await response.json()).message);
            fetchChat();
        } catch (error) { alert(error.message); }
        setMensagemParaExcluir(null);
    };

    const handleReactMensagem = async (msgId, reacao) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/planos-acao/chat/mensagens/${msgId}/reacao`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reacao }) });
            if (!response.ok) throw new Error((await response.json()).message);
            fetchChat();
        } catch (error) { console.error(error.message); }
    };

    return (
        <>
            <div className="side-chat-panel">
                <h4>Comentários</h4>
                <div className="chat-history-mock">
                    {chatHistory.map((item, index) => (
                        <ChatItem 
                            key={item.id} item={item} isLast={index === chatHistory.length - 1} 
                            usuarioLogado={usuarioLogado} onUpdate={handleUpdateMensagem}
                            onDelete={setMensagemParaExcluir} onReact={handleReactMensagem}
                        />
                    ))}
                </div>
                <div className="chat-input-mock">
                    <textarea placeholder="Adicionar um comentário..." value={novoComentario} onChange={(e) => setNovoComentario(e.target.value)}></textarea>
                    <button onClick={handleEnviarComentario}><i className="bi bi-send-fill"></i></button>
                </div>
            </div>
            <ModalConfirmacao
                isOpen={!!mensagemParaExcluir} onClose={() => setMensagemParaExcluir(null)}
                onConfirm={handleConfirmDeleteMensagem} title="Confirmar Exclusão"
            >
                <p>Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.</p>
            </ModalConfirmacao>
        </>
    );
};

const TabelaEdicao = ({ objetivos, setObjetivos, usuarios }) => {
    const prioridadeOptions = [ { value: 'Alta', label: 'Alta' }, { value: 'Média', label: 'Média' }, { value: 'Baixa', label: 'Baixa' }];
    const optionsUsuarios = usuarios.map(u => ({ value: u.id, label: u.nome }));

    const compactSelectStyles = {
        control: (provided) => ({ ...provided, minHeight: '38px', height: '38px', fontSize: '14px' }),
        valueContainer: (provided) => ({ ...provided, height: '38px', padding: '0 8px' }),
        input: (provided) => ({ ...provided, margin: '0px' }),
        indicatorsContainer: (provided) => ({ ...provided, height: '38px' }),
        singleValue: (provided) => ({ ...provided, fontSize: '14px' }),
        placeholder: (provided) => ({ ...provided, fontSize: '14px' }),
    };
    
    const handleFieldChange = (objId, tarefaId, field, value) => {
        setObjetivos(objetivos.map(obj => {
            if (obj.id === objId) {
                if (!tarefaId) return { ...obj, [field]: value };
                const novasTarefas = obj.tarefas.map(t => t.id === tarefaId ? { ...t, [field]: value } : t);
                return { ...obj, tarefas: novasTarefas };
            }
            return obj;
        }));
    };

    const handleAddObjetivo = () => setObjetivos([...objetivos, { id: `new_${Date.now()}`, titulo: 'Novo Objetivo', tarefas: [] }]);
    const handleAddTarefa = (objId) => {
        setObjetivos(objetivos.map(obj => 
            obj.id === objId 
            ? { ...obj, tarefas: [...obj.tarefas, { id: `new_${Date.now()}`, titulo: 'Nova Tarefa', data_inicio: '', data_prazo: '', concluido: 0 }] } 
            : obj
        ));
    };
    
    return (
        <div className="plano-acao-table-wrapper">
            <table className="plano-acao-table">
                <thead>
                    <tr>
                        <th>Ação</th><th>Responsável</th><th>Prioridade</th><th>Começo</th><th>Prazo</th><th>Comentários</th>
                    </tr>
                </thead>
                <tbody>
                    {objetivos.map(obj => (
                        <React.Fragment key={obj.id}>
                            <tr className="objetivo-row editable">
                                <td colSpan="6">
                                    <i className="bi bi-bullseye"></i> 
                                    <input type="text" value={obj.titulo} onChange={(e) => handleFieldChange(obj.id, null, 'titulo', e.target.value)} />
                                </td>
                            </tr>
                            {obj.tarefas.map(tarefa => (
                                <tr key={tarefa.id} className="tarefa-row editable">
                                    <td className="tarefa-cell"><input type="text" value={tarefa.titulo} onChange={(e) => handleFieldChange(obj.id, tarefa.id, 'titulo', e.target.value)} /></td>
                                    <td><Select styles={compactSelectStyles} options={optionsUsuarios} value={optionsUsuarios.find(u => u.value === tarefa.responsavel_id)} onChange={(opt) => handleFieldChange(obj.id, tarefa.id, 'responsavel_id', opt ? opt.value : null)} /></td>
                                    <td><Select styles={compactSelectStyles} options={prioridadeOptions} value={prioridadeOptions.find(p => p.value === tarefa.prioridade)} onChange={(opt) => handleFieldChange(obj.id, tarefa.id, 'prioridade', opt ? opt.value : null)} /></td>
                                    <td><input type="date" value={tarefa.data_inicio || ''} onChange={(e) => handleFieldChange(obj.id, tarefa.id, 'data_inicio', e.target.value)} /></td>
                                    <td><input type="date" value={tarefa.data_prazo || ''} onChange={(e) => handleFieldChange(obj.id, tarefa.id, 'data_prazo', e.target.value)} /></td>
                                    <td><input type="text" value={tarefa.comentarios || ''} onChange={(e) => handleFieldChange(obj.id, tarefa.id, 'comentarios', e.target.value)} /></td>
                                </tr>
                            ))}
                             <tr><td colSpan="6" className="add-tarefa-cell"><button onClick={() => handleAddTarefa(obj.id)} className="add-item-btn">+ Adicionar Tarefa</button></td></tr>
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
            <button onClick={handleAddObjetivo} className="add-objetivo-btn">+ Adicionar Objetivo</button>
        </div>
    );
};

const TabelaDetalhes = ({ objetivos, usuarios, onContextMenu }) => {
    const formatarDataTabela = (dataString) => {
        if (!dataString) return '';
        const [ano, mes, dia] = dataString.split('-');
        return `${dia}/${mes}/${ano}`;
    };

    return (
        <div className="plano-acao-table-wrapper">
            <table className="plano-acao-table">
                <thead>
                    <tr>
                        <th>Ação</th><th>Responsável</th><th>Prioridade</th><th>Começo</th><th>Prazo</th><th>Comentários</th>
                    </tr>
                </thead>
                <tbody>
                    {objetivos.map(obj => {
                        const isObjConcluido = obj.tarefas.length > 0 && obj.tarefas.every(t => t.concluido === 1);
                        return (
                            <React.Fragment key={obj.id}>
                                <tr className={`objetivo-row ${isObjConcluido ? 'concluida' : ''}`}>
                                    <td colSpan="6"><i className="bi bi-bullseye"></i> {obj.titulo}</td>
                                </tr>
                                {obj.tarefas.map(tarefa => (
                                    <tr 
                                        key={tarefa.id} 
                                        className={`tarefa-row ${tarefa.concluido ? 'concluida' : ''}`}
                                        onContextMenu={(e) => onContextMenu(e, tarefa)}
                                    >
                                        <td className="tarefa-cell">{tarefa.titulo}</td>
                                        <td>{tarefa.responsavel_nome || '-'}</td>
                                        <td>{tarefa.prioridade || '-'}</td>
                                        <td>{formatarDataTabela(tarefa.data_inicio)}</td>
                                        <td>{formatarDataTabela(tarefa.data_prazo)}</td>
                                        <td>{tarefa.comentarios || '-'}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
};

function DetPlanoDeAcao({ isOpen, onClose, plano, usuarios, currentUser }) {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [planoDetalhes, setPlanoDetalhes] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedObjetivos, setEditedObjetivos] = useState([]);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, item: null });
    const [criadorNome, setCriadorNome] = useState('');

    const fetchDetalhes = async () => {
        if (!plano) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/planos-acao/${plano.id}`);
            if (!response.ok) throw new Error("Falha ao buscar detalhes do plano.");
            const data = await response.json();
            setPlanoDetalhes(data);
            setEditedObjetivos(JSON.parse(JSON.stringify(data.objetivos || [])));

            const criador = usuarios.find(u => u.id === data.criado_por_id);
            setCriadorNome(criador ? criador.nome : 'Desconhecido');
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        if (isOpen && plano) {
            fetchDetalhes();
        } else {
            setIsEditing(false);
        }
    }, [isOpen, plano, usuarios]);

    const statusCalculado = useMemo(() => {
        if (!planoDetalhes || !planoDetalhes.objetivos) return 'A Fazer';
        const todasAsTarefas = planoDetalhes.objetivos.flatMap(obj => obj.tarefas);
        if (todasAsTarefas.length === 0) return 'A Fazer';

        const total = todasAsTarefas.length;
        const concluidas = todasAsTarefas.filter(t => t.concluido === 1).length;

        if (concluidas === 0) return 'A Fazer';
        if (concluidas === total) return 'Concluído';
        return 'Em Andamento';
    }, [planoDetalhes]);

    useEffect(() => {
        const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, item: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);


    const deadlineInfo = useMemo(() => {
        if (!planoDetalhes?.data_prazo || !planoDetalhes?.data_criacao) return { text: '', isNear: false };
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const prazo = new Date(planoDetalhes.data_prazo);
        const criacao = new Date(planoDetalhes.data_criacao);
        const diffTime = prazo.getTime() - hoje.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let text = '';
        if (diffDays < 0) text = `Atrasado há ${Math.abs(diffDays)} dia(s)`;
        else if (diffDays === 0) text = 'Vence hoje';
        else text = `${diffDays} dia(s) faltantes`;
        const totalTime = prazo.getTime() - criacao.getTime();
        const remainingTime = prazo.getTime() - hoje.getTime();
        const isNear = totalTime > 0 ? (remainingTime / totalTime) <= 0.1 : false;
        return { text, isNear: isNear || diffDays <= 0 };
    }, [planoDetalhes]);

    if (!isOpen || !planoDetalhes) return null;

    const canEditPlan = planoDetalhes.criado_por_id === currentUser.id || hasPermission(currentUser, 'gestao_acoes_editar');

    const handleContextMenu = (event, item) => {
        event.preventDefault();
        setContextMenu({ visible: true, x: event.pageX, y: event.pageY, item });
    };

    const handleToggleConcluido = async () => {
        const item = contextMenu.item;
        if (!item) return;

        setContextMenu({ visible: false, x: 0, y: 0, item: null });

        const novoStatus = item.concluido === 1 ? 0 : 1;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/subtarefas/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ concluido: novoStatus })
            });
            if (!response.ok) throw new Error('Falha ao atualizar status da tarefa.');
            fetchDetalhes();
        } catch (error) {
            console.error(error);
        }
    };

    const handleSaveChanges = async () => {
        const payload = {
            objetivos: editedObjetivos,
            status: planoDetalhes.status
        };
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/planos-acao/${planoDetalhes.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error((await response.json()).message);
            setIsEditing(false);
            fetchDetalhes();
        } catch (error) {
            console.error("Erro ao salvar alterações:", error);
            alert(`Erro: ${error.message}`);
        }
    };
    
    const handleToggleCancelPlan = () => {
        const isCancelado = planoDetalhes.status === 'Cancelado';
        const novoStatus = isCancelado ? statusCalculado : 'Cancelado';
        setPlanoDetalhes(prev => ({...prev, status: novoStatus}));
    };

    const formatarData = (dataString) => {
        if (!dataString) return '';
        const datePart = dataString.split(' ')[0];
        const [ano, mes, dia] = datePart.split('-');
        return `${dia}/${mes}/${ano}`;
    };

    const getPriorityClassName = (priority) => (priority || 'default').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const formatarId = (id) => `#${String(id).padStart(4, '0')}`;

    const modalTitle = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`priority-bubble ${getPriorityClassName(planoDetalhes.prioridade)}`} title={`Prioridade: ${planoDetalhes.prioridade}`}></span>
            <h3>{formatarId(planoDetalhes.id)}: {planoDetalhes.titulo}</h3>
            <span style={{ fontSize: '14px', color: '#5f6368', fontWeight: 'normal' }}>(Por: {criadorNome})</span>
        </div>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size={isChatOpen ? 'xl' : 'large'}>
            <div className={`gestao-acoes-modal-body ${isChatOpen ? 'chat-visible' : ''}`}>
                {isChatOpen && <ChatComponent planoId={plano.id} usuarioLogado={currentUser} />}
                <div className="form-column">
                    <div className="details-summary with-actions">
                        <div className="summary-dates">
                            <div className="filter-group">
                                <label>Início:</label>
                                <div className="details-text">{formatarData(planoDetalhes.data_criacao)}</div>
                            </div>
                            <div className="filter-group">
                                <label>Fim:</label>
                                <div className={`details-text ${deadlineInfo.isNear ? 'deadline-warning' : ''}`}>{formatarData(planoDetalhes.data_prazo)}</div>
                                <small className={`deadline-text ${deadlineInfo.isNear ? 'deadline-warning' : ''}`}>{deadlineInfo.text}</small>
                            </div>
                             <div className="filter-group">
                                <label>Status:</label>
                                <div className="details-text status-display">{planoDetalhes.status === 'Cancelado' ? 'Cancelado' : statusCalculado}</div>
                            </div>
                        </div>
                        <div className="summary-actions">
                            {/* CORREÇÃO: Botão de editar e checkbox de cancelar agora aparecem juntos */}
                            {isEditing && canEditPlan && (
                                <label className="checkbox-label-group">
                                    <input 
                                        type="checkbox" 
                                        checked={planoDetalhes.status === 'Cancelado'}
                                        onChange={handleToggleCancelPlan}
                                    />
                                    <span>Cancelar Plano</span>
                                </label>
                            )}
                            {!isEditing && canEditPlan && (
                                <button className="edit-plan-btn" onClick={() => setIsEditing(true)}>
                                    <i className="bi bi-pencil-fill"></i> Editar Plano
                                </button>
                            )}
                        </div>
                    </div>

                    {isEditing ? (
                        <TabelaEdicao objetivos={editedObjetivos} setObjetivos={setEditedObjetivos} usuarios={usuarios} />
                    ) : (
                        <TabelaDetalhes 
                            objetivos={planoDetalhes.objetivos || []} 
                            usuarios={usuarios}
                            onContextMenu={handleContextMenu}
                        />
                    )}
                </div>
            </div>
            {contextMenu.visible && (
                <div className="context-menu-container" style={{ top: contextMenu.y, left: contextMenu.x }}>
                    <div className="context-menu-item" onClick={handleToggleConcluido}>
                        {contextMenu.item?.concluido === 1 ? (
                            <><i className="bi bi-x-circle"></i> Desfazer Conclusão</>
                        ) : (
                            <><i className="bi bi-check-circle"></i> Concluir Tarefa</>
                        )}
                    </div>
                </div>
            )}
            <div className="modal-footer">
                <button type="button" className="modal-button-icon" onClick={() => setIsChatOpen(!isChatOpen)}><i className="bi bi-chat-left-text-fill"></i> Comentários</button>
                <div>
                    {isEditing ? (
                        <>
                            <button type="button" className="modal-button cancel" onClick={() => setIsEditing(false)}>Cancelar Edição</button>
                            <button type="button" className="modal-button confirm" onClick={handleSaveChanges}>Salvar Alterações</button>
                        </>
                    ) : (
                        <button type="button" className="modal-button cancel" onClick={onClose}>Fechar</button>
                    )}
                </div>
            </div>
        </Modal>
    );
}

export default DetPlanoDeAcao;
