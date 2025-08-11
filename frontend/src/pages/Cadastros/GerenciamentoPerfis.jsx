import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';
import ModalAlerta from '../../components/ModalAlerta.jsx';

// Componente recursivo para renderizar a árvore de permissões
function TreeNode({ node, selection, onSelectionChange, disabled }) {
    const isChecked = selection[node.id] || false;
    const hasChildren = node.children && node.children.length > 0;

    return (
        <li>
            <div className={`permission-tree-node ${disabled ? 'disabled' : ''}`}>
                <input type="checkbox" checked={isChecked} onChange={() => onSelectionChange(node.id, !isChecked)} disabled={disabled} />
                <span className="tree-node-label" onClick={() => !disabled && onSelectionChange(node.id, !isChecked)}>
                    {node.name}
                </span>
            </div>
            {hasChildren && (
                <ul>
                    {node.children.map(childNode => (
                        <TreeNode 
                            key={childNode.id} 
                            node={childNode} 
                            selection={selection}
                            onSelectionChange={onSelectionChange}
                            disabled={disabled}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}

// Componente principal da aba
const GerenciamentoPerfis = ({ currentUser }) => {
    const [perfis, setPerfis] = useState([]);
    const [perfilSelecionado, setPerfilSelecionado] = useState(null);
    const [hierarquiaPermissoes, setHierarquiaPermissoes] = useState(null);
    const [permissoesAtuais, setPermissoesAtuais] = useState({});
    
    const [isLoading, setIsLoading] = useState(true);
    const [alerta, setAlerta] = useState({ isOpen: false, message: '' });
    const [modalNovoPerfilAberto, setModalNovoPerfilAberto] = useState(false);
    const [formNovoPerfil, setFormNovoPerfil] = useState({ id: '', nome: '', descricao: '', hierarquia: 10 });

    // Estados para o menu de contexto e exclusão
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, perfil: null });
    const [perfilParaExcluir, setPerfilParaExcluir] = useState(null);


    const isMasterAdmin = currentUser.perfil_id === 'master_admin';

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [perfisRes, hierarquiaRes] = await Promise.all([
                fetch('http://127.0.0.1:5000/api/perfis'),
                fetch('http://127.0.0.1:5000/api/permissoes/hierarquia')
            ]);
            const perfisData = await perfisRes.json();
            const hierarquiaData = await hierarquiaRes.json();
            
            setPerfis(perfisData);
            setHierarquiaPermissoes(hierarquiaData);

            if (perfilSelecionado) {
                const perfilAindaExiste = perfisData.find(p => p.id === perfilSelecionado.id);
                setPerfilSelecionado(perfilAindaExiste || perfisData[0] || null);
            } else if (perfisData.length > 0) {
                setPerfilSelecionado(perfisData[0]);
            }

        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro ao carregar dados: ${error.message}` });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const handleClick = () => setContextMenu({ visible: false, x: 0, y: 0, perfil: null });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        if (perfilSelecionado) {
            fetchPermissoesDoPerfil(perfilSelecionado);
        }
    }, [perfilSelecionado, hierarquiaPermissoes]);

    const fetchPermissoesDoPerfil = async (perfil) => {
        if (!perfil) {
            setPermissoesAtuais({});
            return;
        }
        if (perfil.id === 'master_admin') {
            const allPermissions = {};
            const markAll = (node) => {
                allPermissions[node.id] = true;
                if (node.children) node.children.forEach(markAll);
            };
            if (hierarquiaPermissoes) markAll(hierarquiaPermissoes);
            setPermissoesAtuais(allPermissions);
            return;
        }

        try {
            const response = await fetch(`http://127.0.0.1:5000/api/permissoes/perfil/${perfil.id}`);
            const permissoesIds = await response.json();
            const selection = {};
            permissoesIds.forEach(id => { selection[id] = true; });
            setPermissoesAtuais(selection);
        } catch (error) {
            console.error("Erro ao buscar permissões do perfil:", error);
        }
    };

    const handlePerfilClick = (perfil) => {
        setPerfilSelecionado(perfil);
    };

    const handleSelectionChange = (nodeId, isSelected) => {
        if (perfilSelecionado?.editavel === 0) return;
        const newSelection = { ...permissoesAtuais };
        const findNodeAndChildren = (node, id) => {
            let ids = [];
            if (node.id === id) {
                ids.push(node.id);
                if (node.children) node.children.forEach(child => ids.push(...findNodeAndChildren(child, child.id)));
            } else if (node.children) {
                node.children.forEach(child => ids.push(...findNodeAndChildren(child, id)));
            }
            return ids;
        };
        const allIdsToChange = findNodeAndChildren(hierarquiaPermissoes, nodeId);
        allIdsToChange.forEach(id => { newSelection[id] = isSelected; });
        setPermissoesAtuais(newSelection);
    };

    const handleSaveChanges = async () => {
        if (!perfilSelecionado || perfilSelecionado.editavel === 0) return;
        const permissoesParaSalvar = Object.keys(permissoesAtuais).filter(id => permissoesAtuais[id]);
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/permissoes/perfil/${perfilSelecionado.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissoes: permissoesParaSalvar, autor_id: currentUser.id })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ isOpen: true, message: result.message });
        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro: ${error.message}` });
        }
    };
    
    const handleCreateProfile = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('http://127.0.0.1:5000/api/perfis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formNovoPerfil, autor_id: currentUser.id })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ isOpen: true, message: result.message });
            setModalNovoPerfilAberto(false);
            setFormNovoPerfil({ id: '', nome: '', descricao: '', hierarquia: 10 });
            fetchData();
        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro: ${error.message}` });
        }
    };

    const handleSyncMasterAdmin = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/permissoes/sync_master_admin', {
                method: 'POST'
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ isOpen: true, message: result.message });
        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro: ${error.message}` });
        }
    };

    const handleMove = async (index, direction) => {
        const perfisEditaveis = perfis.filter(p => p.editavel === 1);
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === perfisEditaveis.length - 1)) {
            return;
        }
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        const itemMovido = perfisEditaveis[index];
        perfisEditaveis[index] = perfisEditaveis[newIndex];
        perfisEditaveis[newIndex] = itemMovido;

        const perfisFixos = perfis.filter(p => p.editavel !== 1);
        const perfisAtualizados = [...perfisFixos, ...perfisEditaveis]
            .sort((a, b) => a.hierarquia - b.hierarquia)
            .map(p => {
                const indexEditavel = perfisEditaveis.findIndex(pe => pe.id === p.id);
                if (indexEditavel !== -1) {
                    return { ...p, hierarquia: 10 + indexEditavel };
                }
                return p;
            })
            .sort((a, b) => a.hierarquia - b.hierarquia);
        
        setPerfis(perfisAtualizados);

        try {
            const response = await fetch('http://127.0.0.1:5000/api/perfis/ordenar', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ perfis: perfisAtualizados })
            });
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message);
            }
        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro ao salvar a nova ordem: ${error.message}` });
            fetchData();
        }
    };

    // Funções para o menu de contexto e exclusão
    const handleContextMenu = (event, perfil) => {
        event.preventDefault();
        if (perfil.editavel === 1 && isMasterAdmin) {
            setContextMenu({ visible: true, x: event.pageX, y: event.pageY, perfil });
        }
    };

    const handleDeleteClick = () => {
        setPerfilParaExcluir(contextMenu.perfil);
        setContextMenu({ visible: false, x: 0, y: 0, perfil: null });
    };

    const handleDeleteConfirm = async () => {
        if (!perfilParaExcluir) return;
        try {
            const url = `http://127.0.0.1:5000/api/perfis/${perfilParaExcluir.id}?autor_id=${currentUser.id}`;
            const response = await fetch(url, { method: 'DELETE' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ isOpen: true, message: result.message });
            setPerfilParaExcluir(null);
            fetchData();
        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro: ${error.message}` });
            setPerfilParaExcluir(null);
        }
    };


    if (isLoading) return <div className="card"><p>Carregando gerenciador de perfis...</p></div>;

    return (
        <>
            <div className="card">
                <div className="admin-actions-bar">
                    {isMasterAdmin && (
                        <button className="admin-button" onClick={() => setModalNovoPerfilAberto(true)}>
                            <i className="bi bi-plus-circle-fill"></i> Novo Perfil
                        </button>
                    )}
                </div>
                <div className="permission-layout-container">
                    <aside className="permission-sidebar">
                        <h4>Níveis de Permissão</h4>
                        <ul>
                            {perfis.map((perfil, index) => {
                                const perfisEditaveis = perfis.filter(p => p.editavel === 1);
                                const editavelIndex = perfisEditaveis.findIndex(p => p.id === perfil.id);
                                const isDraggable = perfil.editavel === 1 && isMasterAdmin;

                                return (
                                    <li 
                                        key={perfil.id} 
                                        className={`${isDraggable ? 'draggable' : 'fixed'} ${perfilSelecionado?.id === perfil.id ? 'active' : ''}`}
                                        onClick={() => handlePerfilClick(perfil)}
                                        onContextMenu={(e) => handleContextMenu(e, perfil)}
                                    >
                                        <span>{perfil.nome}</span>
                                        {isDraggable && (
                                            <div className="reorder-buttons">
                                                <button 
                                                    className="reorder-btn" 
                                                    onClick={(e) => { e.stopPropagation(); handleMove(editavelIndex, 'up'); }}
                                                    disabled={editavelIndex === 0}
                                                >
                                                    <i className="bi bi-arrow-up-short"></i>
                                                </button>
                                                <button 
                                                    className="reorder-btn" 
                                                    onClick={(e) => { e.stopPropagation(); handleMove(editavelIndex, 'down'); }}
                                                    disabled={editavelIndex === perfisEditaveis.length - 1}
                                                >
                                                    <i className="bi bi-arrow-down-short"></i>
                                                </button>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </aside>
                    <main className="permission-content">
                        {perfilSelecionado ? (
                            <>
                                <div className="permission-content-header">
                                    <h3>Permissões para: {perfilSelecionado.nome}</h3>
                                    {isMasterAdmin && perfilSelecionado.id === 'master_admin' && (
                                        <button onClick={handleSyncMasterAdmin} className="sync-button" title="Sincronizar Permissões do Master Admin">
                                            <i className="bi bi-arrow-repeat"></i>
                                        </button>
                                    )}
                                </div>
                                <p>{perfilSelecionado.descricao}</p>
                                <div className={`tree-view-container ${perfilSelecionado.editavel === 0 ? 'disabled-tree' : ''}`}>
                                    {hierarquiaPermissoes && (
                                        <ul>
                                            <TreeNode 
                                                node={hierarquiaPermissoes}
                                                selection={permissoesAtuais}
                                                onSelectionChange={handleSelectionChange}
                                                disabled={perfilSelecionado.editavel === 0}
                                            />
                                        </ul>
                                    )}
                                </div>
                                <div className="permission-footer">
                                    <button className="save-button" onClick={handleSaveChanges} disabled={perfilSelecionado.editavel === 0}>
                                        <i className="bi bi-check-circle"></i> Salvar Alterações
                                    </button>
                                    {perfilSelecionado.editavel === 0 && <small>Este perfil não pode ser alterado.</small>}
                                </div>
                            </>
                        ) : (
                            <p>Selecione um perfil para ver ou editar suas permissões.</p>
                        )}
                    </main>
                </div>
            </div>
            {contextMenu.visible && (
                <div className="context-menu-container" style={{ top: contextMenu.y, left: contextMenu.x }}>
                    <div className="context-menu-item delete" onClick={handleDeleteClick}>
                        <i className="bi bi-trash-fill"></i> Excluir Perfil
                    </div>
                </div>
            )}
            <Modal isOpen={modalNovoPerfilAberto} onClose={() => setModalNovoPerfilAberto(false)} title="Criar Novo Perfil de Acesso">
                <form onSubmit={handleCreateProfile}>
                    <div className="user-form-grid">
                        <div className="filter-group">
                            <label>ID do Perfil:</label>
                            <input type="text" value={formNovoPerfil.id} onChange={e => setFormNovoPerfil({...formNovoPerfil, id: e.target.value.toLowerCase().replace(/\s/g, '_')})} required />
                        </div>
                        <div className="filter-group">
                            <label>Nível Hierárquico (10-98):</label>
                            <input type="number" min="10" max="98" value={formNovoPerfil.hierarquia} onChange={e => setFormNovoPerfil({...formNovoPerfil, hierarquia: parseInt(e.target.value) || 10})} required />
                        </div>
                    </div>
                    <div className="filter-group">
                        <label>Nome de Exibição:</label>
                        <input type="text" value={formNovoPerfil.nome} onChange={e => setFormNovoPerfil({...formNovoPerfil, nome: e.target.value})} required />
                    </div>
                    <div className="filter-group">
                        <label>Descrição:</label>
                        <textarea value={formNovoPerfil.descricao} onChange={e => setFormNovoPerfil({...formNovoPerfil, descricao: e.target.value})} required />
                    </div>
                    <div className="modal-footer">
                        <div></div>
                        <div>
                            <button type="button" className="modal-button cancel" onClick={() => setModalNovoPerfilAberto(false)}>Cancelar</button>
                            <button type="submit" className="modal-button confirm" style={{backgroundColor: '#27ae60'}}>Criar Perfil</button>
                        </div>
                    </div>
                </form>
            </Modal>
            <ModalConfirmacao
                isOpen={!!perfilParaExcluir}
                onClose={() => setPerfilParaExcluir(null)}
                onConfirm={handleDeleteConfirm}
                title="Confirmar Exclusão"
            >
                <p>Tem a certeza que deseja excluir o perfil <strong>"{perfilParaExcluir?.nome}"</strong>?</p>
                <p>Esta ação é irreversível.</p>
            </ModalConfirmacao>
            <ModalAlerta isOpen={alerta.isOpen} onClose={() => setAlerta({ isOpen: false, message: '' })} title="Notificação">
                <p>{alerta.message}</p>
            </ModalAlerta>
        </>
    );
};

export default GerenciamentoPerfis;
