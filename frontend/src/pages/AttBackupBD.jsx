import React, { useState, useEffect, useRef } from 'react';
import Modal from '../components/Modal.jsx';
import ModalAlerta from '../components/ModalAlerta.jsx';
import ModalConfirmacao from '../components/ModalConfirmacao.jsx';
import TableModal from '../components/TableModal.jsx';

// --- COMPONENTES AUXILIARES ---

const dataTypeIcons = {
    'TEXT': 'bi-type', 'INTEGER': 'bi-hash', 'REAL': 'bi-currency-dollar',
    'DATE': 'bi-calendar-date', 'DATETIME': 'bi-clock-history', 'TIMESTAMP': 'bi-calendar',
    'DEFAULT': 'bi-question-circle',
};

const getIconForType = (type) => {
    if (!type) return dataTypeIcons['DEFAULT'];
    const upperType = type.toUpperCase();
    for (const key in dataTypeIcons) {
        if (upperType.includes(key)) return dataTypeIcons[key];
    }
    return dataTypeIcons['DEFAULT'];
};

const ContextMenu = ({ menuPosition, options, onClose }) => {
    const menuRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [onClose]);

    return (
        <div ref={menuRef} className="context-menu-container" style={{ top: menuPosition.y, left: menuPosition.x }}>
            {options.map(option => (
                <div 
                    key={option.label} 
                    className={`context-menu-item ${option.className || ''} ${option.disabled ? 'disabled' : ''}`}
                    onClick={option.disabled ? null : () => { option.action(); onClose(); }}
                >
                    <i className={`bi ${option.icon}`}></i>
                    <span>{option.label}</span>
                </div>
            ))}
        </div>
    );
};

const ModalConfirmacaoBackup = ({ isOpen, onClose, onConfirm, title }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title || "Backup Antes de Atualizar?"} size='medium'>
            <p>Você deseja criar um backup das tabelas selecionadas antes de prosseguir com a atualização dos dados?</p>
            <div className="modal-footer">
                <button className="modal-button cancel" style={{backgroundColor: '#dc3545', marginRight: '10px'}} onClick={onClose}>Cancelar</button>
                <div>
                    <button className="modal-button confirm" style={{backgroundColor: '#6c757d', marginRight: '10px'}} onClick={() => onConfirm(false)}>Não criar backup</button>
                    <button className="modal-button confirm" style={{backgroundColor: '#28a745'}} onClick={() => onConfirm(true)}>Criar backup</button>
                </div>
            </div>
        </Modal>
    );
};

const ModalResultadoProcesso = ({ isOpen, onClose, resultado }) => {
    if (!isOpen || !resultado) return null;

    const statusIcons = {
        'success': { icon: 'bi-check-circle-fill', color: '#28a745' },
        'warning': { icon: 'bi-exclamation-triangle-fill', color: '#ffc107' },
        'error': { icon: 'bi-x-circle-fill', color: '#dc3545' },
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Resultado do Processo" size="large">
            <div className="resultado-summary">
                <div className="summary-item">
                    <i className="bi bi-check-circle-fill"></i>
                    <span>Processo Concluído</span>
                </div>
                <div className="summary-item">
                    <i className="bi bi-clock-fill"></i>
                    <span>Tempo de Execução: {resultado.tempo_execucao}</span>
                </div>
                <div className={`summary-item ${resultado.erros > 0 ? 'summary-errors' : ''}`}>
                    <i className="bi bi-exclamation-diamond-fill"></i>
                    <span>{resultado.erros} Erro(s)</span>
                </div>
            </div>
            <div className="resultado-details-container">
                {resultado.detalhes?.map((item, index) => (
                    <div key={index} className="resultado-item">
                        <div className="resultado-item-header">
                            <span className="resultado-status-icon" style={{ color: statusIcons[item.status]?.color || '#6c757d' }}>
                                <i className={`bi ${statusIcons[item.status]?.icon || 'bi-question-circle-fill'}`}></i>
                            </span>
                            <span className="resultado-tabela-nome">{item.tabela}</span>
                        </div>
                        <div className="resultado-item-body">
                           <p><strong>Atualização:</strong> {item.mensagem_atualizacao}</p>
                           <p><strong>Backup:</strong> {item.mensagem_backup}</p>
                           <p className="detalhamento"><strong>Detalhamento:</strong> {item.detalhamento}</p>
                        </div>
                    </div>
                ))}
            </div>
            <div className="modal-footer" style={{justifyContent: 'flex-end'}}>
                 <button className="modal-button confirm" style={{backgroundColor: '#007bff'}} onClick={onClose}>OK</button>
            </div>
        </Modal>
    );
};


