import React, { useState, useRef, useEffect } from 'react';

const DropdownMenu = ({ children, hasScroll }) => (
    <div className={`bi-ribbon-dropdown ${hasScroll ? 'with-scroll' : ''}`}>
        {children}
    </div>
);

const MenuBI = ({
    viewMode, setViewMode, onSave, onCancel,
    onNavigate, 
    currentBiView,
    onOpenCreateModal,
    onExportPDF, // Nova prop
    dashboardName // Nova prop
}) => {
    const [isRibbonExpanded, setIsRibbonExpanded] = useState(true);
    const [openDropdown, setOpenDropdown] = useState(null);
    const [savedVisuals, setSavedVisuals] = useState([]);
    const [isLoadingVisuals, setIsLoadingVisuals] = useState(false);
    const menuRef = useRef(null);

    const toggleDropdown = (menu) => {
        setOpenDropdown(openDropdown === menu ? null : menu);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (openDropdown === 'visuais') {
            const fetchVisuals = async () => {
                setIsLoadingVisuals(true);
                try {
                    const response = await fetch('http://127.0.0.1:5000/api/bi/dashboards');
                    const data = await response.json();
                    if (response.ok) {
                        setSavedVisuals(data);
                    } else {
                        console.error("Erro ao buscar visuais:", data.message);
                        setSavedVisuals([]);
                    }
                } catch (error) {
                    console.error("Erro de rede ao buscar visuais:", error);
                    setSavedVisuals([]);
                } finally {
                    setIsLoadingVisuals(false);
                }
            };
            fetchVisuals();
        }
    }, [openDropdown]);
    
    const isDashboardView = currentBiView === 'dashboard';

    const handleExportClick = () => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const formattedDate = `${day}.${month}`;
        const fileName = `${formattedDate} - ${dashboardName || 'Dashboard'}.pdf`;
        onExportPDF(fileName);
    };

    const menuGroups = [
        {
            label: "Navegação",
            items: [
                { id: 'inicio', label: 'Página Inicial', icon: 'bi-house-door-fill', action: () => onNavigate('reception') },
            ]
        },
        {
            label: "Exibição",
            items: [
                { id: 'visuais', label: 'Visuais', icon: 'bi-eye-fill', hasDropdown: true, disabled: !isDashboardView, dropdownContent: (
                    <>
                        <div className="dropdown-item" onClick={() => { onOpenCreateModal(); setOpenDropdown(null); }}>
                            <i className="bi bi-plus-circle-fill"></i> Criar visual
                        </div>
                        <div className="dropdown-divider"></div>
                        <div className="dropdown-scrollable-list">
                            {isLoadingVisuals ? (
                                <div className="dropdown-item disabled">Carregando...</div>
                            ) : savedVisuals.length > 0 ? (
                                savedVisuals.map(visual => (
                                    <div key={visual.id} className="dropdown-item" onClick={() => { onNavigate('dashboard', visual.id); setOpenDropdown(null); }}>
                                        {visual.name}
                                    </div>
                                ))
                            ) : (
                                <div className="dropdown-item disabled">Nenhum layout criado</div>
                            )}
                        </div>
                    </>
                )},
                { id: 'modo', label: 'Modo', icon: 'bi-display-fill', hasDropdown: true, disabled: !isDashboardView, dropdownContent: (
                    <>
                        <div className={`dropdown-item ${viewMode === 'edicao' ? 'active' : ''}`} onClick={() => { setViewMode('edicao'); setOpenDropdown(null); }}>Modo de Edição</div>
                        <div className={`dropdown-item ${viewMode === 'visualizacao' ? 'active' : ''}`} onClick={() => { setViewMode('visualizacao'); setOpenDropdown(null); }}>Modo de Visualização</div>
                    </>
                )}
            ]
        },
        {
            label: "Modelo de Dados",
            items: [
                 { id: 'tabelas', label: 'Tabelas do modelo', icon: 'bi-table', action: () => onNavigate('tables') },
                 { id: 'relacionamentos', label: 'Relacionamentos', icon: 'bi-diagram-3-fill', action: () => onNavigate('relationships') },
            ]
        },
        {
            label: "Ações",
            items: [
                 { id: 'salvar', label: 'Salvar', icon: 'bi-save-fill', action: onSave, disabled: viewMode === 'visualizacao' || !isDashboardView },
                 { id: 'cancelar', label: 'Cancelar', icon: 'bi-x-circle-fill', action: onCancel, disabled: viewMode === 'visualizacao' || !isDashboardView, className: 'cancel-button' },
                 { id: 'exportar', label: 'Exportar PDF', icon: 'bi-file-earmark-pdf-fill', action: handleExportClick, disabled: viewMode === 'edicao' || !isDashboardView },
            ]
        }
    ];

    return (
        <div className="bi-ribbon-container" ref={menuRef}>
            <div className={`bi-ribbon-content ${isRibbonExpanded ? 'expanded' : 'collapsed'}`}>
                <div className="ribbon-main-groups">
                    {menuGroups.map(group => (
                        <div key={group.label} className="ribbon-group">
                            <div className="ribbon-group-items">
                                {group.items.map(item => (
                                    <div key={item.id} className="ribbon-button-wrapper">
                                        <button 
                                            className={`ribbon-button ${item.className || ''}`}
                                            onClick={item.hasDropdown ? () => toggleDropdown(item.id) : item.action}
                                            title={item.label}
                                            disabled={item.disabled}
                                        >
                                            <i className={`bi ${item.icon}`}></i>
                                            {isRibbonExpanded && <span>{item.label}</span>}
                                            {item.hasDropdown && isRibbonExpanded && <i className="bi bi-caret-down-fill dropdown-arrow-small"></i>}
                                        </button>
                                        {item.hasDropdown && openDropdown === item.id && (
                                            <DropdownMenu hasScroll={item.id === 'visuais'}>{item.dropdownContent}</DropdownMenu>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {isRibbonExpanded && <span className="ribbon-group-label">{group.label}</span>}
                        </div>
                    ))}
                </div>
                 <div className="bi-ribbon-toggle">
                    <button onClick={() => setIsRibbonExpanded(!isRibbonExpanded)} title={isRibbonExpanded ? "Recolher Faixa de Opções" : "Expandir Faixa de Opções"}>
                        <i className={`bi ${isRibbonExpanded ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MenuBI;
