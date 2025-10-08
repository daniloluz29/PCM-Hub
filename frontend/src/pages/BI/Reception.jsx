import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import Modal from '../../components/Modal.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';

// Subcomponente ContextMenu com posicionamento inteligente
const ContextMenu = ({ x, y, options, onClose }) => {
    const menuRef = useRef(null);
    const [position, setPosition] = useState({ top: y, left: x });

    useLayoutEffect(() => {
        if (menuRef.current) {
            const menuWidth = menuRef.current.offsetWidth;
            const menuHeight = menuRef.current.offsetHeight;
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            let newX = x;
            let newY = y;

            if (x + menuWidth > windowWidth) {
                newX = x - menuWidth;
            }
            if (y + menuHeight > windowHeight) {
                newY = y - menuHeight;
            }
            
            setPosition({ top: newY, left: newX });
        }
    }, [x, y]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onClose]);

    return (
        <div ref={menuRef} className="context-menu-container" style={{ top: position.top, left: position.left, zIndex: 1500 }}>
            {options.map((option) => (
                <div 
                    key={option.label} 
                    className={`context-menu-item ${option.className || ''}`} 
                    onClick={() => { option.action(); onClose(); }}
                >
                    <i className={`bi ${option.icon}`}></i>
                    <span>{option.label}</span>
                </div>
            ))}
        </div>
    );
};