// --- SUB-ABAS ---

const TabelaStatusCard = ({ tabela, onExpand, onContextMenu }) => (
    <div className="tabela-status-card" onContextMenu={(e) => onContextMenu(e, tabela)}>
        <div className="tabela-card-header">
            <h4><i className="bi bi-table"></i> {tabela.nome}</h4>
            <button className="expand-table-btn-card" onClick={() => onExpand(tabela.nome)} title="Expandir Tabela">
                <i className="bi bi-arrows-fullscreen"></i>
            </button>
        </div>
        <div className="tabela-card-body">
            <ul className="colunas-list">
                {tabela.colunas.map(coluna => (
                    <li key={coluna.name}>
                        <i className={`bi ${getIconForType(coluna.type)}`} title={coluna.type}></i>
                        <span>{coluna.name}</span>
                    </li>
                ))}
            </ul>
        </div>
        <div className="tabela-card-footer">
            <i className="bi bi-file-earmark-arrow-down"></i>
            <span>Última atualização: {tabela.ultima_atualizacao_arquivo || 'N/A'}</span>
        </div>
    </div>
);

const SubAbaStatus = ({ statusTabelas, isLoading, error, onExpandTable, onContextMenu }) => {
    if (isLoading) return <p>Carregando status das tabelas...</p>;
    if (error) return <p className="error-message">{error}</p>;
    return (
        <div className="status-tabelas-grid">
            {statusTabelas.map(tabela => (
                <TabelaStatusCard key={tabela.nome} tabela={tabela} onExpand={onExpandTable} onContextMenu={onContextMenu} />
            ))}
        </div>
    );
};

