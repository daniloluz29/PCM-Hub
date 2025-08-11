import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';

const statusOptions = [
    { value: 'Pendente', label: 'Pendente' },
    { value: 'Em Andamento', label: 'Em Andamento' },
    { value: 'Aguardando Terceiro', label: 'Aguardando Terceiro' },
    { value: 'Concluído', label: 'Concluído' },
    { value: 'Cancelado', label: 'Cancelado' }
];
const categoriasChamado = ["Hardware", "Software", "Acesso e Permissões", "Suprimentos", "Manutenção Predial"].map(c => ({ value: c, label: c }));
const EMOJI_REACTIONS = ['👍', '👏', '❤️', '💡', '😂'];
const MAX_CHARS = 400;

/**
 * Helper function to check user permissions.
 * @param {object} user - The current user object.
 * @param {string} permission - The permission string to check for.
 * @returns {boolean} - True if the user has the permission.
 */
const hasPermission = (user, permission) => {
    if (!user || !user.permissoes) {
        return false;
    }
    if (user.perfil_id === 'master_admin') {
        return true;
    }
    return user.permissoes.includes(permission);
};


// --- Componente do Painel de Anexos ---
const AnexosPanel = ({ chamadoId, onAnexoChange, usuarioLogado }) => {
    const [anexos, setAnexos] = useState([]);
    const [isDragging, setIsDragging] = useState(false);

    // CORREÇÃO: Usando o ID de permissão correto do arquivo CSV
    const canDeleteAnexos = hasPermission(usuarioLogado, 'chamados_anexos_excluir');

    const fetchAnexos = async () => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/chamados/${chamadoId}/anexos`);
            const data = await response.json();
            setAnexos(data);
        } catch (error) {
            console.error("Erro ao buscar anexos:", error);
        }
    };

    useEffect(() => {
        if (chamadoId) {
            fetchAnexos();
        }
    }, [chamadoId]);

    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = async (e) => {
        e.preventDefault();
        setIsDragging(false);
        await fetch(`http://127.0.0.1:5000/api/chamados/${chamadoId}/anexos`, { method: 'POST' });
        onAnexoChange();
    };
    const handleDelete = async (anexoId) => {
        await fetch(`http://127.0.0.1:5000/api/anexos/${anexoId}`, { method: 'DELETE' });
        onAnexoChange();
    };

    const getIconClass = (tipo) => {
        if (tipo.includes('image')) return 'bi-file-earmark-image';
        if (tipo.includes('pdf')) return 'bi-file-earmark-pdf';
        return 'bi-file-earmark-text';
    };

    return (
        <div className="side-panel">
            <h4>Anexos</h4>
            <div 
                className={`drop-zone ${isDragging ? 'active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <i className="bi bi-cloud-arrow-up-fill"></i>
                <p>Arraste e solte os arquivos aqui</p>
            </div>
            <ul className="anexos-list">
                {anexos.map(anexo => (
                    <li key={anexo.id} className="anexo-item">
                        <i className={`bi ${getIconClass(anexo.tipo_arquivo)}`}></i>
                        <div className="anexo-info">
                            <span className="anexo-nome">{anexo.nome_arquivo}</span>
                            <span className="anexo-tamanho">{anexo.tamanho_arquivo} KB</span>
                        </div>
                        {canDeleteAnexos && (
                            <button onClick={() => handleDelete(anexo.id)} className="delete-anexo-btn" title="Excluir anexo">
                                <i className="bi bi-trash"></i>
                            </button>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};


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

    // CORREÇÃO: Usando o ID de permissão correto do arquivo CSV
    const podeModificar = (isLast && item.usuario_id === usuarioLogado.id) || hasPermission(usuarioLogado, 'chamados_chat_excluir');
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
            <div className="history-item-icon"><i className="bi bi-person-circle"></i></div>
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
                <div className="message-action-trigger">
                    <i className="bi bi-three-dots-vertical" onClick={handleOpenMenu}></i>
                </div>
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

// --- Modal Principal ---
function ModalDetalheChamado({ isOpen, onClose, chamado, onChamadoAtualizado, usuarioLogado }) {
    const [formState, setFormState] = useState(null);
    const [isEditing, setIsEditing] = useState({ titulo: false, descricao: false, categoria: false });
    const [isAnexosOpen, setIsAnexosOpen] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const [novoComentario, setNovoComentario] = useState('');
    const [usuarios, setUsuarios] = useState([]);
    const [mensagemParaExcluir, setMensagemParaExcluir] = useState(null);

    const fetchAllData = async () => {
        if (!chamado) return;
        const [usersRes, chatRes] = await Promise.all([
            fetch('http://127.0.0.1:5000/api/usuarios'),
            fetch(`http://127.0.0.1:5000/api/chamados/${chamado.id}/chat`)
        ]);
        const usersData = await usersRes.json();
        const chatData = await chatRes.json();
        setUsuarios(usersData.filter(u => u.ativo));
        setChatHistory(chatData);
    };

    useEffect(() => {
        if (isOpen && chamado) {
            setFormState({ ...chamado });
            fetchAllData();
            setIsAnexosOpen(false);
            setIsEditing({ titulo: false, descricao: false, categoria: false });
        }
    }, [isOpen, chamado]);

    if (!isOpen || !formState) return null;
    
    const optionsUsuarios = usuarios.map(u => ({ value: u.id, label: u.nome }));
    
    // CORREÇÃO: Usando o ID de permissão correto do arquivo CSV
    const podeEditarChamado = usuarioLogado.id === formState.responsavel_id || hasPermission(usuarioLogado, 'chamados_editar');

    const handleEditToggle = (field) => {
        if (!podeEditarChamado) return;
        setIsEditing(prev => ({ ...prev, [field]: !prev[field] }));
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };
    
    const handleSelectChange = (name, option) => {
        setFormState(prev => ({ ...prev, [name]: option ? option.value : null }));
    };

    const handleUpdateChamado = async () => {
        const payload = {
            titulo: formState.titulo,
            descricao: formState.descricao,
            categoria: formState.categoria,
            status: formState.status,
            responsavel_id: formState.responsavel_id,
            solucao: formState.solucao
        };
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/chamados/${chamado.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            onChamadoAtualizado(result.message);
            onClose();
        } catch (error) { console.error("Erro ao atualizar chamado:", error); }
    };

    const handleEnviarComentario = async () => {
        if (!novoComentario.trim()) return;
        const payload = { usuario_id: usuarioLogado.id, conteudo: novoComentario };
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/chamados/${chamado.id}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error((await response.json()).message);
            setNovoComentario('');
            fetchAllData(chamado.id);
        } catch (error) { console.error("Erro ao enviar comentário:", error); }
    };

    const handleUpdateMensagem = async (msgId, novoConteudo) => {
        const payload = { conteudo: novoConteudo, usuario_id_sessao: usuarioLogado.id };
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/chat/mensagens/${msgId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error((await response.json()).message);
            fetchAllData(chamado.id);
        } catch (error) { alert(error.message); }
    };

    const handleConfirmDeleteMensagem = async () => {
        const payload = { usuario_id_sessao: usuarioLogado.id };
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/chat/mensagens/${mensagemParaExcluir}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error((await response.json()).message);
            fetchAllData(chamado.id);
        } catch (error) { alert(error.message); }
        setMensagemParaExcluir(null);
    };

    const handleReactMensagem = async (msgId, reacao) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/chat/mensagens/${msgId}/reacao`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reacao }) });
            if (!response.ok) throw new Error((await response.json()).message);
            fetchAllData(chamado.id);
        } catch (error) { console.error(error.message); }
    };

    const getPriorityClassName = (priority) => {
        if (!priority) return 'default';
        return priority.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };


    const modalTitle = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`priority-bubble ${getPriorityClassName(formState.prioridade)}`} title={`Prioridade: ${formState.prioridade}`}></span>
            {isEditing.titulo ? (
                <input 
                    type="text" 
                    name="titulo"
                    value={formState.titulo} 
                    onChange={handleFormChange}
                    className="modal-title-input"
                    onBlur={() => handleEditToggle('titulo')}
                    autoFocus
                />
            ) : (
                <h3 onClick={() => handleEditToggle('titulo')} className={podeEditarChamado ? 'editable-title' : ''}>
                    #{String(formState.id).padStart(4, '0')}: {formState.titulo}
                    {podeEditarChamado && <i className="bi bi-pencil-fill edit-icon-title"></i>}
                </h3>
            )}
        </div>
    );

    return (
        <>
            <div className={`modal-overlay detail-modal ${isAnexosOpen ? 'anexos-visible' : ''}`} onClick={onClose}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header">{modalTitle}<button onClick={onClose} className="modal-close-btn">&times;</button></div>
                    <div className="modal-body">
                        <div className="main-content-column">
                            <div className="chamado-detalhe-grid">
                                <div className="chamado-detalhe-info">
                                    <div className="user-form-grid">
                                        <div className="filter-group">
                                            <label>Aberto por:</label> 
                                            <p>{formState.solicitante_nome}</p>
                                        </div>
                                        <div className="filter-group">
                                            <label className={podeEditarChamado ? 'editable-label' : ''} onClick={() => handleEditToggle('categoria')}>
                                                Categoria {podeEditarChamado && <i className="bi bi-pencil-fill edit-icon"></i>}
                                            </label>
                                            {isEditing.categoria ? (
                                                <Select options={categoriasChamado} value={categoriasChamado.find(o => o.value === formState.categoria)} onChange={(opt) => handleSelectChange('categoria', opt)} onBlur={() => handleEditToggle('categoria')} autoFocus />
                                            ) : (
                                                <p className="details-text">{formState.categoria}</p>
                                            )}
                                        </div>
                                    </div>
                                    <hr/>
                                    <div className="filter-group">
                                        <label className={podeEditarChamado ? 'editable-label' : ''} onClick={() => handleEditToggle('descricao')}>
                                            Descrição do Problema {podeEditarChamado && <i className="bi bi-pencil-fill edit-icon"></i>}
                                        </label>
                                        {isEditing.descricao ? (
                                            <textarea name="descricao" rows="4" value={formState.descricao} onChange={handleFormChange} onBlur={() => handleEditToggle('descricao')} autoFocus />
                                        ) : (
                                            <p className="description-box">{formState.descricao || "Nenhuma descrição fornecida."}</p>
                                        )}
                                    </div>
                                    <div className="filter-group">
                                        <label>Registrar Solução</label>
                                        <textarea name="solucao" rows="4" placeholder={podeEditarChamado ? "Descreva a solução aplicada..." : "Apenas o responsável ou admin pode registrar a solução."} value={formState.solucao || ''} onChange={handleFormChange} disabled={!podeEditarChamado} />
                                    </div>
                                </div>
                                <div className="chamado-detalhe-acoes">
                                    <h4>Ações</h4>
                                    <div className="user-form-grid">
                                        <div className="filter-group"><label>Responsável:</label><Select options={optionsUsuarios} value={optionsUsuarios.find(o => o.value === formState.responsavel_id)} onChange={(opt) => handleSelectChange('responsavel_id', opt)} isClearable isDisabled={!podeEditarChamado} placeholder="Atribuir a..." /></div>
                                        <div className="filter-group"><label>Status:</label><Select options={statusOptions} value={statusOptions.find(o => o.value === formState.status)} onChange={(opt) => handleSelectChange('status', opt)} isDisabled={!podeEditarChamado} /></div>
                                    </div>
                                </div>
                            </div>
                            <div className="history-chat-container">
                                <h4>Histórico de Comentários</h4>
                                {chatHistory.map((item, index) => (
                                    <ChatItem key={item.id} item={item} isLast={index === chatHistory.length - 1} usuarioLogado={usuarioLogado} onDelete={() => setMensagemParaExcluir(item.id)} onUpdate={handleUpdateMensagem} onReact={handleReactMensagem} />
                                ))}
                            </div>
                        </div>
                        {isAnexosOpen && <AnexosPanel chamadoId={chamado.id} onAnexoChange={fetchAllData} usuarioLogado={usuarioLogado} />}
                    </div>
                    <div className="detail-actions-footer">
                        <div className="footer-actions-left">
                            <button title="Anexos" className="modal-button-icon" onClick={() => setIsAnexosOpen(!isAnexosOpen)}><i className="bi bi-paperclip"></i></button>
                            <textarea rows="1" placeholder="Adicionar um comentário..." value={novoComentario} onChange={(e) => setNovoComentario(e.target.value)}></textarea>
                            <button title="Enviar Comentário" onClick={handleEnviarComentario} disabled={!novoComentario.trim()}><i className="bi bi-send-fill"></i></button>
                        </div>
                        <div className="footer-actions-right">
                            <button className="save-button" onClick={handleUpdateChamado}>
                                <i className="bi bi-check-circle"></i> Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <ModalConfirmacao isOpen={!!mensagemParaExcluir} onClose={() => setMensagemParaExcluir(null)} onConfirm={handleConfirmDeleteMensagem} title="Confirmar Exclusão">
                <p>Tem certeza que deseja excluir esta mensagem? Esta ação não pode ser desfeita.</p>
            </ModalConfirmacao>
        </>
    );
}

export default ModalDetalheChamado;