// Componente Principal
const Reception = ({ onSelectDashboard, onCreateDashboard, currentUser }) => {
    const [dashboards, setDashboards] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, dashboard: null });
    const [dashboardToDelete, setDashboardToDelete] = useState(null);
    const [dashboardToCopy, setDashboardToCopy] = useState(null);
    const [newCopyName, setNewCopyName] = useState('');
    
    // --- NOVOS ESTADOS PARA RENOMEAR ---
    const [dashboardToRename, setDashboardToRename] = useState(null);
    const [newDashboardName, setNewDashboardName] = useState('');


    // --- NOVOS ESTADOS PARA FILTRO E ORDENAÇÃO ---
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBy, setFilterBy] = useState({ key: 'name', label: 'Nome' });
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const filterBtnRef = useRef(null);

    const fetchDashboards = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('http://127.0.0.1:5000/api/bi/dashboards');
            const data = await response.json();
            if (response.ok) {
                setDashboards(data);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error("Erro ao buscar dashboards:", error);
            // Aqui você pode usar seu ModalAlerta
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboards();
    }, []);
    
    // Lógica para fechar o dropdown de filtro ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterBtnRef.current && !filterBtnRef.current.contains(event.target)) {
                setIsFilterDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleContextMenu = (e, dashboard) => {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY, dashboard });
    };

    const handleDelete = () => {
        if (contextMenu.dashboard) {
            setDashboardToDelete(contextMenu.dashboard);
        }
    };

    const confirmDelete = async () => {
        if (!dashboardToDelete) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/bi/dashboards/${dashboardToDelete.id}`, {
                method: 'DELETE',
            });
            if (response.ok) {
                setDashboardToDelete(null);
                fetchDashboards();
            } else {
                const result = await response.json();
                throw new Error(result.message);
            }
        } catch (error) {
            console.error("Erro ao deletar dashboard:", error);
        }
    };

    const handleCopy = () => {
        if (contextMenu.dashboard) {
            setDashboardToCopy(contextMenu.dashboard);
            setNewCopyName(`${contextMenu.dashboard.name} (Cópia)`);
        }
    };

    const confirmCopy = async () => {
        if (!dashboardToCopy || !newCopyName.trim()) {
            return;
        }
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/bi/dashboards/${dashboardToCopy.id}/copy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCopyName, user: currentUser?.nome || 'desconhecido' })
            });
            if (response.ok) {
                setDashboardToCopy(null);
                setNewCopyName('');
                fetchDashboards();
            } else {
                const result = await response.json();
                throw new Error(result.message);
            }
        } catch (error) {
            console.error("Erro ao copiar dashboard:", error);
        }
    };

    // --- LÓGICA DE RENOMEAR ---
    const handleRename = () => {
        if (contextMenu.dashboard) {
            setDashboardToRename(contextMenu.dashboard);
            setNewDashboardName(contextMenu.dashboard.name);
        }
    };

    const confirmRename = async () => {
        if (!dashboardToRename || !newDashboardName.trim()) {
            return;
        }
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/bi/dashboards/${dashboardToRename.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: newDashboardName, 
                    user: currentUser?.nome || 'desconhecido' 
                })
            });
            if (response.ok) {
                setDashboardToRename(null);
                setNewDashboardName('');
                fetchDashboards();
            } else {
                const result = await response.json();
                throw new Error(result.message);
            }
        } catch (error) {
            console.error("Erro ao renomear dashboard:", error);
            // Adicionar alerta para o usuário
        }
    };


    const contextMenuOptions = [
        { label: 'Renomear', icon: 'bi-pencil-fill', action: handleRename },
        { label: 'Criar uma cópia', icon: 'bi-copy', action: handleCopy },
        { label: 'Excluir', icon: 'bi-trash-fill', className: 'delete', action: handleDelete },
    ];

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const options = { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleString('pt-BR', options);
    };

    // --- LÓGICA DE FILTRO E ORDENAÇÃO ---
    const filteredAndSortedDashboards = useMemo(() => {
        let items = [...dashboards];
        
        // Filtro
        if (searchTerm) {
            items = items.filter(dash => 
                String(dash[filterBy.key] || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Ordenação
        if (sortConfig.key) {
            items.sort((a, b) => {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return items;
    }, [dashboards, searchTerm, filterBy, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const renderSortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? <i className="bi bi-arrow-up sort-icon"></i> : <i className="bi bi-arrow-down sort-icon"></i>;
    };

    const filterOptions = [
        { key: 'name', label: 'Nome' },
        { key: 'createuser', label: 'Criador' }
    ];

    if (isLoading) {
        return <div className="loading-placeholder">Carregando dashboards...</div>;
    }

    return (
        <>
            <div className="reception-container">
                <div className="reception-header">
                    <h1>Página Inicial</h1>
                    <button className="reception-create-btn" onClick={onCreateDashboard}>
                        <i className="bi bi-plus-lg"></i> Criar Novo Dashboard
                    </button>
                </div>
                
                {/* --- NOVOS CONTROLES DE FILTRO --- */}
                <div className="reception-controls">
                    <div className="reception-search-bar">
                        <input 
                            type="text"
                            placeholder={`Filtrar por ${filterBy.label}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="reception-filter-btn" onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)} ref={filterBtnRef}>
                        <i className="bi bi-funnel-fill"></i>
                        <span>Filtros</span>
                        {isFilterDropdownOpen && (
                            <div className="reception-filter-dropdown">
                                {filterOptions.map(opt => (
                                    <div key={opt.key} className="reception-filter-dropdown-item" onClick={() => setFilterBy(opt)}>
                                        {filterBy.key === opt.key && <i className="bi bi-check-lg"></i>}
                                        <span>{opt.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="reception-list-container">
                    <table className="reception-table">
                        <thead>
                            <tr>
                                <th className="sortable" onClick={() => requestSort('name')}>Nome {renderSortIcon('name')}</th>
                                <th className="sortable" onClick={() => requestSort('createuser')}>Usuário Criador {renderSortIcon('createuser')}</th>
                                <th className="sortable" onClick={() => requestSort('created_at')}>Data de Criação {renderSortIcon('created_at')}</th>
                                <th className="sortable" onClick={() => requestSort('updated_at')}>Última Modificação {renderSortIcon('updated_at')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedDashboards.map(dash => (
                                <tr key={dash.id} onContextMenu={(e) => handleContextMenu(e, dash)}>
                                    <td className="dashboard-name" onClick={() => onSelectDashboard(dash.id)}>
                                        {dash.name}
                                    </td>
                                    <td>{dash.createuser || '-'}</td>
                                    <td>{formatDate(dash.created_at)}</td>
                                    <td>{formatDate(dash.updated_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {contextMenu.visible && (
                <ContextMenu x={contextMenu.x} y={contextMenu.y} options={contextMenuOptions} onClose={() => setContextMenu({ visible: false })} />
            )}

            <ModalConfirmacao
                isOpen={!!dashboardToDelete}
                onClose={() => setDashboardToDelete(null)}
                onConfirm={confirmDelete}
                title="Confirmar Exclusão"
            >
                <p>Tem certeza que deseja excluir o dashboard "<b>{dashboardToDelete?.name}</b>"? Esta ação não pode ser desfeita.</p>
            </ModalConfirmacao>

            <Modal
                isOpen={!!dashboardToCopy}
                onClose={() => setDashboardToCopy(null)}
                title={`Copiar "${dashboardToCopy?.name}"`}
            >
                <div className="create-visual-form">
                    <div className="form-group">
                        <label htmlFor="copy-name">Nome do Novo Dashboard</label>
                        <input 
                            type="text" 
                            id="copy-name" 
                            value={newCopyName}
                            onChange={(e) => setNewCopyName(e.target.value)}
                            placeholder="Insira o nome da cópia"
                        />
                    </div>
                    <div className="modal-footer">
                        <button onClick={() => setDashboardToCopy(null)} className="modal-button cancel">Cancelar</button>
                        <button onClick={confirmCopy} className="modal-button confirm" disabled={!newCopyName.trim()}>Criar Cópia</button>
                    </div>
                </div>
            </Modal>

            {/* --- NOVO MODAL PARA RENOMEAR --- */}
            <Modal
                isOpen={!!dashboardToRename}
                onClose={() => setDashboardToRename(null)}
                title={`Renomear "${dashboardToRename?.name}"`}
            >
                <div className="create-visual-form">
                    <div className="form-group">
                        <label htmlFor="rename-name">Novo nome do Dashboard</label>
                        <input 
                            type="text" 
                            id="rename-name" 
                            value={newDashboardName}
                            onChange={(e) => setNewDashboardName(e.target.value)}
                            placeholder="Insira o novo nome"
                        />
                    </div>
                    <div className="modal-footer">
                        <button onClick={() => setDashboardToRename(null)} className="modal-button cancel">Cancelar</button>
                        <button onClick={confirmRename} className="modal-button confirm" disabled={!newDashboardName.trim()}>Renomear</button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default Reception;
