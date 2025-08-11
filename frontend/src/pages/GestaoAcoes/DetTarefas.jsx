import React, { useState, useEffect, useRef, useMemo } from 'react';
import Modal from '../../components/Modal.jsx';
import Select from 'react-select';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';

const EMOJI_REACTIONS = ['👍', '👏', '❤️', '💡', '😂'];

const hasPermission = (user, permission) => {
    if (!user || !user.permissoes) return false;
    if (user.perfil_id === 'master_admin') return true;
    return user.permissoes.includes(permission);
};

// --- Componente para um item do Checklist ---
const ChecklistItem = ({ item, isEditing, editingText, canEdit, onUpdate, onRemove, onDoubleClick, onEditChange, onSave, isLastItem }) => {
    const inputRef = useRef(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
        }
    }, [isEditing]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            onSave();
        }
    };

    return (
        <div key={item.id} className="checklist-item">
            <input 
                type="checkbox" 
                checked={item.concluido === 1} 
                onChange={(e) => onUpdate(item.id, { concluido: e.target.checked ? 1 : 0 })} 
            />
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={editingText}
                    onChange={(e) => onEditChange(e.target.value)}
                    onBlur={onSave}
                    onKeyDown={handleKeyDown}
                    className="checklist-item-input"
                    maxLength="40"
                />
            ) : (
                <span 
                    className={item.concluido ? 'checklist-concluido' : 'checklist-pendente'}
                    onDoubleClick={onDoubleClick}
                >
                    {item.titulo}
                </span>
            )}
            {canEdit && <button onClick={onRemove} className="remove-item-btn" disabled={isLastItem}>&times;</button>}
        </div>
    );
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
                    {podeReagir && (
                        <div className="options-menu-item" onClick={() => setShowReactions(true)}>
                            <i className="bi bi-emoji-smile"></i> Reagir
                        </div>
                    )}
                    {podeModificar && (
                        <>
                            <div className="options-menu-item" onClick={onEdit}>
                                <i className="bi bi-pencil-square"></i> Editar
                            </div>
                            <div className="options-menu-item" onClick={onDelete}>
                                <i className="bi bi-trash"></i> Excluir
                            </div>
                        </>
                    )}
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
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuPosition(null);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [menuPosition]);

    const handleSaveEdit = () => {
        if (textoEditado.trim()) {
            onUpdate(item.id, textoEditado);
        }
        setEditando(false);
    };
    
    const handleOpenMenu = (e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuPosition({
            top: rect.bottom + 5,
            left: rect.left - 160,
        });
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
                {item.reacao && (
                    <div className="reaction-bubble" onClick={() => onReact(item.id, null)}>
                        {item.reacao}
                    </div>
                )}
                {(podeModificar || podeReagir) && (
                    <div className="message-action-trigger">
                        <i className="bi bi-three-dots-vertical" onClick={handleOpenMenu}></i>
                    </div>
                )}
            </div>
            {menuPosition && (
                <div ref={menuRef} className="floating-menu-wrapper" style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}>
                    <MessageOptionsMenu
                        podeModificar={podeModificar}
                        podeReagir={podeReagir}
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


const ChatComponent = ({ tarefaId, usuarioLogado }) => {
    const [chatHistory, setChatHistory] = useState([]);
    const [novoComentario, setNovoComentario] = useState('');
    const [mensagemParaExcluir, setMensagemParaExcluir] = useState(null);

    const fetchChat = async () => {
        if (!tarefaId) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/tarefas/${tarefaId}/chat`);
            const data = await response.json();
            setChatHistory(data);
        } catch (error) { console.error("Erro ao buscar chat:", error); }
    };

    useEffect(() => { fetchChat(); }, [tarefaId]);

    const handleEnviarComentario = async () => {
        if (!novoComentario.trim()) return;
        try {
            await fetch(`http://127.0.0.1:5000/api/tarefas/${tarefaId}/chat`, {
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
            const response = await fetch(`http://127.0.0.1:5000/api/tarefas/chat/mensagens/${msgId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
            const response = await fetch(`http://127.0.0.1:5000/api/tarefas/chat/mensagens/${mensagemParaExcluir}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error((await response.json()).message);
            fetchChat();
        } catch (error) { alert(error.message); }
        setMensagemParaExcluir(null);
    };

    const handleReactMensagem = async (msgId, reacao) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/tarefas/chat/mensagens/${msgId}/reacao`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reacao }) });
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
                            key={item.id} 
                            item={item} 
                            isLast={index === chatHistory.length - 1} 
                            usuarioLogado={usuarioLogado}
                            onUpdate={handleUpdateMensagem}
                            onDelete={setMensagemParaExcluir}
                            onReact={handleReactMensagem}
                        />
                    ))}
                </div>
                <div className="chat-input-mock">
                    <textarea placeholder="Adicionar um comentário..." value={novoComentario} onChange={(e) => setNovoComentario(e.target.value)}></textarea>
                    <button onClick={handleEnviarComentario}><i className="bi bi-send-fill"></i></button>
                </div>
            </div>
            <ModalConfirmacao
                isOpen={!!mensagemParaExcluir}
                onClose={() => setMensagemParaExcluir(null)}
                onConfirm={handleConfirmDeleteMensagem}
                title="Confirmar Exclusão"
            >
                <p>Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.</p>
            </ModalConfirmacao>
        </>
    );
};


function DetTarefas({ isOpen, onClose, tarefa, usuarios, currentUser }) {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [formState, setFormState] = useState(null);
    const [checklist, setChecklist] = useState([]);
    const [deletedChecklistIds, setDeletedChecklistIds] = useState([]);
    const [editingItemId, setEditingItemId] = useState(null);
    const [editingItemText, setEditingItemText] = useState('');
    const [criadorNome, setCriadorNome] = useState('');

    const [isEditingTitulo, setIsEditingTitulo] = useState(false);
    const [isEditingDescricao, setIsEditingDescricao] = useState(false);
    const [isEditingResponsaveis, setIsEditingResponsaveis] = useState(false);
    const [isEditingDataPrazo, setIsEditingDataPrazo] = useState(false);

    const fetchDetalhes = async () => {
        if (!tarefa) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/tarefas/${tarefa.id}`);
            if(!response.ok) throw new Error("Falha ao buscar detalhes da tarefa");
            const data = await response.json();
            
            setFormState({
                ...data,
                responsaveis: data.responsaveis.map(r => ({ value: r.id, label: r.nome, iniciais: r.iniciais }))
            });
            setChecklist(data.checklist || []);
            setDeletedChecklistIds([]);

            const criador = usuarios.find(u => u.id === data.criado_por_id);
            setCriadorNome(criador ? criador.nome : 'Desconhecido');

        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        if (isOpen && tarefa) {
            fetchDetalhes();
        }
    }, [isOpen, tarefa, usuarios]);

    // CORREÇÃO: Este useMemo agora calcula o status APENAS com base no checklist.
    const statusBaseadoEmChecklist = useMemo(() => {
        if (!checklist || checklist.length === 0) return 'A Fazer';
        const total = checklist.length;
        const concluidos = checklist.filter(item => item.concluido === 1).length;

        if (concluidos === 0) return 'A Fazer';
        if (concluidos === total) return 'Concluído';
        return 'Em Andamento';
    }, [checklist]);

    if (!isOpen || !formState) return null;

    const canEditFields = formState.criado_por_id === currentUser.id || hasPermission(currentUser, 'gestao_acoes_editar');

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSelectChange = (name, selectedOptions) => {
        setFormState(prev => ({ ...prev, [name]: selectedOptions }));
    };

    const handleAddChecklistItem = () => {
        const newItem = {
            id: `new_${Date.now()}`,
            titulo: '',
            concluido: 0,
            ordem: checklist.length
        };
        setChecklist(prev => [...prev, newItem]);
        setEditingItemId(newItem.id);
        setEditingItemText('');
    };

    const handleUpdateSubtarefaLocal = (id, data) => {
        setChecklist(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
    };
    
    const handleRemoveChecklistItem = (id) => {
        if (!canEditFields || checklist.length <= 1) return;
        if (!String(id).startsWith('new_')) {
            setDeletedChecklistIds(prev => [...prev, id]);
        }
        setChecklist(prev => prev.filter(item => item.id !== id));
    };
    
    const startEditingItem = (item) => {
        if (!canEditFields) return;
        setEditingItemId(item.id);
        setEditingItemText(item.titulo);
    };

    const saveItemEdit = () => {
        if (editingItemId) {
            handleUpdateSubtarefaLocal(editingItemId, { titulo: editingItemText });
            setEditingItemId(null);
            setEditingItemText('');
        }
    };
    
    const handleChecklistTextChange = (text) => {
        if (text.length <= 40) {
            setEditingItemText(text);
        }
    };

    const handleSaveChanges = async () => {
        const payload = {
            ...formState,
            status: formState.status,
            responsaveis: formState.responsaveis.map(r => r.value),
            checklist: checklist.map((item, index) => ({ ...item, ordem: index })),
            deleted_checklist_ids: deletedChecklistIds
        };

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/tarefas/${formState.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error((await response.json()).message);
            onClose();
        } catch (error) {
            console.error("Erro ao salvar alterações:", error);
            alert(`Erro: ${error.message}`);
        }
    };

    // CORREÇÃO: A função de cancelar agora usa o status calculado base para reverter.
    const handleToggleCancelTask = () => {
        const isCancelado = formState.status === 'Cancelado';
        const novoStatus = isCancelado ? statusBaseadoEmChecklist : 'Cancelado';
        setFormState(prev => ({ ...prev, status: novoStatus }));
    };

    const formatarData = (dataString) => {
        if (!dataString) return '';
        const [ano, mes, dia] = dataString.split('-');
        return `${dia}/${mes}/${ano}`;
    };

    const getPriorityClassName = (priority) => {
        if (!priority) return 'default';
        return priority.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };
    
    const formatarIdTarefa = (id) => `#${String(id).padStart(4, '0')}`;

    const modalTitle = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`priority-bubble ${getPriorityClassName(formState.prioridade)}`} title={`Prioridade: ${formState.prioridade}`}></span>
            {isEditingTitulo ? (
                <input 
                    type="text" 
                    value={formState.titulo} 
                    onChange={handleFormChange}
                    name="titulo"
                    className="modal-title-input"
                    onBlur={() => setIsEditingTitulo(false)}
                    autoFocus
                />
            ) : (
                <h3 onClick={() => canEditFields && setIsEditingTitulo(true)} className={canEditFields ? 'editable-title' : ''}>
                    {formatarIdTarefa(formState.id)}: {formState.titulo}
                    {canEditFields && <i className="bi bi-pencil-fill edit-icon-title"></i>}
                </h3>
            )}
            <span style={{ fontSize: '14px', color: '#5f6368', fontWeight: 'normal' }}>(Por: {criadorNome})</span>
        </div>
    );
    
    const calculateDeadlineInfo = () => {
        if (!formState.data_prazo || !formState.data_criacao) return { text: '', isNear: false };
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const prazo = new Date(formState.data_prazo);
        const criacao = new Date(formState.data_criacao);
        const diffTime = prazo.getTime() - hoje.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let text = '';
        if (diffDays < 0) {
            text = `Atrasado há ${Math.abs(diffDays)} dia(s)`;
        } else if (diffDays === 0) {
            text = 'Vence hoje';
        } else {
            text = `${diffDays} dia(s) faltantes`;
        }
        const totalTime = prazo.getTime() - criacao.getTime();
        const remainingTime = prazo.getTime() - hoje.getTime();
        const isNear = totalTime > 0 ? (remainingTime / totalTime) <= 0.1 : false;
        return { text, isNear: isNear || diffDays <= 0 };
    };

    const deadlineInfo = calculateDeadlineInfo();

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size={isChatOpen ? 'xl' : 'large'}>
            <div className={`gestao-acoes-modal-body ${isChatOpen ? 'chat-visible' : ''}`}>
                {isChatOpen && <ChatComponent tarefaId={tarefa.id} usuarioLogado={currentUser} />}
                <div className="form-column">
                    <div className="form-grid-layout" style={{ display: 'flex', gap: '20px' }}>
                        <div style={{ flex: 2 }}>
                            <div className="filter-group">
                                <label className={canEditFields ? 'editable-label' : ''} onClick={() => canEditFields && setIsEditingDescricao(true)}>
                                    Descrição {canEditFields && <i className="bi bi-pencil-fill edit-icon"></i>}
                                </label>
                                {isEditingDescricao ? (
                                    <textarea name="descricao" value={formState.descricao || ''} onChange={handleFormChange} onBlur={() => setIsEditingDescricao(false)} autoFocus />
                                ) : (
                                    <p className="description-box">{formState.descricao || "Nenhuma descrição fornecida."}</p>
                                )}
                            </div>
                            <div className="filter-group">
                                <div className="checklist-title-container">
                                    <h4>{formState.checklist_titulo || 'Sub-Tarefas'}</h4>
                                </div>
                                <div className="checklist-container">
                                    <div className="checklist-items-wrapper">
                                        {checklist.map(item => (
                                            <ChecklistItem
                                                key={item.id}
                                                item={item}
                                                canEdit={canEditFields}
                                                isEditing={editingItemId === item.id}
                                                editingText={editingItemId === item.id ? editingItemText : item.titulo}
                                                onDoubleClick={() => startEditingItem(item)}
                                                onEditChange={handleChecklistTextChange}
                                                onSave={saveItemEdit}
                                                onUpdate={(id, data) => handleUpdateSubtarefaLocal(id, data)}
                                                onRemove={() => handleRemoveChecklistItem(item.id)}
                                                isLastItem={checklist.length <= 1}
                                            />
                                        ))}
                                    </div>
                                    {canEditFields && <button onClick={handleAddChecklistItem} className="add-item-btn">+ Adicionar item</button>}
                                </div>
                            </div>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div className="filter-group">
                                <label className={canEditFields ? 'editable-label' : ''} onClick={() => canEditFields && setIsEditingResponsaveis(true)}>
                                    Responsáveis {canEditFields && <i className="bi bi-pencil-fill edit-icon"></i>}
                                </label>
                                {isEditingResponsaveis ? (
                                    <Select 
                                        isMulti 
                                        options={usuarios.map(u => ({ value: u.id, label: u.nome }))}
                                        value={formState.responsaveis}
                                        onChange={(opts) => handleSelectChange('responsaveis', opts)}
                                        onBlur={() => setIsEditingResponsaveis(false)}
                                        autoFocus
                                    />
                                ) : (
                                    <div className="card-assignees">
                                        {formState.responsaveis.map((resp, index) => (
                                            <span key={index} className="assignee-avatar" title={resp.label}>
                                                {resp.iniciais || resp.label.split(' ').map(n => n[0]).join('').substring(0,2)}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="filter-group">
                                <label className={canEditFields ? 'editable-label' : ''} onClick={() => canEditFields && setIsEditingDataPrazo(true)}>
                                    Data de Entrega {canEditFields && <i className="bi bi-pencil-fill edit-icon"></i>}
                                </label>
                                {isEditingDataPrazo ? (
                                    <input type="date" name="data_prazo" value={formState.data_prazo} onChange={handleFormChange} onBlur={() => setIsEditingDataPrazo(false)} autoFocus />
                                ) : (
                                    <>
                                        <div className="details-text">{formatarData(formState.data_prazo)}</div>
                                        <small className={`deadline-text ${deadlineInfo.isNear ? 'deadline-warning' : ''}`}>{deadlineInfo.text}</small>
                                    </>
                                )}
                            </div>
                             <div className="filter-group">
                                <label>Status:</label>
                                <div className="details-text status-display">{formState.status === 'Cancelado' ? 'Cancelado' : statusBaseadoEmChecklist}</div>
                            </div>
                            <div className="filter-group">
                                <label className="checkbox-label-group">
                                    <input 
                                        type="checkbox" 
                                        checked={formState.status === 'Cancelado'}
                                        onChange={handleToggleCancelTask}
                                        disabled={!canEditFields}
                                    />
                                    <span>Cancelar Tarefa</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-footer">
                <button type="button" className="modal-button-icon" onClick={() => setIsChatOpen(!isChatOpen)}><i className="bi bi-chat-left-text-fill"></i> Comentários</button>
                <div>
                    <button type="button" className="modal-button cancel" onClick={onClose}>Fechar</button>
                    {canEditFields && <button type="button" className="modal-button confirm" onClick={handleSaveChanges}>Salvar Alterações</button>}
                </div>
            </div>
        </Modal>
    );
}

export default DetTarefas;