const SubAbaAtualizacao = ({ tabelas, onUpdate, onContextMenu }) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const calcularStatus = (dataString) => {
        if (!dataString) return { text: 'Nunca atualizado', className: 'status-unknown' };
        try {
            const [datePart, timePart] = dataString.split(' ');
            const [day, month, year] = datePart.split('/');
            const dataAtualizacao = new Date(`${year}-${month}-${day}T${timePart}`);
            const diffDays = Math.floor((new Date() - dataAtualizacao) / (1000 * 60 * 60 * 24));
            if (diffDays < 1) return { text: `Hoje`, className: 'status-ok' };
            if (diffDays <= 2) return { text: `Há ${diffDays} dias`, className: 'status-warning' };
            return { text: `Há ${diffDays} dias`, className: 'status-danger' };
        } catch (e) {
            return { text: 'Data inválida', className: 'status-unknown' };
        }
    };

    return (
        <>
            <div className="card">
                <h3>Executar Atualização</h3>
                <p>Inicie a atualização dos dados a partir das planilhas de origem configuradas.</p>
                <div className="update-actions-container">
                    <div className="split-button-container" ref={dropdownRef}>
                        <button className="main-action-btn" onClick={() => onUpdate('all')}>
                            <i className="bi bi-arrow-clockwise"></i> Atualizar Tudo
                        </button>
                        <button className="dropdown-toggle-btn" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                            <i className="bi bi-chevron-down"></i>
                        </button>
                        {isDropdownOpen && (
                            <ul className="dropdown-menu-att">
                                <li onClick={() => { onUpdate('all'); setIsDropdownOpen(false); }}>Atualizar Tudo</li>
                                <li onClick={() => { onUpdate('individual'); setIsDropdownOpen(false); }}>Atualização Individual...</li>
                            </ul>
                        )}
                    </div>
                </div>
            </div>
            <div className="card" style={{marginTop: '20px'}}>
                 <h3>Status da Importação</h3>
                 <div className="table-container" style={{ maxHeight: '100%' }}>
                    <table className="simple-data-table">
                        <thead>
                            <tr>
                                <th>Tabela</th>
                                <th>Última Atualização (BD)</th>
                                <th>Última Atualização (Dados)</th>
                                <th>Último Backup</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tabelas.map(tabela => {
                                const status = calcularStatus(tabela.data_atualizacao_dados);
                                return (
                                    <tr key={tabela.nome} onContextMenu={(e) => onContextMenu(e, tabela)}>
                                        <td>{tabela.nome}</td>
                                        <td>{tabela.data_importacao_db || 'N/A'}</td>
                                        <td>{tabela.data_atualizacao_dados || 'N/A'}</td>
                                        <td>{tabela.ultimo_backup_db || 'N/A'}</td>
                                        <td><span className={`status-badge ${status.className}`}>{status.text}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};

const ModalSelecaoTabelas = ({ isOpen, onClose, tabelas, onConfirm }) => {
    const [selecionadas, setSelecionadas] = useState([]);

    const handleToggle = (tableName) => {
        setSelecionadas(prev =>
            prev.includes(tableName) ? prev.filter(t => t !== tableName) : [...prev, tableName]
        );
    };

    const handleConfirmarClick = () => {
        if (selecionadas.length === 0) {
            alert("Por favor, selecione ao menos uma tabela.");
            return;
        }
        onConfirm(selecionadas);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Seleção de Tabelas para Atualização" size="large">
            <p>Selecione as tabelas que você deseja atualizar a partir de seus arquivos de origem.</p>
            <div className="core-tables-list">
                {tabelas.map(tabela => (
                    <label key={tabela.nome} className="checkbox-label-group">
                        <input
                            type="checkbox"
                            checked={selecionadas.includes(tabela.nome)}
                            onChange={() => handleToggle(tabela.nome)}
                        />
                        <span>{tabela.nome}</span>
                    </label>
                ))}
            </div>
            <div className="modal-footer">
                <div></div>
                <div>
                    <button type="button" className="modal-button cancel" onClick={onClose}>Cancelar</button>
                    <button type="button" className="modal-button confirm" style={{backgroundColor: '#007bff'}} onClick={handleConfirmarClick}>
                        Atualizar Selecionadas
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const SubAbaConfiguracoes = ({ setAlerta }) => {
    const [linhasEditadas, setLinhasEditadas] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingCell, setEditingCell] = useState({ rowIndex: null, colKey: null });
    const [hoveredRow, setHoveredRow] = useState(null);
    const [modalSalvarAberto, setModalSalvarAberto] = useState(false);

    const colunas = [
        { key: 'tabela', name: 'Tabela de Destino' },
        { key: 'caminho', name: 'Pasta de Origem' },
        { key: 'arquivo', name: 'Arquivo de Origem' },
    ];

    const fetchConfiguracoes = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('http://127.0.0.1:5000/api/atualizacao/import-settings');
            const data = await response.json();
            if (response.ok) {
                setLinhasEditadas(JSON.parse(JSON.stringify(data)));
            } else {
                throw new Error(data.message || 'Erro ao buscar configurações.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConfiguracoes();
    }, []);

    const handleCellClick = (rowIndex, colKey) => {
        setEditingCell({ rowIndex, colKey });
    };

    const handleCellChange = (e, rowIndex, colKey) => {
        const novasLinhas = [...linhasEditadas];
        novasLinhas[rowIndex][colKey] = e.target.value;
        setLinhasEditadas(novasLinhas);
    };
    
    const handleAdicionarLinha = () => {
        const novaLinha = { tabela: '', caminho: '', arquivo: '' };
        setLinhasEditadas([...linhasEditadas, novaLinha]);
    };

    const handleExcluirLinha = (rowIndex) => {
        const novasLinhas = linhasEditadas.filter((_, index) => index !== rowIndex);
        setLinhasEditadas(novasLinhas);
    };

    const handleSalvar = async () => {
        setModalSalvarAberto(false);
        try {
            const response = await fetch('http://127.0.0.1:5000/api/atualizacao/import-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(linhasEditadas)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ isOpen: true, title: "Sucesso", message: result.message });
            fetchConfiguracoes();
        } catch (error) {
            setAlerta({ isOpen: true, title: "Erro", message: `Erro ao salvar: ${error.message}` });
        }
    };

    if (isLoading) return <p>Carregando configurações...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <>
            <div className="card">
                <div className="admin-actions-bar">
                    <h3>Configurações de Importação</h3>
                    <button className="admin-button" onClick={() => setModalSalvarAberto(true)}>
                        <i className="bi bi-save-fill"></i> Salvar Alterações
                    </button>
                </div>
                <div className="table-container editable-container" style={{ maxHeight: '100%' }}>
                    <table className="simple-data-table editable">
                        <thead>
                            <tr>
                                {colunas.map(col => <th key={col.key}>{col.name}</th>)}
                                <th className="action-column"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {linhasEditadas.map((row, rowIndex) => (
                                <tr 
                                    key={row.arquivo + rowIndex}
                                    onMouseEnter={() => setHoveredRow(rowIndex)}
                                    onMouseLeave={() => setHoveredRow(null)}
                                >
                                    {colunas.map(col => (
                                        <td 
                                            key={col.key} 
                                            onClick={() => handleCellClick(rowIndex, col.key)}
                                        >
                                            {editingCell.rowIndex === rowIndex && editingCell.colKey === col.key ? (
                                                <input
                                                    type="text"
                                                    value={String(row[col.key] ?? '')}
                                                    onChange={(e) => handleCellChange(e, rowIndex, col.key)}
                                                    onBlur={() => setEditingCell({ rowIndex: null, colKey: null })}
                                                    autoFocus
                                                />
                                            ) : (
                                                String(row[col.key] ?? '')
                                            )}
                                        </td>
                                    ))}
                                    <td className="action-column">
                                        {hoveredRow === rowIndex && (
                                            <button className="delete-row-btn" onClick={() => handleExcluirLinha(rowIndex)}>
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <button className="add-row-btn" onClick={handleAdicionarLinha}>+</button>
                </div>
            </div>
            <ModalConfirmacao
                isOpen={modalSalvarAberto}
                onClose={() => setModalSalvarAberto(false)}
                onConfirm={handleSalvar}
                title="Confirmar Alterações"
            >
                <p>Você tem certeza que deseja salvar as alterações nas configurações de importação?</p>
            </ModalConfirmacao>
        </>
    );
};


// --- COMPONENTE PRINCIPAL ---
const AttBackupBD = ({ currentUser }) => {
    const [subAbaAtiva, setSubAbaAtiva] = useState('status');
    const [statusTabelas, setStatusTabelas] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSelecaoModalOpen, setIsSelecaoModalOpen] = useState(false);
    const [alerta, setAlerta] = useState({ isOpen: false, title: '', message: '' });
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, tabelas: [], title: '' });
    const [resultadoModal, setResultadoModal] = useState({ isOpen: false, data: null });
    
    const [contextMenu, setContextMenu] = useState(null);
    
    const [isExpandModalOpen, setIsExpandModalOpen] = useState(false);
    const [expandedTableData, setExpandedTableData] = useState(null);
    const [isLoadingExpanded, setIsLoadingExpanded] = useState(false);

    const fetchStatus = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('http://127.0.0.1:5000/api/atualizacao/status-tabelas');
            const data = await response.json();
            if (response.ok) {
                setStatusTabelas(data);
            } else {
                throw new Error(data.message || 'Erro ao buscar status das tabelas.');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    // CORREÇÃO: Lógica para direcionar a ação de atualização
    const handleUpdateTrigger = (type, tabela = null) => {
        if (type === 'all') {
            setConfirmationModal({ isOpen: true, tabelas: 'all', title: "Atualizar Todas as Tabelas?" });
        } else if (type === 'individual') {
            if (tabela) { // Chamado pelo menu de contexto
                setConfirmationModal({ isOpen: true, tabelas: [tabela], title: `Atualizar Tabela '${tabela}'?` });
            } else { // Chamado pelo dropdown
                setIsSelecaoModalOpen(true);
            }
        }
    };

    const handleConfirmSelecao = (tabelasSelecionadas) => {
        setIsSelecaoModalOpen(false);
        setConfirmationModal({ isOpen: true, tabelas: tabelasSelecionadas, title: "Atualizar Tabelas Selecionadas?" });
    };

    const handleExecuteAction = async (action, tabelas, requiresBackup = false) => {
        setIsProcessing(true);
        setProgress(0);
        
        const totalTables = Array.isArray(tabelas) ? tabelas.length : statusTabelas.length;
        const estimatedTimePerTable = 1500;
        const totalDuration = totalTables * estimatedTimePerTable * (requiresBackup ? 2 : 1);
        const intervalTime = 50;
        const steps = totalDuration / intervalTime;
        let currentStep = 0;

        const progressInterval = setInterval(() => {
            currentStep++;
            setProgress(Math.min(99, (currentStep / steps) * 100));
        }, intervalTime);

        try {
            let backupResult = { detalhes: [] };
            if (requiresBackup) {
                const backupRes = await fetch('http://127.0.0.1:5000/api/atualizacao/executar-backup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tabelas })
                });
                backupResult = await backupRes.json();
                if (!backupRes.ok) throw new Error(backupResult.message || 'Falha no backup.');
            }

            const actionRes = await fetch(`http://127.0.0.1:5000/api/atualizacao/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tabelas })
            });
            const actionResult = await actionRes.json();
            if (!actionRes.ok) throw new Error(actionResult.message || 'Falha na ação principal.');
            
            const finalResult = { ...actionResult };
            finalResult.detalhes = actionResult.detalhes.map(detail => {
                const backupDetail = backupResult.detalhes.find(b => b.tabela === detail.tabela);
                return { 
                    ...detail, 
                    mensagem_backup: backupDetail?.mensagem_backup || (requiresBackup ? "Backup não processado para esta tabela." : "Backup não solicitado.")
                };
            });
            
            setResultadoModal({ isOpen: true, data: finalResult });
        
        } catch (err) {
            setResultadoModal({ isOpen: true, data: { tempo_execucao: '0s', erros: 1, detalhes: [{ tabela: "Geral", status: "error", mensagem_atualizacao: err.message, mensagem_backup: "-", detalhamento: "-" }] }});
        } finally {
            clearInterval(progressInterval);
            setProgress(100);
            setTimeout(() => setIsProcessing(false), 500);
            fetchStatus();
        }
    };

    const handleConfirmBackupAndUpdate = (doBackup) => {
        const { tabelas } = confirmationModal;
        setConfirmationModal({ isOpen: false, tabelas: [], title: '' });
        handleExecuteAction('executar-atualizacao', tabelas, doBackup);
    };

    const handleContextMenu = (event, tabela) => {
        event.preventDefault();
        setContextMenu({
            x: event.pageX,
            y: event.pageY,
            tabela: tabela
        });
    };
    
    const handleExpandTable = async (tableName) => {
        setIsLoadingExpanded(true);
        setExpandedTableData(null);
        setIsExpandModalOpen(true);
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/db/table-data/${tableName}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            const formattedColumns = data.columns.map(col => ({ key: col, name: col, resizable: true, type: 'text' }));
            setExpandedTableData({ title: `Visualização Completa: ${tableName}`, columns: formattedColumns, rows: data.rows });
        } catch (err) {
            setAlerta({ isOpen: true, title: "Erro", message: `Erro ao carregar dados da tabela ${tableName}: ${err.message}` });
            setIsExpandModalOpen(false);
        } finally {
            setIsLoadingExpanded(false);
        }
    };

    const handleViewBackup = async (tableName) => {
        setIsLoadingExpanded(true);
        setExpandedTableData(null);
        setIsExpandModalOpen(true);
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/atualizacao/ver-backup/${tableName}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            const formattedColumns = data.columns.map(col => ({ key: col, name: col, resizable: true, type: 'text' }));
            setExpandedTableData({ title: `Visualização do Backup: ${tableName}`, columns: formattedColumns, rows: data.rows });
        } catch (err) {
            setAlerta({ isOpen: true, title: "Erro", message: `Erro ao carregar dados do backup: ${err.message}` });
            setIsExpandModalOpen(false);
        } finally {
            setIsLoadingExpanded(false);
        }
    };

    const renderSubAba = () => {
        switch (subAbaAtiva) {
            case 'status':
                return <SubAbaStatus statusTabelas={statusTabelas} isLoading={isLoading} error={error} onExpandTable={handleExpandTable} onContextMenu={handleContextMenu} />;
            case 'atualizacao':
                return <SubAbaAtualizacao tabelas={statusTabelas} onUpdate={handleUpdateTrigger} onContextMenu={handleContextMenu} />;
            case 'configuracoes':
                return <SubAbaConfiguracoes setAlerta={setAlerta} />;
            default:
                return null;
        }
    };

    const isBackupOptionDisabled = contextMenu?.tabela.ultimo_backup_db === null || contextMenu?.tabela.ultimo_backup_db === contextMenu?.tabela.data_importacao_db;

    return (
        <>
            {isProcessing && (
                <div className="processing-overlay">
                    <div className="spinner"></div>
                    <p>Processando...</p>
                    <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            )}

            <div className="page-container">
                <main className="content-area" style={{ marginLeft: '5px' }}>
                    <div className="page-header">
                        <h1>Atualização e Backup do Banco de Dados</h1>
                        <p>Monitore e execute rotinas de atualização das tabelas de dados.</p>
                    </div>

                    <div className="admin-layout-container">
                        <aside className="admin-layout-sidebar">
                            <nav>
                                <ul>
                                    <li>
                                        <button
                                            className={`sidebar-nav-button ${subAbaAtiva === 'status' ? 'active' : ''}`}
                                            onClick={() => setSubAbaAtiva('status')}
                                        >
                                            <i className="bi bi-bar-chart-line-fill"></i>
                                            <span>Status das Tabelas</span>
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            className={`sidebar-nav-button ${subAbaAtiva === 'atualizacao' ? 'active' : ''}`}
                                            onClick={() => setSubAbaAtiva('atualizacao')}
                                        >
                                            <i className="bi bi-arrow-clockwise"></i>
                                            <span>Atualização</span>
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            className={`sidebar-nav-button ${subAbaAtiva === 'configuracoes' ? 'active' : ''}`}
                                            onClick={() => setSubAbaAtiva('configuracoes')}
                                        >
                                            <i className="bi bi-gear-fill"></i>
                                            <span>Configurações</span>
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                        </aside>

                        <main className="admin-layout-content">
                            {renderSubAba()}
                        </main>
                    </div>
                </main>
            </div>

            <ModalSelecaoTabelas 
                isOpen={isSelecaoModalOpen} 
                onClose={() => setIsSelecaoModalOpen(false)} 
                tabelas={statusTabelas} 
                onConfirm={handleConfirmSelecao} 
            />
            <ModalConfirmacaoBackup 
                isOpen={confirmationModal.isOpen} 
                onClose={() => setConfirmationModal({ isOpen: false, tabelas: [] })} 
                onConfirm={handleConfirmBackupAndUpdate} title={confirmationModal.title} 
            />
            <ModalResultadoProcesso 
                isOpen={resultadoModal.isOpen} 
                onClose={() => setResultadoModal({ isOpen: false, data: null })} 
                resultado={resultadoModal.data} 
            />
            <ModalAlerta 
                isOpen={alerta.isOpen} 
                onClose={() => setAlerta({ isOpen: false, title: '', message: '' })} 
                title={alerta.title}><p>{alerta.message}</p>
            </ModalAlerta>
            
            {contextMenu && (
                <ContextMenu 
                    menuPosition={{ x: contextMenu.x, y: contextMenu.y }}
                    onClose={() => setContextMenu(null)}
                    options={[
                        { label: "Atualizar Tabela", icon: "bi-arrow-clockwise", action: () => handleUpdateTrigger('individual', contextMenu.tabela.nome) },
                        { label: "Fazer Backup", icon: "bi-save", action: () => handleExecuteAction('executar-backup', [contextMenu.tabela.nome]) },
                        { label: "Ver Backup", icon: "bi-eye", action: () => handleViewBackup(contextMenu.tabela.nome), disabled: isBackupOptionDisabled },
                        { label: "Restaurar Backup", icon: "bi-arrow-counterclockwise", action: () => handleExecuteAction('executar-restauracao', [contextMenu.tabela.nome]), disabled: isBackupOptionDisabled, className: 'restore' }
                    ]}
                />
            )}
            
            <TableModal 
                isOpen={isExpandModalOpen}
                onClose={() => setIsExpandModalOpen(false)}
                title={isLoadingExpanded ? "Carregando..." : expandedTableData?.title}
                columns={expandedTableData?.columns || []}
                rows={expandedTableData?.rows || []}
            />
        </>
    );
};

export default AttBackupBD;
