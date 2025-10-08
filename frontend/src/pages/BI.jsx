import React, { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import FiltroDash from '../components/FiltrosDash.jsx';
import MenuBI from '../components/MenuBI.jsx';
import Modal from '../components/Modal.jsx';
import ModalConfirmacao from '../components/ModalConfirmacao.jsx';
import ModalAlerta from '../components/ModalAlerta.jsx';
import Select from 'react-select';
import TabelasBI from './BI/TabelasBI.jsx';
import RelacionamentosBI from './BI/RelacionamentosBI.jsx';
import DataPanelPopover from '../components/DataPanelPopover.jsx';
import LayoutPanelPopover from '../components/LayoutPanelPopover.jsx';
import Reception from './BI/Reception.jsx';
import VisualRenderer from './BI/VisualRenderer.jsx';
import { isEqual } from 'lodash'; 
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import TableModal from '../components/TableModal.jsx';


// --- HOOK PARA DETECTAR TENTATIVA DE SAIR DA PÁGINA ---
const useBeforeunload = (enabled, message) => {
    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (enabled) {
                event.preventDefault();
                event.returnValue = message;
                return message;
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [enabled, message]);
};

// --- SUBCOMPONENTES ---
const ContextMenu = React.memo(({ x, y, options, onClose, boundaryRef }) => {
    const menuRef = useRef(null);
    const [position, setPosition] = useState({ top: y, left: x, opacity: 0 });

    useLayoutEffect(() => {
        if (menuRef.current && boundaryRef.current) {
            const menuRect = menuRef.current.getBoundingClientRect();
            const boundaryRect = boundaryRef.current.getBoundingClientRect();

            let newX = x;
            let newY = y;

            if (x + menuRect.width > boundaryRect.right) newX = x - menuRect.width;
            if (newX < boundaryRect.left) newX = boundaryRect.left;
            if (y + menuRect.height > boundaryRect.bottom) newY = y - menuRect.height;
            if (newY < boundaryRect.top) newY = boundaryRect.top;
            
            setPosition({ top: newY, left: newX, opacity: 1 });
        }
    }, [x, y, boundaryRef]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div ref={menuRef} className="context-menu-container" style={{ ...position, position: 'fixed' }}>
            {options.map(option => (
                <div key={option.label} className={`context-menu-item ${option.className || ''} ${option.disabled ? 'disabled' : ''}`} onClick={() => { if (!option.disabled) { option.action(); onClose(); } }}>
                    <i className={`bi ${option.icon}`}></i>
                    <span>{option.label}</span>
                </div>
            ))}
        </div>
    );
});


const BiSidebar = React.memo(({ title, icon, children, isExpanded, onToggle, position = 'left', ...props }) => (
    <aside className={`bi-sidebar ${isExpanded ? 'expanded' : 'collapsed'}`} {...props}>
        <div className="bi-sidebar-header">
            {isExpanded && <span><i className={`bi ${icon}`}></i> {title}</span>}
            <button onClick={onToggle} title={isExpanded ? "Recolher" : "Expandir"}>
                <i className={`bi ${position === 'left' ? (isExpanded ? 'bi-chevron-double-left' : 'bi-chevron-double-right') : (isExpanded ? 'bi-chevron-double-right' : 'bi-chevron-double-left')}`}></i>
            </button>
        </div>
        {isExpanded ? <div className="bi-sidebar-content">{children}</div> : <div className="sidebar-title-vertical">{title}</div>}
    </aside>
));

const GridSelectionModal = ({ isOpen, onClose, onSelectGrid }) => {
    const gridOptions = [
        { type: '1-col', label: '1 coluna', structure: [1] }, { type: '2-col-equal', label: '2 Colunas iguais', structure: [1, 1] },
        { type: '2-col-2-1', label: '2 Colunas (E:2/3, D:1/3)', structure: [2, 1] }, { type: '2-col-1-2', label: '2 Colunas (E:1/3, D:2/3)', structure: [1, 2] },
        { type: '3-col-equal', label: '3 Colunas', structure: [1, 1, 1] },
    ];
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Selecione um Layout de Linha">
            <div className="grid-selection-container">
                {gridOptions.map(option => (
                    <div key={option.type} className="grid-option-card" onClick={() => onSelectGrid(option.type)}>
                        <div className="grid-option-preview">{option.structure.map((flex, index) => (<div key={index} style={{ flex: flex }}></div>))}</div>
                        <span>{option.label}</span>
                    </div>
                ))}
            </div>
        </Modal>
    );
};

const AdjustHeightModal = ({ isOpen, onClose, currentHeightLevel, onApply }) => {
    const [level, setLevel] = useState(currentHeightLevel || 5);
    useEffect(() => { setLevel(currentHeightLevel || 5); }, [currentHeightLevel, isOpen]);
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ajustar Altura da Linha">
            <div className="height-adjuster-modal">
                <button onClick={() => setLevel(l => Math.max(1, l - 1))} disabled={level <= 1}>-</button>
                <span>{200 + (level * 50)} px</span>
                <button onClick={() => setLevel(l => Math.min(10, l + 1))} disabled={level >= 10}>+</button>
            </div>
            <div className="modal-footer">
                <button onClick={onClose} className="modal-button cancel">Cancelar</button>
                <button onClick={() => { onApply(level); onClose(); }} className="modal-button confirm">Aplicar</button>
            </div>
        </Modal>
    );
};

const VisualTypePlaceholder = ({ type, rowHeight }) => {
    const svgs = {
        'card': (<svg viewBox="0 0 100 70"><rect x="10" y="20" width="80" height="30" rx="2"/><rect x="15" y="25" width="30" height="5"/><rect x="15" y="35" width="50" height="10"/></svg>),
        'table': (<svg viewBox="0 0 100 70"><rect x="10" y="15" width="80" height="8"/><rect x="10" y="25" width="80" height="8"/><rect x="10" y="35" width="80" height="8"/><rect x="10" y="45" width="80" height="8"/><rect x="10" y="55" width="80" height="8"/></svg>),
        'matrix': (<svg viewBox="0 0 100 70"><rect x="10" y="15" width="25" height="10"/><rect x="37" y="15" width="25" height="10"/><rect x="64" y="15" width="25" height="10"/><rect x="10" y="27" width="25" height="10"/><rect x="37" y="27" width="25" height="10"/><rect x="64" y="27" width="25" height="10"/><rect x="10" y="39" width="25" height="10"/><rect x="37" y="39" width="25" height="10"/><rect x="64" y="39" width="25" height="10"/><rect x="10" y="51" width="25" height="10"/><rect x="37" y="51" width="25" height="10"/><rect x="64" y="51" width="25" height="10"/></svg>),
        'bar-chart': (<svg viewBox="0 0 100 70"><rect x="10" y="15" width="10" height="10" /><rect x="10" y="30" width="20" height="10" /><rect x="10" y="45" width="30" height="10" /><rect x="10" y="60" width="50" height="10" /><line x1="10" y1="10" x2="10" y2="75" strokeWidth="1" /></svg>),
        'column-chart': (<svg viewBox="0 0 100 70"><rect x="15" y="60" width="10" height="10" /><rect x="30" y="50" width="10" height="20" /><rect x="45" y="40" width="10" height="30" /><rect x="60" y="20" width="10" height="50" /><rect x="75" y="30" width="10" height="40" /><line x1="10" y1="70" x2="90" y2="70" strokeWidth="1" /></svg>),
        'line-chart': (<svg viewBox="0 0 100 70"><polyline points="15,60 30,40 45,50 60,30 75,20 90,45" strokeWidth="2" fill="none"/><line x1="10" y1="70" x2="90" y2="70" strokeWidth="1" /></svg>),
        'pie-chart': (<svg viewBox="0 0 100 70"><circle cx="50" cy="35" r="25" strokeWidth="0" fillOpacity="0.5"/><path d="M 50 35 L 50 10 A 25 25 0 0 1 75 35 Z" fillOpacity="1"/><path d="M 50 35 L 75 35 A 25 25 0 0 1 40 59 Z" fillOpacity="0.7"/></svg>),
        'gauge-chart': (<svg viewBox="0 0 100 70"><path d="M 20 60 A 30 30 0 0 1 80 60" strokeWidth="10" fill="none" /><line x1="50" y1="60" x2="30" y2="30" strokeWidth="2" /></svg>)
    };
    const style = rowHeight ? { maxHeight: `${rowHeight - 18}px` } : {};
    return (<div className="visual-placeholder-content" style={style}>{svgs[type] || svgs['column-chart']}</div>);
};

const VisualActionMenu = ({ onFormatClick, onDataClick }) => (
    <div className="visual-action-menu">
        <button className="visual-action-button" onClick={onDataClick} title="Alterar dados do visual"><i className="bi bi-bar-chart-line-fill"></i></button>
        <button className="visual-action-button" onClick={onFormatClick} title="Formatar visual"><i className="bi bi-palette-fill"></i></button>
    </div>
);

const DashboardHeader = ({ dashboardData, isEditMode, onTitleChange, onDescriptionChange }) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const descriptionRef = useRef(null);

    useEffect(() => {
        if (isEditingDescription && descriptionRef.current) {
            descriptionRef.current.style.height = 'auto';
            descriptionRef.current.style.height = `${descriptionRef.current.scrollHeight}px`;
        }
    }, [isEditingDescription, dashboardData.description]);

    if (!isEditMode && !dashboardData.title) {
        return null; 
    }

    return (
        <div className="dashboard-header-card">
            <div className="dashboard-header-icon-container">
                <img src="/images/logo-pcm.png" alt="Logo" />
            </div>
            <div className="dashboard-header-text-container">
                {isEditingTitle ? (
                    <input type="text" value={dashboardData.title || ''} onChange={(e) => onTitleChange(e.target.value)} onBlur={() => setIsEditingTitle(false)} onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)} autoFocus />
                ) : (
                    <h2 onDoubleClick={() => isEditMode && setIsEditingTitle(true)}>{dashboardData.title || (isEditMode ? "Clique duplo para editar o título" : "")}</h2>
                )}
                {isEditingDescription ? (
                    <textarea ref={descriptionRef} value={dashboardData.description || ''} onChange={(e) => onDescriptionChange(e.target.value)} onBlur={() => setIsEditingDescription(false)} placeholder="Adicione uma descrição..." autoFocus />
                ) : ( (isEditMode || dashboardData.description) && ( <p onDoubleClick={() => isEditMode && setIsEditingDescription(true)}>{dashboardData.description || (isEditMode ? "Clique duplo para editar a descrição" : "")}</p> ) )}
            </div>
        </div>
    );
};


// --- COMPONENTE PRINCIPAL ---
const PaginaBI = ({ currentUser }) => {
    const [currentBiView, setCurrentBiView] = useState('reception');
    const [viewMode, setViewMode] = useState('visualizacao'); 
    const isEditMode = viewMode === 'edicao';
    const [panels, setPanels] = useState({ filters: false, visuals: false, data: false });
    const [debouncedPanels, setDebouncedPanels] = useState(panels);
    const [tables, setTables] = useState([]);
    const [columns, setColumns] = useState({});
    
    const [allColumnsSchema, setAllColumnsSchema] = useState({});

    const [expandedTables, setExpandedTables] = useState({});
    const [isLoadingTables, setIsLoadingTables] = useState(true);
    const [dashboardData, setDashboardData] = useState({ title: '', description: '', rows: [] });
    const [originalDashboardData, setOriginalDashboardData] = useState(null);
    const [pageFilters, setPageFilters] = useState([]);
    const [originalPageFilters, setOriginalPageFilters] = useState(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [navigationAttempt, setNavigationAttempt] = useState({ isAttempting: false, action: () => {} });
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [saveAsName, setSaveAsName] = useState('');
    const [alertState, setAlertState] = useState({ isOpen: false, message: '' });
    const [isGridModalOpen, setIsGridModalOpen] = useState(false);
    const [dragOverTarget, setDragOverTarget] = useState(null);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, target: null });
    const [selectedVisual, setSelectedVisual] = useState(null); 
    const [confirmationState, setConfirmationState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newVisualName, setNewVisualName] = useState('');
    const [layoutToImport, setLayoutToImport] = useState(null);
    const [savedLayouts, setSavedLayouts] = useState([]);
    const [dataPanel, setDataPanel] = useState({ visible: false, coords: null, position: { x: 0, y: 0 } });
    const [layoutPanel, setLayoutPanel] = useState({ visible: false, coords: null, position: { x: 0, y: 0 } });
    const [currentDashboard, setCurrentDashboard] = useState(null);
    const [rowContextMenu, setRowContextMenu] = useState({ visible: false, x: 0, y: 0, rowIndex: null });
    const [rowToChangeLayout, setRowToChangeLayout] = useState(null);
    const [isHeightModalOpen, setIsHeightModalOpen] = useState(false);
    const [rowToAdjustHeight, setRowToAdjustHeight] = useState(null);
    const canvasRef = useRef(null);
    const canvasScrollRef = useRef(null);
    const [tableModalState, setTableModalState] = useState({ isOpen: false, title: '', columns: [], rows: [] });
    const [viewModeContextMenu, setViewModeContextMenu] = useState({ visible: false, x: 0, y: 0, target: null, visualType: null, visualName: '' });

    useEffect(() => {
        if (isEditMode && originalDashboardData && originalPageFilters) {
            const dataChanged = !isEqual(dashboardData, originalDashboardData);
            const filtersChanged = !isEqual(pageFilters, originalPageFilters);
            setHasUnsavedChanges(dataChanged || filtersChanged);
        } else {
            setHasUnsavedChanges(false);
        }
    }, [dashboardData, pageFilters, originalDashboardData, originalPageFilters, isEditMode]);

    useBeforeunload(hasUnsavedChanges, "Você tem alterações não salvas. Deseja realmente sair?");
    
    useEffect(() => {
        const fetchAllSchemas = async (tablesToFetch) => {
            const schemas = {};
            for (const table of tablesToFetch) {
                try {
                    const response = await fetch(`http://127.0.0.1:5000/api/bi/table-schema/${table.name}`);
                    if (response.ok) {
                        const data = await response.json();
                        schemas[table.name] = data.columns;
                    }
                } catch (error) {
                    console.error(`Erro ao buscar esquema da tabela ${table.name}:`, error);
                }
            }
            setAllColumnsSchema(schemas);
        };

        if (currentBiView === 'dashboard' && tables.length > 0) {
            fetchAllSchemas(tables);
        }
    }, [currentBiView, tables]);


    const handleNavigationAttempt = (actionCallback) => {
        if (hasUnsavedChanges) setNavigationAttempt({ isAttempting: true, action: actionCallback });
        else actionCallback();
    };

    const navigate = (to, id = null) => {
        if (to === 'dashboard') handleSelectVisual(id);
        else { setCurrentBiView(to); setCurrentDashboard(null); }
        setHasUnsavedChanges(false);
        setNavigationAttempt({ isAttempting: false, action: () => {} });
    };

    const handleUnsavedChangesDecision = (decision) => {
        const { action } = navigationAttempt;
        if (decision === 'save') {
            handleSaveCurrent().then(() => { if(action) action(); setNavigationAttempt({ isAttempting: false, action: () => {} }); });
        } else if (decision === 'dont_save') {
            if(action) action();
            setHasUnsavedChanges(false);
            setNavigationAttempt({ isAttempting: false, action: () => {} });
        } else { setNavigationAttempt({ isAttempting: false, action: () => {} }); }
    };
    
    const handleSetViewMode = (newMode) => {
        if (isEditMode && newMode === 'visualizacao' && hasUnsavedChanges) handleNavigationAttempt(() => setViewMode(newMode));
        else setViewMode(newMode);
    };

    const handleSaveClick = () => {
        if (!currentDashboard) { setSaveAsName(dashboardData.title); setIsSaveModalOpen('save_as'); } 
        else { setIsSaveModalOpen('options'); }
    };
    
    const handleSaveCurrent = async () => {
        if (!currentDashboard) return;
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/bi/dashboards/${currentDashboard.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ layout: dashboardData, pageFilters: pageFilters, user: currentUser?.nome || 'desconhecido' }) });
            if (!response.ok) throw new Error((await response.json()).message);
            setOriginalDashboardData(JSON.parse(JSON.stringify(dashboardData)));
            setOriginalPageFilters(JSON.parse(JSON.stringify(pageFilters)));
            setAlertState({ isOpen: true, message: "Dashboard salvo com sucesso!" });
            setIsSaveModalOpen(false);
        } catch (error) {
            console.error("Erro ao salvar dashboard:", error);
            setAlertState({ isOpen: true, message: `Falha ao salvar o dashboard: ${error.message}` });
        }
    };

    const handleSaveAsNew = async () => {
        if (!saveAsName.trim()) { setAlertState({ isOpen: true, message: "O nome é obrigatório." }); return; }
        try {
            const response = await fetch('http://127.0.0.1:5000/api/bi/dashboards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: saveAsName, user: currentUser?.nome || 'desconhecido', layout: dashboardData, pageFilters: pageFilters }) });
            const newDashboard = await response.json();
            if (!response.ok) throw new Error(newDashboard.message);
            setCurrentDashboard({ id: newDashboard.id, name: newDashboard.name });
            setDashboardData(newDashboard.layout);
            setPageFilters(newDashboard.pageFilters);
            setOriginalDashboardData(JSON.parse(JSON.stringify(newDashboard.layout)));
            setOriginalPageFilters(JSON.parse(JSON.stringify(newDashboard.pageFilters)));
            setAlertState({ isOpen: true, message: `Dashboard salvo como "${saveAsName}" com sucesso!` });
            setIsSaveModalOpen(false);
            setSaveAsName('');
        } catch (error) {
            console.error("Erro ao salvar como novo:", error);
            setAlertState({ isOpen: true, message: `Falha ao salvar: ${error.message}` });
        }
    };

    const handleOpenCreateModal = async () => {
        setNewVisualName('');
        setLayoutToImport(null);
        try {
            const response = await fetch('http://127.0.0.1:5000/api/bi/dashboards');
            const data = await response.json();
            if (response.ok) setSavedLayouts(data.map(d => ({ value: d.id, label: d.name })));
        } catch (error) {
            console.error("Erro ao buscar layouts para importação:", error);
        }
        setIsCreateModalOpen(true);
    };

    const handleCreateVisual = async () => {
        if (!newVisualName.trim()) { setAlertState({ isOpen: true, message: "O nome é obrigatório." }); return; }
        let payload = { name: newVisualName, user: currentUser?.nome || 'desconhecido' };
        if (layoutToImport) {
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/bi/dashboards/${layoutToImport.value}`);
                const dataToImport = await response.json();
                if (!response.ok) throw new Error(dataToImport.message);
                payload.layout = dataToImport.layout;
                payload.pageFilters = dataToImport.pageFilters;
            } catch (error) { setAlertState({ isOpen: true, message: `Falha ao carregar layout para importação: ${error.message}` }); return; }
        }
        try {
            const response = await fetch('http://127.0.0.1:5000/api/bi/dashboards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const newDashboard = await response.json();
            if (!response.ok) throw new Error(newDashboard.message);
            setCurrentDashboard({ id: newDashboard.id, name: newDashboard.name });
            const layout = newDashboard.layout || { title: newDashboard.name, rows: [] };
            const filters = newDashboard.pageFilters || [];
            setDashboardData(layout);
            setPageFilters(filters);
            setOriginalDashboardData(JSON.parse(JSON.stringify(layout)));
            setOriginalPageFilters(JSON.parse(JSON.stringify(filters)));
            setViewMode('edicao');
            setIsCreateModalOpen(false);
            setCurrentBiView('dashboard');
        } catch (error) {
            console.error("Erro ao criar visual:", error);
            setAlertState({ isOpen: true, message: `Falha ao criar visual: ${error.message}` });
        }
    };
    
    const handleSelectVisual = async (dashboardId) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/bi/dashboards/${dashboardId}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            const layout = data.layout || { title: data.name, description: '', rows: [] };
            const filters = data.pageFilters || [];
            setCurrentDashboard({ id: data.id, name: data.name });
            setDashboardData(layout);
            setPageFilters(filters);
            setOriginalDashboardData(JSON.parse(JSON.stringify(layout)));
            setOriginalPageFilters(JSON.parse(JSON.stringify(filters)));
            setViewMode('visualizacao');
            setCurrentBiView('dashboard');
        } catch (error) {
            console.error("Erro ao carregar dashboard:", error);
            setAlertState({ isOpen: true, message: `Falha ao carregar dashboard: ${error.message}` });
        }
    };

    const handleCancel = () => {
        if (hasUnsavedChanges) {
             setConfirmationState({ isOpen: true, title: 'Cancelar Alterações', message: 'Deseja cancelar? As alterações não salvas serão perdidas.', onConfirm: () => { setDashboardData(originalDashboardData); setPageFilters(originalPageFilters); setViewMode('visualizacao'); setConfirmationState({ isOpen: false }); }});
        } else setViewMode('visualizacao');
    };

    const handleExportPDF = async (fileName) => {
        const root = canvasScrollRef.current;
        if (!root) return;
        const prevOverflow = root.style.overflow, prevScrollTop = root.scrollTop;
        root.style.overflow = "visible"; root.scrollTop = 0;
        try {
            const canvas = await html2canvas(root, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, windowWidth: root.scrollWidth, windowHeight: root.scrollHeight });
            const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
            const pageWidthPt = pdf.internal.pageSize.getWidth(), pageHeightPt = pdf.internal.pageSize.getHeight();
            const imgWidthPx = canvas.width, imgHeightPx = canvas.height;
            const scaleToPage = pageWidthPt / imgWidthPx;
            const pageHeightPx = Math.floor(pageHeightPt / scaleToPage);
            let renderedY = 0, pageIndex = 0;
            while (renderedY < imgHeightPx) {
                const sliceHeightPx = Math.min(pageHeightPx, imgHeightPx - renderedY);
                const pageCanvas = document.createElement("canvas");
                pageCanvas.width = imgWidthPx; pageCanvas.height = sliceHeightPx;
                const ctx = pageCanvas.getContext("2d");
                ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
                ctx.drawImage(canvas, 0, renderedY, imgWidthPx, sliceHeightPx, 0, 0, imgWidthPx, sliceHeightPx);
                const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
                if (pageIndex > 0) pdf.addPage();
                pdf.addImage(imgData, "JPEG", 0, 0, pageWidthPt, sliceHeightPx * scaleToPage);
                renderedY += sliceHeightPx; pageIndex += 1;
            }
            pdf.save(fileName);
        } catch (error) {
            console.error("Erro ao exportar para PDF:", error);
            setAlertState({ isOpen: true, message: "Ocorreu um erro ao gerar o PDF." });
        } finally {
            root.style.overflow = prevOverflow; root.scrollTop = prevScrollTop;
        }
    };
    
    const togglePanel = useCallback((panelName) => setPanels(prev => ({ ...prev, [panelName]: !prev[panelName] })), []);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedPanels(panels), 310);
        return () => clearTimeout(handler);
    }, [panels]);

    useEffect(() => {
        if (currentBiView !== 'dashboard') return;
        const fetchTables = async () => {
            setIsLoadingTables(true);
            try {
                const response = await fetch('http://127.0.0.1:5000/api/bi/tables');
                if (!response.ok) throw new Error((await response.json()).message);
                setTables(await response.json());
            } catch (error) {
                console.error("Erro ao buscar tabelas de BI:", error);
            } finally {
                setIsLoadingTables(false);
            }
        };
        fetchTables();
    }, [currentBiView]);

    const handleToggleTable = useCallback(async (tableName) => {
        setExpandedTables(prev => ({ ...prev, [tableName]: !prev[tableName] }));
    }, []);
    
    const handleDragStart = useCallback((e, data) => { if (isEditMode) e.dataTransfer.setData("application/json", JSON.stringify(data)); }, [isEditMode]);
    const handleDragOver = useCallback((e) => { if (isEditMode) e.preventDefault(); }, [isEditMode]);
    const handleDragEnter = useCallback((e, target) => { if (isEditMode) { e.preventDefault(); setDragOverTarget(target); } }, [isEditMode]);
    const handleDragLeave = useCallback((e) => { if (isEditMode) { e.preventDefault(); setDragOverTarget(null); } }, [isEditMode]);

    const handleDeleteVisual = useCallback((coords) => {
        setDashboardData(prev => ({ ...prev, rows: prev.rows.map((row, rIdx) => rIdx !== coords.rowIndex ? row : { ...row, columns: row.columns.map((col, cIdx) => cIdx !== coords.colIndex ? col : { ...col, visual: null }) }) }));
        setSelectedVisual(null);
    }, []);

    const handleDropOnCanvas = useCallback((e, targetCoords) => {
        if (!isEditMode) return;
        e.preventDefault();
        setDragOverTarget(null);
        const droppedData = JSON.parse(e.dataTransfer.getData("application/json"));
        if (!droppedData.source) return;
        setDashboardData(prevData => {
            const newRows = JSON.parse(JSON.stringify(prevData.rows));
            const targetCol = newRows[targetCoords.rowIndex].columns[targetCoords.colIndex];
            if (droppedData.source === 'sidebar') {
                if (targetCol.visual) return prevData;
                targetCol.visual = { ...droppedData.visual, hasData: false, filters: [], format: {} };
            } else if (droppedData.source === 'canvas') {
                const sourceCol = newRows[droppedData.coords.rowIndex].columns[droppedData.coords.colIndex];
                [targetCol.visual, sourceCol.visual] = [sourceCol.visual, targetCol.visual];
            }
            return { ...prevData, rows: newRows };
        });
    }, [isEditMode]);

    const handleDropOnFilter = useCallback((e, filterType) => {
        if (!isEditMode) return;
        e.preventDefault();
        const droppedData = JSON.parse(e.dataTransfer.getData("application/json"));
        if (droppedData.type !== 'column') return;
        const newFilter = { ...droppedData, id: Date.now(), isImplicit: false, filterConfig: { type: 'basica', selectedValues: [], advancedFilters: [{ id: 1, condition: 'contem', value: '' }], logicOperator: 'E' } };
        if (filterType === 'visual' && selectedVisual) {
            setDashboardData(prev => ({ ...prev, rows: prev.rows.map((row, rIdx) => rIdx !== selectedVisual.rowIndex ? row : { ...row, columns: row.columns.map((col, cIdx) => cIdx !== selectedVisual.colIndex ? col : { ...col, visual: { ...col.visual, filters: [...(col.visual.filters || []), newFilter] } }) }) }));
        } else if (filterType === 'page') {
            setPageFilters(prev => [...prev, newFilter]);
        }
    }, [isEditMode, selectedVisual]);
    
    const handleDropOnDataPanel = (e, targetField, allowMultiple, isAggregatable) => {
        const droppedData = JSON.parse(e.dataTransfer.getData("application/json"));
        if (droppedData.type !== 'column' || !dataPanel.coords) return;
        const { rowIndex, colIndex } = dataPanel.coords;
        setDashboardData(prevData => {
            const newRows = JSON.parse(JSON.stringify(prevData.rows));
            const visual = newRows[rowIndex].columns[colIndex].visual;
            if (visual) {
                const columnSchema = allColumnsSchema[droppedData.tableName]?.find(c => c.name === droppedData.columnName);
                const isNumeric = columnSchema && (columnSchema.type.toUpperCase().includes('INT') || columnSchema.type.toUpperCase().includes('REAL'));
                let aggregation = (visual.id === 'table' || visual.id === 'matrix' || !isAggregatable) ? 'none' : (isNumeric ? 'sum' : 'count');
                const newField = { ...droppedData, displayName: droppedData.columnName, aggregation: aggregation };
                if (allowMultiple) visual[targetField] = [...(visual[targetField] || []), newField];
                else visual[targetField] = newField;
                visual.hasData = true;

                if (!visual.filters) visual.filters = [];

                const implicitFilterId = `implicit-${droppedData.tableName}-${droppedData.columnName}`;
                if (!visual.filters.some(f => f.id === implicitFilterId)) {
                    const implicitFilter = { 
                        ...droppedData, 
                        id: implicitFilterId, 
                        isImplicit: true, 
                        filterConfig: { type: 'basica', selectedValues: [] } 
                    };
                    visual.filters.push(implicitFilter);
                }

                const numericAggregations = ['sum', 'average', 'count', 'countd', 'min', 'max'];
                if (isAggregatable && numericAggregations.includes(aggregation)) {
                    const aggregationLabels = { sum: 'Soma', average: 'Média', count: 'Contagem', countd: 'Contagem (distinta)', min: 'Mínimo', max: 'Máximo' };
                    const aggLabel = aggregationLabels[aggregation];
                    const aggregatedColumnName = `${aggLabel} de ${newField.displayName}`;
                    const aggregatedFilterId = `implicit-agg-${droppedData.tableName}-${droppedData.columnName}-${aggregation}`;

                    if (!visual.filters.some(f => f.id === aggregatedFilterId)) {
                        const aggregatedFilter = {
                            id: aggregatedFilterId,
                            tableName: newField.tableName,
                            columnName: aggregatedColumnName, 
                            isImplicit: true,
                            isAggregated: true, 
                            originalColumn: newField.columnName, 
                            aggregation: newField.aggregation,
                            // --- INÍCIO DA CORREÇÃO: Filtro avançado inicial é vazio para não filtrar nada ---
                            filterConfig: { type: 'avancada', advancedFilters: [] }
                            // --- FIM DA CORREÇÃO ---
                        };
                        visual.filters.push(aggregatedFilter);
                    }
                }
            }
            return { ...prevData, rows: newRows };
        });
    };
    
    const handleRemoveFilter = useCallback((filterToRemove, filterType) => {
        if (filterToRemove.isImplicit) return;
        if (filterType === 'visual' && selectedVisual) {
            setDashboardData(prev => ({ ...prev, rows: prev.rows.map((row, rIdx) => rIdx !== selectedVisual.rowIndex ? row : { ...row, columns: row.columns.map((col, cIdx) => cIdx !== selectedVisual.colIndex ? col : { ...col, visual: { ...col.visual, filters: col.visual.filters.filter(f => f.id !== filterToRemove.id) } }) }) }));
        } else if (filterType === 'page') {
            setPageFilters(prev => prev.filter(f => f.id !== filterToRemove.id));
        }
    }, [selectedVisual]);

    const handleUpdateFilter = useCallback((filterId, newConfig, filterLevel) => {
        const updateLogic = (filters) => filters.map(f => f.id === filterId ? { ...f, filterConfig: newConfig } : f);
        if (filterLevel === 'visual' && selectedVisual) {
            setDashboardData(prev => ({ ...prev, rows: prev.rows.map((row, rIdx) => rIdx !== selectedVisual.rowIndex ? row : { ...row, columns: row.columns.map((col, cIdx) => cIdx !== selectedVisual.colIndex ? col : { ...col, visual: { ...col.visual, filters: updateLogic(col.visual.filters) } }) }) }));
        } else if (filterLevel === 'page') {
            setPageFilters(updateLogic);
        }
    }, [selectedVisual]);

    const handleContextMenu = (e, coords, visual) => {
        e.preventDefault(); e.stopPropagation();
        setSelectedVisual(coords);
        if (isEditMode) {
            setRowContextMenu({ visible: false });
            setContextMenu({ visible: true, x: e.clientX, y: e.clientY, target: coords });
        } else {
            setViewModeContextMenu({ visible: true, x: e.clientX, y: e.clientY, target: e.currentTarget, visualType: visual.id, visualName: visual.format?.title?.text || visual.name });
        }
    };

    const closeContextMenu = () => { setContextMenu({ visible: false }); setViewModeContextMenu({ visible: false }); };
    const handleAddRow = (gridType) => { const typeMap = { '1-col': 1, '2-col-equal': 2, '2-col-2-1': 2, '2-col-1-2': 2, '3-col-equal': 3 }; const newRow = { id: Date.now(), type: gridType, columns: Array.from({ length: typeMap[gridType] }, () => ({ visual: null })), heightLevel: 5 }; setDashboardData(prev => ({ ...prev, rows: [...prev.rows, newRow] })); setIsGridModalOpen(false); };
    const handleDataClick = (e, coords) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setLayoutPanel({ visible: false }); setDataPanel({ visible: true, coords, position: { x: rect.right + 5, y: rect.top } }); };
    
    const handleRemoveColumnFromVisual = (field, indexToRemove) => {
        if (!dataPanel.coords) return;
        const { rowIndex, colIndex } = dataPanel.coords;
        setDashboardData(prevData => {
            const newRows = JSON.parse(JSON.stringify(prevData.rows));
            const visual = newRows[rowIndex].columns[colIndex].visual;
            if (visual) {
                let columnToRemove = null;
                if (typeof indexToRemove === 'number' && Array.isArray(visual[field])) {
                    columnToRemove = visual[field][indexToRemove];
                    if (columnToRemove) visual[field].splice(indexToRemove, 1);
                } else {
                    columnToRemove = visual[field];
                    if (columnToRemove) visual[field] = null;
                }
                
                if (columnToRemove) {
                    const originalFilterId = `implicit-${columnToRemove.tableName}-${columnToRemove.columnName}`;
                    const aggFilterId = `implicit-agg-${columnToRemove.tableName}-${columnToRemove.columnName}-${columnToRemove.aggregation}`;
                    if (visual.filters) {
                        visual.filters = visual.filters.filter(f => f.id !== originalFilterId && f.id !== aggFilterId);
                    }
                }

                const hasAnyData = Object.keys(visual).some(key => {
                    if (['hasData', 'filters', 'id', 'name', 'icon', 'format'].includes(key)) return false;
                    const value = visual[key];
                    return Array.isArray(value) ? value.length > 0 : value !== null;
                });
                if (!hasAnyData) visual.hasData = false;
            }
            return { ...prevData, rows: newRows };
        });
    };

    // --- INÍCIO DA CORREÇÃO ---
    const handleAggregationChange = (field, newAggregation, index) => { 
        if (!dataPanel.coords) return; 
        const { rowIndex, colIndex } = dataPanel.coords; 
        setDashboardData(prev => { 
            const newRows = JSON.parse(JSON.stringify(prev.rows)); 
            const visual = newRows[rowIndex].columns[colIndex].visual; 
            
            if (visual && visual[field]) { 
                const fieldData = typeof index === 'number' ? visual[field][index] : visual[field];
                const oldAggregation = fieldData.aggregation;
                
                fieldData.aggregation = newAggregation; 

                const oldAggFilterId = `implicit-agg-${fieldData.tableName}-${fieldData.columnName}-${oldAggregation}`;
                visual.filters = visual.filters.filter(f => f.id !== oldAggFilterId);

                const numericAggregations = ['sum', 'average', 'count', 'countd', 'min', 'max'];
                if (numericAggregations.includes(newAggregation)) {
                    const aggregationLabels = { sum: 'Soma', average: 'Média', count: 'Contagem', countd: 'Contagem (distinta)', min: 'Mínimo', max: 'Máximo' };
                    const aggLabel = aggregationLabels[newAggregation];
                    const aggregatedColumnName = `${aggLabel} de ${fieldData.displayName}`;
                    const newAggFilterId = `implicit-agg-${fieldData.tableName}-${fieldData.columnName}-${newAggregation}`;

                    const newAggFilter = {
                        id: newAggFilterId,
                        tableName: fieldData.tableName,
                        columnName: aggregatedColumnName, 
                        isImplicit: true,
                        isAggregated: true, 
                        originalColumn: fieldData.columnName, 
                        aggregation: newAggregation,
                        filterConfig: { type: 'avancada', advancedFilters: [] }
                    };
                    visual.filters.push(newAggFilter);
                }
            } 
            return { ...prev, rows: newRows }; 
        }); 
    };
    // --- FIM DA CORREÇÃO ---

    const handleFormatClick = (e, coords) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setDataPanel({ visible: false });
        setLayoutPanel({ visible: true, coords, position: { x: rect.right + 5, y: rect.top } });
    };

    const handleApplyFormat = (newFormat) => {
        if (!layoutPanel.coords) return;
        const { rowIndex, colIndex } = layoutPanel.coords;
        setDashboardData(prev => {
            const newRows = prev.rows.map((row, rIdx) => {
                if (rIdx !== rowIndex) return row;
                const newColumns = row.columns.map((col, cIdx) => {
                    if (cIdx !== colIndex) return col;
                    return { ...col, visual: { ...col.visual, format: newFormat } };
                });
                return { ...row, columns: newColumns };
            });
            return { ...prev, rows: newRows };
        });
    };

    const handleDisplayNameChange = (field, newAlias, index) => { if (!dataPanel.coords) return; const { rowIndex, colIndex } = dataPanel.coords; setDashboardData(prev => { const newRows = JSON.parse(JSON.stringify(prev.rows)); const visual = newRows[rowIndex].columns[colIndex].visual; if (visual && visual[field]) { if (typeof index === 'number') visual[field][index].displayName = newAlias; else visual[field].displayName = newAlias; } return { ...prev, rows: newRows }; }); };
    const handleRowContextMenu = (e, rowIndex) => { if (!isEditMode) return; e.preventDefault(); e.stopPropagation(); setContextMenu({ visible: false }); setRowContextMenu({ visible: true, x: e.clientX, y: e.clientY, rowIndex }); };
    const handleMoveRow = (rowIndex, direction) => { setDashboardData(prev => { const newRows = [...prev.rows]; const targetIndex = direction === 'up' ? rowIndex - 1 : rowIndex + 1; if (targetIndex < 0 || targetIndex >= newRows.length) return prev; [newRows[rowIndex], newRows[targetIndex]] = [newRows[targetIndex], newRows[rowIndex]]; return { ...prev, rows: newRows }; }); };
    const handleRemoveRow = (rowIndex) => { const row = dashboardData.rows[rowIndex]; const hasVisuals = row.columns.some(col => col.visual); const confirmAction = () => { setDashboardData(prev => ({ ...prev, rows: prev.rows.filter((_, index) => index !== rowIndex) })); setConfirmationState({ isOpen: false }); }; if (hasVisuals) { setConfirmationState({ isOpen: true, title: 'Remover Linha', message: 'Esta linha contém visuais. Deseja realmente removê-la?', onConfirm: confirmAction }); } else { confirmAction(); } };
    const openLayoutChangerForRow = (rowIndex) => { setRowToChangeLayout(rowIndex); setIsGridModalOpen(true); };
    const handleChangeRowLayout = (rowIndex, newType) => { const typeMap = { '1-col': 1, '2-col-equal': 2, '2-col-2-1': 2, '2-col-1-2': 2, '3-col-equal': 3 }; const newColCount = typeMap[newType]; const visualsInRow = dashboardData.rows[rowIndex].columns.filter(c => c.visual).length; if (visualsInRow > newColCount) { setAlertState({isOpen: true, message: `A linha contém ${visualsInRow} visuais, mas o layout só permite ${newColCount}. Remova visuais para continuar.`}); return; } setDashboardData(prev => ({...prev, rows: prev.rows.map((row, idx) => idx !== rowIndex ? row : {...row, type: newType, columns: Array.from({ length: newColCount }, (_, i) => row.columns[i] || { visual: null })})})); };
    const handleOpenHeightModal = (rowIndex) => { setRowToAdjustHeight(rowIndex); setIsHeightModalOpen(true); };
    const handleApplyHeightChange = (newLevel) => { setDashboardData(prev => ({...prev, rows: prev.rows.map((row, idx) => idx !== rowToAdjustHeight ? row : {...row, heightLevel: newLevel})})); };
    const handleGridSelection = (gridType) => { if (rowToChangeLayout !== null) handleChangeRowLayout(rowToChangeLayout, gridType); else handleAddRow(gridType); setRowToChangeLayout(null); setIsGridModalOpen(false); };
    const handleTitleChange = (newTitle) => setDashboardData(prev => ({...prev, title: newTitle}));
    const handleDescriptionChange = (newDescription) => setDashboardData(prev => ({...prev, description: newDescription}));
    const getDataTypeIcon = (type) => { const upperType = String(type || '').toUpperCase(); if (upperType.includes('CHAR') || upperType.includes('TEXT')) return 'bi-type'; if (upperType.includes('INT') || upperType.includes('REAL')) return 'bi-hash'; if (upperType.includes('DATE')) return 'bi-calendar-date'; if (upperType.includes('TIME')) return 'bi-clock-history'; return 'bi-question-circle'; };
    const handleExportVisualAsImage = async (targetElement, visualName) => { if (!targetElement) return; try { const canvas = await html2canvas(targetElement, { scale: 2, useCORS: true }); const link = document.createElement('a'); link.download = `${visualName || 'visual'}.png`; link.href = canvas.toDataURL('image/png'); link.click(); } catch (error) { console.error('Erro ao exportar visual como imagem:', error); setAlertState({ isOpen: true, message: 'Falha ao exportar a imagem.' }); } };
    const handleExpandTable = (coords) => { const visual = dashboardData.rows[coords.rowIndex].columns[coords.colIndex].visual; if (!visual || !visual.hasData) { setAlertState({ isOpen: true, message: 'Não há dados para expandir.' }); return; }; fetch('http://127.0.0.1:5000/api/bi/visual-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visual: visual, pageFilters }) }).then(res => res.json()).then(result => { if (result.data && result.data.length > 0) { const columns = Object.keys(result.data[0]).map(key => ({ key: key, name: key, type: 'text' })); setTableModalState({ isOpen: true, title: visual.format?.title?.text || visual.name || 'Tabela', columns: columns, rows: result.data }); } else { setAlertState({ isOpen: true, message: 'Não há dados para expandir.' }); } }).catch(error => { console.error("Error fetching data for modal:", error); setAlertState({ isOpen: true, message: 'Falha ao buscar dados para a tabela.' }); }); };
    
    const handleReorderItem = (field, fromIndex, toIndex) => {
        if (!dataPanel.coords) return;
        const { rowIndex, colIndex } = dataPanel.coords;
        setDashboardData(prev => {
            const newRows = JSON.parse(JSON.stringify(prev.rows));
            const visual = newRows[rowIndex].columns[colIndex].visual;
            if (visual && Array.isArray(visual[field])) { const [movedItem] = visual[field].splice(fromIndex, 1); visual[field].splice(toIndex, 0, movedItem); }
            return { ...prev, rows: newRows };
        });
    };

    const handleReplaceItem = (field, index, newItemData) => {
        if (!dataPanel.coords) return;
        const { rowIndex, colIndex } = dataPanel.coords;
        setDashboardData(prev => {
            const newRows = JSON.parse(JSON.stringify(prev.rows));
            const visual = newRows[rowIndex].columns[colIndex].visual;
            const fieldCfg = fieldConfigForVisual[visual.id]?.find(f => f.field === field);
            if (visual && fieldCfg) {
                const columnSchema = allColumnsSchema[newItemData.tableName]?.find(c => c.name === newItemData.columnName);
                const isNumeric = columnSchema && (columnSchema.type.toUpperCase().includes('INT') || columnSchema.type.toUpperCase().includes('REAL'));
                let aggregation = (visual.id === 'table' || visual.id === 'matrix' || !fieldCfg.aggregatable) ? 'none' : (isNumeric ? 'sum' : 'count');
                const newField = { ...newItemData, displayName: newItemData.columnName, aggregation: aggregation };
                let oldItem = null;
                if (fieldCfg.allowMultiple) { oldItem = visual[field][index]; visual[field][index] = newField; } 
                else { oldItem = visual[field]; visual[field] = newField; }
                if (oldItem) {
                    const oldFilterId = `implicit-${oldItem.tableName}-${oldItem.columnName}`;
                    visual.filters = (visual.filters || []).filter(f => f.id !== oldFilterId);
                }
                const newFilterId = `implicit-${newField.tableName}-${newField.columnName}`;
                if (!(visual.filters || []).some(f => f.id === newFilterId)) {
                    visual.filters = [...(visual.filters || []), { ...newField, id: newFilterId, isImplicit: true, filterConfig: { type: 'basica', selectedValues: [] } }];
                }
            }
            return { ...prev, rows: newRows };
        });
    };
    
    const chartResizeKey = `chart-${viewMode}-${debouncedPanels.filters}-${debouncedPanels.visuals}-${debouncedPanels.data}`;

    const renderCurrentView = () => {
        if (currentBiView === 'reception') return <Reception onSelectDashboard={(id) => handleNavigationAttempt(() => navigate('dashboard', id))} onCreateDashboard={handleOpenCreateModal} currentUser={currentUser} setAlertState={setAlertState} />;
        if (currentBiView === 'relationships') return <RelacionamentosBI />;
        if (currentBiView === 'tables') return <TabelasBI />;
        const rows = dashboardData?.rows || [];
        return (
            <div className="bi-container">
                {isEditMode && (
                    <>
                        <BiSidebar title="Filtros" icon="bi-funnel-fill" isExpanded={panels.filters} onToggle={() => togglePanel('filters')} position="left">
                            {selectedVisual && rows[selectedVisual.rowIndex]?.columns[selectedVisual.colIndex]?.visual ? (
                                <div className="filter-section">
                                    <h6>Filtros em "{rows[selectedVisual.rowIndex].columns[selectedVisual.colIndex].visual.name}"</h6>
                                    <div className="applied-filters-list">
                                        {(rows[selectedVisual.rowIndex].columns[selectedVisual.colIndex].visual.filters || []).map(filtro => <FiltroDash key={filtro.id} filtroInfo={filtro} isImplicit={!!filtro.isImplicit} onRemove={() => handleRemoveFilter(filtro, 'visual')} onApply={(id, cfg) => handleUpdateFilter(id, cfg, 'visual')} /> )}
                                    </div>
                                    <div className="drop-zone" onDragOver={handleDragOver} onDrop={(e) => handleDropOnFilter(e, 'visual')}><small>Arraste campos aqui</small></div>
                                </div>
                            ) : <div className="filter-section-placeholder"><i className="bi bi-cursor-fill"></i><span>Selecione um visual.</span></div>}
                            <div className="filter-section">
                                <h6>Filtros nesta página</h6>
                                <div className="applied-filters-list">{pageFilters.map(filtro => <FiltroDash key={filtro.id} filtroInfo={filtro} isImplicit={!!filtro.isImplicit} onRemove={() => handleRemoveFilter(filtro, 'page')} onApply={(id, cfg) => handleUpdateFilter(id, cfg, 'page')} /> )}</div>
                                <div className="drop-zone" onDragOver={handleDragOver} onDrop={(e) => handleDropOnFilter(e, 'page')}><small>Arraste campos aqui</small></div>
                            </div>
                        </BiSidebar>
                        <BiSidebar title="Visuais" icon="bi-kanban" isExpanded={panels.visuals} onToggle={() => togglePanel('visuals')} position="left">
                            <div className="visuals-grid">{visualTypes.map(vis => (<div key={vis.id} className="visual-item" title={vis.name} draggable={isEditMode} onDragStart={(e) => handleDragStart(e, { source: 'sidebar', visual: vis })}><i className={`bi ${vis.icon}`}></i></div>))}</div>
                        </BiSidebar>
                    </>
                )}
                <main className="bi-canvas" ref={canvasRef} onClick={() => { setSelectedVisual(null); setDataPanel({ visible: false }); setLayoutPanel({ visible: false }); setRowContextMenu({ visible: false }); }}>
                    {!currentDashboard ? ( <div className="bi-placeholder-container"><i className="bi bi-grid-1x2-fill"></i><h2>Selecione ou Crie um Dashboard</h2><p>Use o menu "Visuais" para começar.</p></div> ) : (
                        <>
                            {isEditMode && rows.length === 0 ? ( <div className="bi-placeholder-container"><i className="bi bi-columns-gap"></i><h2>Comece a construir seu dashboard</h2><button className="add-row-btn initial-add-btn" onClick={() => setIsGridModalOpen(true)}><i className="bi bi-plus-lg"></i> Adicionar linha</button></div> ) : (
                                <>
                                    <div className="canvas-scroll-area" ref={canvasScrollRef}>
                                        <div className="dashboard-grid-container">
                                            <DashboardHeader dashboardData={dashboardData} isEditMode={isEditMode} onTitleChange={handleTitleChange} onDescriptionChange={handleDescriptionChange} />
                                            {rows.map((row, rowIndex) => (
                                                <div key={row.id} className="bi-row-sector" onContextMenu={(e) => handleRowContextMenu(e, rowIndex)} style={{ minHeight: `${200 + ((row.heightLevel || 5) * 50)}px` }} >
                                                    <div className={`bi-grid-row grid-type-${row.type}`}>
                                                        {row.columns.map((col, colIndex) => {
                                                            const targetId = `${rowIndex}-${colIndex}`;
                                                            const isSelected = selectedVisual?.rowIndex === rowIndex && selectedVisual?.colIndex === colIndex;
                                                            return (
                                                                <div key={colIndex} className={`bi-grid-col ${dragOverTarget === targetId ? 'drop-hover' : ''}`} onDragOver={handleDragOver} onDrop={(e) => handleDropOnCanvas(e, { rowIndex, colIndex })} onDragEnter={(e) => handleDragEnter(e, targetId)} onDragLeave={handleDragLeave}>
                                                                    {col.visual ? (
                                                                        <div className={`visual-container ${isSelected && isEditMode ? 'selected' : ''}`} draggable={isEditMode} onClick={(e) => { if(isEditMode) { e.stopPropagation(); setSelectedVisual({ rowIndex, colIndex }); } }} onDragStart={(e) => handleDragStart(e, { source: 'canvas', coords: { rowIndex, colIndex }})} onContextMenu={(e) => handleContextMenu(e, { rowIndex, colIndex }, col.visual)} >
                                                                            {col.visual.hasData ? <VisualRenderer key={chartResizeKey} visualConfig={col.visual} pageFilters={pageFilters} /> : <VisualTypePlaceholder type={col.visual.id} rowHeight={200 + ((row.heightLevel || 5) * 50)} />}
                                                                            {isSelected && isEditMode && <VisualActionMenu onDataClick={(e) => handleDataClick(e, { rowIndex, colIndex })} onFormatClick={(e) => handleFormatClick(e, { rowIndex, colIndex })} />}
                                                                        </div>
                                                                    ) : (isEditMode && <div className="visual-placeholder"><i className="bi bi-plus-circle-dotted"></i><span>Arraste um visual</span></div>)}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {isEditMode && rows.length > 0 && <div className="fab-add-row-container" onClick={() => setIsGridModalOpen(true)}><span className="fab-text">Adicionar Linha</span><div className="fab-icon-wrapper"><div className="fab-icon"><i className="bi bi-plus-lg"></i></div></div></div>}
                                </>
                            )}
                        </>
                    )}
                </main>
                {isEditMode && (
                    <BiSidebar title="Dados" icon="bi-database-fill" isExpanded={panels.data} onToggle={() => togglePanel('data')} position="right" id="data-sidebar">
                        {isLoadingTables ? <p>Carregando...</p> : (tables.map(table => (
                            <div key={table.key} className="data-table-group">
                                <div className="data-table-header" onClick={() => handleToggleTable(table.name)}><i className={`bi ${expandedTables[table.name] ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i><strong>{table.displayName}</strong></div>
                                {expandedTables[table.name] && <div className="data-table-columns">{allColumnsSchema[table.name] ? (allColumnsSchema[table.name].map(column => (<div key={column.name} className="draggable-column" draggable={isEditMode} onDragStart={(e) => handleDragStart(e, { type: 'column', tableName: table.name, columnName: column.name })}><i className={`bi ${getDataTypeIcon(column.type)}`}></i><span>{column.name}</span></div>))) : (<p>Carregando...</p>)}</div>}
                            </div>
                        )))}
                    </BiSidebar>
                )}
            </div>
        );
    };

    const visualTypes = [
        { id: 'card', name: 'Cartão', icon: 'bi-card-text' }, { id: 'table', name: 'Tabela', icon: 'bi-table' }, { id: 'matrix', name: 'Matriz', icon: 'bi-grid-3x3-gap' }, 
        { id: 'bar-chart', name: 'Gráfico de Barras', icon: 'bi-bar-chart-steps' }, { id: 'column-chart', name: 'Gráfico de Colunas', icon: 'bi-bar-chart-line-fill' }, 
        { id: 'line-chart', name: 'Gráfico de Linhas', icon: 'bi-graph-up' }, { id: 'pie-chart', name: 'Gráfico de Pizza', icon: 'bi-pie-chart-fill' }, { id: 'gauge-chart', name: 'Velocímetro', icon: 'bi-speedometer2' },
    ];
    
    const contextMenuOptions = [{ label: 'Excluir', icon: 'bi-trash-fill', className: 'delete', action: () => handleDeleteVisual(contextMenu.target) }];
    const rowContextMenuOptions = rowContextMenu.rowIndex !== null ? [
        { label: 'Mover para Cima', icon: 'bi-arrow-up', action: () => handleMoveRow(rowContextMenu.rowIndex, 'up'), disabled: rowContextMenu.rowIndex === 0 },
        { label: 'Mover para Baixo', icon: 'bi-arrow-down', action: () => handleMoveRow(rowContextMenu.rowIndex, 'down'), disabled: rowContextMenu.rowIndex >= dashboardData.rows.length - 1 },
        { label: 'Alterar Layout', icon: 'bi-grid-1x2', action: () => openLayoutChangerForRow(rowContextMenu.rowIndex) },
        { label: 'Ajustar Altura', icon: 'bi-arrows-vertical', action: () => handleOpenHeightModal(rowContextMenu.rowIndex) },
        { label: 'Remover Linha', icon: 'bi-trash-fill', className: 'delete', action: () => handleRemoveRow(rowContextMenu.rowIndex) },
    ] : [];

    const viewModeContextMenuOptions = useMemo(() => {
        if (!viewModeContextMenu.visible) return [];
        const { visualType, target, visualName } = viewModeContextMenu;
        if (visualType === 'table' || visualType === 'matrix') return [{ label: 'Expandir', icon: 'bi-arrows-fullscreen', action: () => handleExpandTable(selectedVisual) }];
        else if (visualType) return [{ label: 'Exportar', icon: 'bi-card-image', action: () => handleExportVisualAsImage(target, visualName) }];
        return [];
    }, [viewModeContextMenu, selectedVisual]);
    
    const fieldConfigForVisual = useMemo(() => ({
        'card': [{ field: 'value', title: 'Valor', allowMultiple: false, aggregatable: true }],
        'bar-chart': [{ field: 'yAxis', title: 'Eixo Y (Categorias)', allowMultiple: false, aggregatable: false }, { field: 'xAxis', title: 'Eixo X (Valores)', allowMultiple: true, aggregatable: true }],
        'column-chart': [{ field: 'xAxis', title: 'Eixo X (Categorias)', allowMultiple: false, aggregatable: false }, { field: 'columnValues', title: 'Valores de Coluna', allowMultiple: true, aggregatable: true }],
        'line-chart': [{ field: 'xAxis', title: 'Eixo X (Categorias)', allowMultiple: false, aggregatable: false }, { field: 'yAxis', title: 'Eixo Y (Valores)', allowMultiple: true, aggregatable: true }],
        'pie-chart': [{ field: 'legend', title: 'Legenda (Categorias)', allowMultiple: false, aggregatable: false }, { field: 'values', title: 'Valores', allowMultiple: false, aggregatable: true }],
        'gauge-chart': [{ field: 'value', title: 'Valor', allowMultiple: false, aggregatable: true }, { field: 'minValue', title: 'Valor Mínimo', allowMultiple: false, aggregatable: true }, { field: 'maxValue', title: 'Valor Máximo', allowMultiple: false, aggregatable: true }],
        'table': [{ field: 'columns', title: 'Colunas', allowMultiple: true, aggregatable: true }],
        'matrix': [{ field: 'rows', title: 'Linhas', allowMultiple: false, aggregatable: false }, { field: 'columns', title: 'Colunas', allowMultiple: false, aggregatable: false }, { field: 'values', title: 'Valores', allowMultiple: false, aggregatable: true }],
    }), []);


    return (
        <div className="page-container" style={{flexDirection: 'column', height: 'calc(100vh - 56px)'}}>
            <MenuBI viewMode={viewMode} setViewMode={handleSetViewMode} onSave={handleSaveClick} onCancel={handleCancel} onNavigate={(to, id) => handleNavigationAttempt(() => navigate(to, id))} currentBiView={currentBiView} onOpenCreateModal={handleOpenCreateModal} onExportPDF={handleExportPDF} dashboardName={currentDashboard?.name} />
            <main className="content-area" style={{ marginLeft: '5px', padding: 0, overflow: 'hidden', flexGrow: 1, display: 'flex' }} onClick={() => {setRowContextMenu({ visible: false }); setDataPanel({visible: false}); setLayoutPanel({visible: false}); closeContextMenu(); }}>
                {renderCurrentView()}
            </main>

            <TableModal isOpen={tableModalState.isOpen} onClose={() => setTableModalState({ isOpen: false, title: '', columns: [], rows: [] })} title={tableModalState.title} columns={tableModalState.columns} rows={tableModalState.rows} />
            <ModalAlerta isOpen={alertState.isOpen} onClose={() => setAlertState({ isOpen: false, message: '' })} title="Aviso"><p>{alertState.message}</p></ModalAlerta>
            <Modal isOpen={navigationAttempt.isAttempting} onClose={() => handleUnsavedChangesDecision('cancel')} title="Alterações não salvas" size='small'>
                <div className="modal-body"><p>Você tem alterações não salvas. O que você gostaria de fazer?</p></div>
                <div className="modal-footer">
                    <button onClick={() => handleUnsavedChangesDecision('cancel')} className="modal-button cancel">Cancelar</button>
                    <button onClick={() => handleUnsavedChangesDecision('dont_save')} className="modal-button">Não Salvar</button>
                    <button onClick={() => handleUnsavedChangesDecision('save')} className="modal-button confirm">Salvar e Sair</button>
                </div>
            </Modal>
            <Modal isOpen={isSaveModalOpen} onClose={() => setIsSaveModalOpen(false)} title="Opções de Salvamento">
                {isSaveModalOpen === 'options' && ( <div className="modal-body" style={{display: 'flex', flexDirection: 'column', gap: '10px'}}> <button onClick={handleSaveCurrent} className="modal-button confirm">Salvar Layout Atual</button> <button onClick={() => { setSaveAsName(`${currentDashboard.name} (Cópia)`); setIsSaveModalOpen('save_as'); }} className="modal-button">Salvar como Novo...</button> </div> )}
                {isSaveModalOpen === 'save_as' && ( <div className="create-visual-form"> <div className="form-group"> <label htmlFor="save-as-name">Nome do Novo Dashboard</label> <input type="text" id="save-as-name" value={saveAsName} onChange={(e) => setSaveAsName(e.target.value)} required /> </div> <div className="modal-footer"> <button onClick={() => setIsSaveModalOpen(false)} className="modal-button cancel">Cancelar</button> <button onClick={handleSaveAsNew} className="modal-button confirm" disabled={!saveAsName.trim()}>Salvar</button> </div> </div> )}
            </Modal>
            
            <DataPanelPopover position={dataPanel.position} canvasRef={canvasRef} visual={dataPanel.coords ? dashboardData.rows[dataPanel.coords.rowIndex].columns[dataPanel.coords.colIndex].visual : null} allColumns={allColumnsSchema} onClose={() => setDataPanel({ visible: false })} onDrop={handleDropOnDataPanel} onRemoveColumn={handleRemoveColumnFromVisual} onAggregationChange={handleAggregationChange} onDisplayNameChange={handleDisplayNameChange} onReorderItem={handleReorderItem} onReplaceItem={handleReplaceItem} fieldConfig={fieldConfigForVisual} />
            <LayoutPanelPopover position={layoutPanel.position} canvasRef={canvasRef} visual={layoutPanel.coords ? dashboardData.rows[layoutPanel.coords.rowIndex].columns[layoutPanel.coords.colIndex].visual : null} allColumns={allColumnsSchema} onClose={() => setLayoutPanel({ visible: false })} onApplyFormat={handleApplyFormat} />
            <GridSelectionModal isOpen={isGridModalOpen} onClose={() => { setIsGridModalOpen(false); setRowToChangeLayout(null); }} onSelectGrid={handleGridSelection} />
            {contextMenu.visible && <ContextMenu x={contextMenu.x} y={contextMenu.y} options={contextMenuOptions} onClose={closeContextMenu} boundaryRef={canvasRef} />}
            {rowContextMenu.visible && <ContextMenu x={rowContextMenu.x} y={rowContextMenu.y} options={rowContextMenuOptions} onClose={() => setRowContextMenu({ visible: false })} boundaryRef={canvasRef} />}
            {viewModeContextMenu.visible && <ContextMenu x={viewModeContextMenu.x} y={viewModeContextMenu.y} options={viewModeContextMenuOptions} onClose={closeContextMenu} boundaryRef={canvasRef} />}
            <AdjustHeightModal isOpen={isHeightModalOpen} onClose={() => setIsHeightModalOpen(false)} currentHeightLevel={rowToAdjustHeight !== null && dashboardData.rows[rowToAdjustHeight] ? dashboardData.rows[rowToAdjustHeight].heightLevel : 5} onApply={handleApplyHeightChange} />
            <ModalConfirmacao isOpen={confirmationState.isOpen} onClose={() => setConfirmationState({ ...confirmationState, isOpen: false })} onConfirm={confirmationState.onConfirm} title={confirmationState.title}><p>{confirmationState.message}</p></ModalConfirmacao>
            
            <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Criar Novo Dashboard">
                <div className="create-visual-form">
                    <div className="form-group">
                        <label htmlFor="visual-name">Nome do Novo Dashboard</label>
                        <input type="text" id="visual-name" value={newVisualName} onChange={(e) => setNewVisualName(e.target.value)} placeholder="Ex: Relatório de Vendas" required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="import-layout">Importar layout de</label>
                        <Select id="import-layout" options={savedLayouts} isClearable isSearchable placeholder="Opcional..." value={layoutToImport} onChange={setLayoutToImport} classNamePrefix="react-select" />
                    </div>
                    <div className="modal-footer">
                        <button onClick={() => setIsCreateModalOpen(false)} className="modal-button cancel">Cancelar</button>
                        <button onClick={handleCreateVisual} className="modal-button confirm" disabled={!newVisualName.trim()}>Criar</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PaginaBI;

