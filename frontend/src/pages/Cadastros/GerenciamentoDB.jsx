import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import Modal from '../../components/Modal.jsx';
import ModalAlerta from '../../components/ModalAlerta.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';
import TableModal from '../../components/TableModal.jsx';
import { read, utils } from 'xlsx';

// --- NOVOS COMPONENTES PARA GERENCIAMENTO DE BACKUP ---

// Componente do Menu de Contexto
const ContextMenu = ({ menuPosition, options, onClose }) => {
    const menuRef = useRef(null);
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    if (!menuPosition) return null;

    return (
        <div ref={menuRef} className="context-menu-container" style={{ top: menuPosition.y, left: menuPosition.x }}>
            {options.map(option => (
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


// Modal Principal para Gerenciar Backups
const ModalGerenciarBackup = ({ isOpen, onClose, onExecuteAction, coreTablesList }) => {
    const [backupStatus, setBackupStatus] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTables, setSelectedTables] = useState([]);

    useEffect(() => {
        if (isOpen) {
            const fetchBackupStatus = async () => {
                setIsLoading(true);
                try {
                    const response = await fetch('http://127.0.0.1:5000/api/db/backup-status');
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.message || 'Erro ao buscar status do backup.');
                    setBackupStatus(data);
                } catch (err) {
                    console.error(err);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchBackupStatus();
            setSelectedTables([]); // Limpa a seleção ao abrir
        }
    }, [isOpen]);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedTables(backupStatus.map(t => t.tabela));
        } else {
            setSelectedTables([]);
        }
    };

    const handleSelectTable = (tableName) => {
        setSelectedTables(prev =>
            prev.includes(tableName)
                ? prev.filter(t => t !== tableName)
                : [...prev, tableName]
        );
    };

    const calculateDaysAgo = (dateString) => {
        if (!dateString) return { text: 'Nunca', class: 'days-ago-never' };
        const backupDate = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - backupDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return { text: 'hoje', class: 'days-ago-ok' };
        if (diffDays === 1) return { text: 'há 1 dia', class: 'days-ago-ok' };
        if (diffDays > 1 && diffDays <= 7) return { text: `há ${diffDays} dias`, class: 'days-ago-warn' };
        return { text: `há ${diffDays} dias`, class: 'days-ago-danger' };
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Backups do Banco de Dados" size="large">
            <div className="backup-management-container">
                {isLoading ? <p>Carregando status das tabelas...</p> : (
                    <>
                        <div className="backup-list-header">
                            <label className="checkbox-label-group">
                                <input
                                    type="checkbox"
                                    onChange={handleSelectAll}
                                    checked={backupStatus.length > 0 && selectedTables.length === backupStatus.length}
                                />
                                <span>Selecionar Todas</span>
                            </label>
                        </div>
                        <ul className="backup-table-list">
                            {backupStatus.map(tabela => {
                                const isCritical = coreTablesList.includes(tabela.tabela);
                                const daysAgo = calculateDaysAgo(tabela.ultimo_backup);
                                return (
                                    <li key={tabela.tabela}>
                                        <label className="checkbox-label-group">
                                            <input
                                                type="checkbox"
                                                checked={selectedTables.includes(tabela.tabela)}
                                                onChange={() => handleSelectTable(tabela.tabela)}
                                            />
                                            <span className="table-name-backup">
                                                {isCritical && <i className="bi bi-exclamation-triangle-fill critical-icon" title="Tabela Crítica"></i>}
                                                {tabela.tabela}
                                            </span>
                                        </label>
                                        <span className={`days-ago-badge ${daysAgo.class}`}>
                                            {daysAgo.text}
                                            <small> (Backup: {tabela.ultimo_backup ? new Date(tabela.ultimo_backup).toLocaleDateString('pt-BR') : 'N/A'})</small>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </div>
            <div className="modal-footer">
                <div></div>
                <div>
                    <button type="button" className="modal-button cancel" onClick={onClose}>Cancelar</button>
                    <button
                        type="button"
                        className="modal-button confirm"
                        style={{backgroundColor: '#e87722', marginRight: '10px'}}
                        onClick={() => onExecuteAction('restore', selectedTables)}
                        disabled={selectedTables.length === 0}
                    >
                        <i className="bi bi-arrow-counterclockwise"></i> Restaurar Backup
                    </button>
                    <button
                        type="button"
                        className="modal-button confirm"
                        style={{backgroundColor: '#28a745'}}
                        onClick={() => onExecuteAction('backup', selectedTables)}
                        disabled={selectedTables.length === 0}
                    >
                        <i className="bi bi-save"></i> Fazer Backup
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// Modal de Confirmação para Ações de Backup/Restauração
const ModalConfirmacaoBackup = ({ isOpen, onClose, onConfirm, action, selectedTables, coreTablesList }) => {
    const [userInput, setUserInput] = useState('');
    const criticalSelected = selectedTables.filter(t => coreTablesList.includes(t));
    const hasCritical = criticalSelected.length > 0;
    const isConfirmationDisabled = hasCritical && userInput.toUpperCase() !== 'SIM';

    useEffect(() => {
        if (isOpen) {
            setUserInput(''); // Limpa o input ao abrir
        }
    }, [isOpen]);
    
    const actionText = action === 'backup' ? 'FAZER BACKUP' : 'RESTAURAR O BACKUP';
    const actionTitle = action === 'backup' ? 'Confirmar Backup' : 'Confirmar Restauração';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={actionTitle}>
            <div className="backup-confirmation-content">
                {!hasCritical ? (
                    <>
                        <p>Você tem certeza que deseja <strong>{actionText}</strong> para as <strong>{selectedTables.length}</strong> tabelas selecionadas?</p>
                        <p className="warning-text" style={{marginTop: '15px'}}>Esta ação é irreversível.</p>
                    </>
                ) : (
                    <>
                        <div className="warning-text error">
                            <i className="bi bi-exclamation-octagon-fill"></i>
                            <div>
                                <strong>Atenção! Ação Crítica!</strong>
                                <p>Sua seleção inclui as seguintes tabelas críticas do sistema:</p>
                                <ul>
                                    {criticalSelected.map(t => <li key={t}><strong>{t}</strong></li>)}
                                </ul>
                            </div>
                        </div>
                        <p>Para confirmar que você entende os riscos e deseja prosseguir com a operação, digite "SIM" no campo abaixo.</p>
                        <input
                            type="text"
                            className="confirm-input"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder='Digite SIM para confirmar'
                        />
                    </>
                )}
            </div>
            <div className="modal-footer">
                <button type="button" className="modal-button cancel" onClick={onClose}>Cancelar</button>
                <button
                    type="button"
                    className="modal-button confirm"
                    onClick={onConfirm}
                    disabled={isConfirmationDisabled}
                >
                    Executar Ação
                </button>
            </div>
        </Modal>
    );
};

// Modal para exibir o resultado do processo
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
                           <p><strong>Operação:</strong> {item.mensagem_backup || item.mensagem_atualizacao}</p>
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


// --- COMPONENTES EXISTENTES (com pequenas modificações) ---

const parseColumnsFromQuery = (sql) => {
    if (!sql || !sql.includes('(')) return [];
    try {
        const columnsString = sql.substring(sql.indexOf('(') + 1, sql.lastIndexOf(')'));
        const columns = columnsString.split(/,(?![^()]*\))/g); 
        return columns.map(c => c.trim()).filter(c => c);
    } catch (e) {
        console.error("Erro ao parsear Query:", e);
        return [];
    }
};

const PreviewTable = ({ data }) => {
    if (!data || data.rows.length === 0) {
        return <p>A tabela está vazia ou não foi possível carregar a prévia.</p>;
    }
    return (
        <div className="table-container preview-table-container">
            <table className="simple-data-table">
                <thead>
                    <tr>
                        {data.columns.map(col => <th key={col}>{col}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {data.rows.map((row, index) => (
                        <tr key={index}>
                            {data.columns.map(col => <td key={col}>{String(row[col] ?? '')}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const ModalConfiguracaoImportacao = ({ isOpen, onClose, onConfirm, csvHeaders }) => {
    const [selectedColumns, setSelectedColumns] = useState([]);
    const [checkMode, setCheckMode] = useState('AND');
    const [importMode, setImportMode] = useState('append');

    const handleConfirm = () => {
        if (importMode === 'append' && selectedColumns.length === 0) {
            alert('Para incluir dados, selecione pelo menos uma coluna para verificação de duplicatas.');
            return;
        }
        onConfirm({
            check_columns: selectedColumns,
            check_mode: checkMode,
            import_mode: importMode
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Configurar Importação de Dados" size="large">
            <div className="import-config-container">
                <div className="filter-group">
                    <label>1. Escolha o modo de importação:</label>
                    <div className="radio-group">
                        <label className="radio-label-group">
                            <span className="radio-input-wrapper">        
                                <input 
                                    type="radio" 
                                    name="importMode" 
                                    value="append" 
                                    checked={importMode === 'append'} 
                                    onChange={(e) => setImportMode(e.target.value)} 
                                />
                            </span>
                            <div>
                                <strong>Incluir dados:</strong>
                                <p>Mantém os dados existentes e adiciona apenas as novas linhas do arquivo.</p>
                            </div>
                        </label>
                        <label className="radio-label-group">
                            <span className="radio-input-wrapper">        
                                <input 
                                    type="radio" 
                                    name="importMode" 
                                    value="replace" 
                                    checked={importMode === 'replace'} 
                                    onChange={(e) => setImportMode(e.target.value)} 
                                />
                            </span>
                            <div>
                                <strong>Substituir dados:</strong>
                                <p>Apaga todos os dados atuais da tabela e os substitui pelo conteúdo do arquivo.</p>
                            </div>
                        </label>
                    </div>
                </div>

                {importMode === 'append' && (
                    <>
                        <div className="filter-group">
                            <label>2. Selecione as colunas para verificar duplicatas (para não incluir repetidos):</label>
                            <div className="column-checkbox-list">
                                {csvHeaders.map(header => (
                                    <label key={header} className="checkbox-label-group">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedColumns.includes(header)} 
                                            onChange={() => setSelectedColumns(prev => prev.includes(header) ? prev.filter(c => c !== header) : [...prev, header])} 
                                        />
                                        <span>{header}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="filter-group">
                            <label>3. Escolha o modo de verificação de duplicatas:</label>
                            <div className="radio-group">
                                <label className="radio-label-group">
                                    <span className="radio-input-wrapper">
                                        <input
                                            type="radio"
                                            name="checkMode"
                                            value="AND"
                                            checked={checkMode === 'AND'}
                                            onChange={(e) => setCheckMode(e.target.value)}
                                        />
                                    </span>
                                    <div>
                                        <strong>Mútua (E):</strong>
                                        <p>Uma linha é duplicada se <strong>TODAS</strong> as colunas selecionadas corresponderem.</p>
                                    </div>
                                </label>
                                <label className="radio-label-group">
                                    <span className="radio-input-wrapper">
                                        <input
                                            type="radio"
                                            name="checkMode"
                                            value="OR"
                                            checked={checkMode === 'OR'}
                                            onChange={(e) => setCheckMode(e.target.value)}
                                        />
                                    </span>
                                    <div>
                                        <strong>Individual (OU):</strong>
                                        <p>Uma linha é duplicada se <strong>QUALQUER UMA</strong> das colunas selecionadas corresponder.</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </>
                )}
            </div>
            <div className="modal-footer">
                <div></div>
                <div>
                    <button type="button" className="modal-button cancel" onClick={onClose}>Cancelar</button>
                    <button type="button" className="modal-button confirm" style={{backgroundColor: '#007bff'}} onClick={handleConfirm}>
                        Continuar para Validação
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const ModalGerenciamentoCoreTables = ({ isOpen, onClose, onSave }) => {
    const [allTables, setAllTables] = useState([]);
    const [coreTables, setCoreTables] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen) {
            const fetchTables = async () => {
                setIsLoading(true);
                try {
                    const response = await fetch('http://127.0.0.1:5000/api/db/core-tables');
                    const data = await response.json();
                    if (response.ok) {
                        setAllTables(data.all_tables);
                        setCoreTables(data.core_tables);
                    } else {
                        const errorMessage = data.message || "Erro desconhecido da API.";
                        console.error("Erro ao buscar tabelas críticas:", errorMessage);
                        alert(`Não foi possível carregar os dados: ${errorMessage}`);
                    }
                } catch (error) {
                    console.error("Falha na requisição para buscar tabelas críticas:", error);
                    alert("Ocorreu um erro de rede. Não foi possível buscar as tabelas críticas.");
                } finally {
                    setIsLoading(false);
                }
            };
            fetchTables();
        }
    }, [isOpen]);

    const handleToggle = (tableName) => {
        setCoreTables(prev =>
            prev.includes(tableName) ? prev.filter(t => t !== tableName) : [...prev, tableName]
        );
    };

    const handleSave = async () => {
        await onSave(coreTables);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Tabelas Críticas do Sistema" size="large">
            <p className="warning-text" style={{marginTop: 0}}>
                <i className="bi bi-exclamation-triangle-fill"></i>
                Tabelas marcadas como "críticas" não podem ser alteradas ou excluídas pela interface do sistema para evitar danos acidentais.
            </p>
            {isLoading ? <p>Carregando...</p> : (
                <div className="core-tables-list">
                    {allTables.map(tableName => (
                        <label key={tableName} className="checkbox-label-group">
                            <input
                                type="checkbox"
                                checked={coreTables.includes(tableName)}
                                onChange={() => handleToggle(tableName)}
                            />
                            <span>{tableName}</span>
                        </label>
                    ))}
                </div>
            )}
            <div className="modal-footer">
                <div></div>
                <div>
                    <button type="button" className="modal-button cancel" onClick={onClose}>Cancelar</button>
                    <button type="button" className="modal-button confirm" style={{backgroundColor: '#27ae60'}} onClick={handleSave}>
                        <i className="bi bi-check-circle"></i> Salvar
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// Componente do Container de Status de Backup com Menu de Contexto
const BackupStatusContainer = ({ onContextMenu, onOpenBackupManager }) => {
    const [backupStatus, setBackupStatus] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchBackupStatus = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch('http://127.0.0.1:5000/api/db/backup-status');
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Erro ao buscar status do backup.');
                setBackupStatus(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchBackupStatus();
    }, []);

    const getStatusIcon = (item) => {
        const agora = new Date();
        let status = { icon: 'bi-check-circle-fill', className: 'status-ok', tooltip: 'Backup feito corretamente.' };

        if (item.linhas_db !== item.linhas_backup) {
            status = { icon: 'bi-exclamation-triangle-fill', className: 'status-warning', tooltip: 'A quantidade de linhas do banco de dados e do backup é diferente.' };
        }
        
        if (item.ultimo_backup) {
            const dataBackup = new Date(item.ultimo_backup);
            const diffHoras = (agora - dataBackup) / (1000 * 60 * 60);

            if (diffHoras > 48) {
                status = { icon: 'bi-exclamation-diamond-fill', className: 'status-danger', tooltip: 'O último backup foi feito há mais de 48 horas.' };
            } else if (diffHoras > 24) {
                status = { icon: 'bi-exclamation-triangle-fill', className: 'status-warning', tooltip: 'O último backup foi feito há mais de 24 horas.' };
            }
        } else {
             status = { icon: 'bi-exclamation-diamond-fill', className: 'status-danger', tooltip: 'Nenhum backup encontrado para esta tabela.' };
        }

        return (
            <span className={`status-icon-tooltip ${status.className}`} data-tooltip={status.tooltip}>
                <i className={`bi ${status.icon}`}></i>
            </span>
        );
    };

    return (
        <div className="card">
            <div className="user-edit-header">
                <h3>Status de Backup das Tabelas do Sistema</h3>
                <div className="header-actions">
                    <button className="admin-button" onClick={onOpenBackupManager}>
                        <i className="bi bi-hdd-stack-fill"></i> Gerenciar Backups
                    </button>
                </div>
            </div>
            <div className="table-container" style={{ maxHeight: '300px' }}>
                {isLoading ? <p>Carregando status...</p> : error ? <p className="error-message">{error}</p> : (
                    <table className="simple-data-table">
                        <thead>
                            <tr>
                                <th style={{width: '50px'}}>Status</th>
                                <th>Tabela</th>
                                <th>Último Backup</th>
                                <th>Linhas (Backup)</th>
                                <th>Linhas (BD Principal)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {backupStatus.map(item => (
                                <tr key={item.tabela} onContextMenu={(e) => onContextMenu(e, item.tabela)}>
                                    <td style={{textAlign: 'center'}}>{getStatusIcon(item)}</td>
                                    <td>{item.tabela}</td>
                                    <td>{item.ultimo_backup ? new Date(item.ultimo_backup).toLocaleString('pt-BR') : 'N/A'}</td>
                                    <td>{item.linhas_backup}</td>
                                    <td>{item.linhas_db}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};


// --- COMPONENTE PRINCIPAL ---
const GerenciamentoDB = ({ currentUser }) => {
    const [listaTabelas, setListaTabelas] = useState([]);
    const [tabelaSelecionada, setTabelaSelecionada] = useState(null);
    const [Query, setQuery] = useState('');
    const [isLoadingQuery, setIsLoadingQuery] = useState(false);
    const [isQueryEditing, setIsQueryEditing] = useState(false);
    const [editedQuery, setEditedQuery] = useState('');
    const [queryChanges, setQueryChanges] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
    const [fullTableData, setFullTableData] = useState(null);
    const [isFullDataLoading, setIsFullDataLoading] = useState(false);
    const [formState, setFormState] = useState({
        id: '',
        tabela: '',
        query: 'CREATE TABLE nome_da_tabela (\n  id INTEGER PRIMARY KEY,\n  nome TEXT NOT NULL,\n  valor REAL\n);',
        isEditable: false
    });
    const [isCreating, setIsCreating] = useState(false);
    const [alerta, setAlerta] = useState({ isOpen: false, message: '' });
    const [itemParaAcao, setItemParaAcao] = useState({ action: null, data: null });
    const [criticalDeleteState, setCriticalDeleteState] = useState({ isOpen: false, step: 1, tableName: '', userInput: '' });
    const [isCoreTablesModalOpen, setIsCoreTablesModalOpen] = useState(false);
    const [coreTablesList, setCoreTablesList] = useState([]);

    const fileInputRef = useRef(null);
    const [validationSummary, setValidationSummary] = useState(null);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [parsedData, setParsedData] = useState([]);
    const [isImporting, setIsImporting] = useState(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [importConfig, setImportConfig] = useState(null);
    
    const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [resultadoModal, setResultadoModal] = useState({ isOpen: false, data: null });
    const [confirmationBackupModal, setConfirmationBackupModal] = useState({ isOpen: false, action: null, tables: [] });
    
    // NOVO ESTADO PARA O MENU DE CONTEXTO
    const [contextMenu, setContextMenu] = useState(null);


    const fetchCoreTables = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/db/core-tables');
            const data = await response.json();
            if (response.ok) {
                setCoreTablesList(data.core_tables);
            }
        } catch (error) {
            console.error("Erro ao buscar tabelas críticas:", error);
        }
    };

    const fetchListaTabelas = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/db/all-tables');
            const data = await response.json();
            setListaTabelas(data);
        } catch (error) {
            setAlerta({ isOpen: true, message: 'Erro ao buscar lista de tabelas.' });
        }
    };

    useEffect(() => {
        fetchListaTabelas();
        fetchCoreTables();
    }, []);

    const handleTabelaSelectChange = async (selectedOption) => {
        setTabelaSelecionada(selectedOption);
        setIsQueryEditing(false);
        setPreviewData(null);
        if (selectedOption) {
            setIsLoadingQuery(true);
            setQuery('');
            setEditedQuery('');
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/tabelas/${selectedOption.value}/Query`);
                const data = await response.json();
                if (response.ok) {
                    setQuery(data.Query);
                    setEditedQuery(data.Query);
                } else {
                    setQuery(`Erro: ${data.message}`);
                }
            } catch (error) {
                setQuery('Erro ao buscar Query da tabela.');
            } finally {
                setIsLoadingQuery(false);
            }
        } else {
            setQuery('');
            setEditedQuery('');
        }
    };
    
    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormState(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleCreateTable = async (e) => {
        e.preventDefault();
        if (formState.isEditable && !formState.tabela.trim()) {
            setAlerta({ isOpen: true, message: "O Nome de Exibição é obrigatório para tabelas editáveis." });
            return;
        }
        setIsCreating(true);
        try {
            const response = await fetch('http://127.0.0.1:5000/api/tabelas/criar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formState)
            });
            const result = await response.json();
            setAlerta({ isOpen: true, message: result.message });
            if (response.ok) {
                setFormState({ id: '', tabela: '', query: 'CREATE TABLE ...', isEditable: false });
                fetchListaTabelas();
            }
        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro ao criar tabela: ${error.message}` });
        } finally {
            setIsCreating(false);
        }
    };
    
    const handleConfirmAction = () => {
        if (!itemParaAcao.action) return;
        if (itemParaAcao.action === 'save') handleUpdateQuery();
        else if (itemParaAcao.action === 'delete') handleDeleteTable();
        else if (itemParaAcao.action === 'import') handleConfirmImport();
        setItemParaAcao({ action: null, data: null });
    };

    const handleInitiateSave = () => {
        const originalCols = parseColumnsFromQuery(Query);
        const newCols = parseColumnsFromQuery(editedQuery);
        const added = newCols.filter(col => !originalCols.includes(col));
        const removed = originalCols.filter(col => !newCols.includes(col));
        setQueryChanges({ added, removed });
        setItemParaAcao({ action: 'save', data: tabelaSelecionada });
    };

    const handleUpdateQuery = async () => {
        setIsLoadingQuery(true);
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/tabelas/${itemParaAcao.data.value}/alter-safe`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: editedQuery })
            });
            const result = await response.json();
            setAlerta({ isOpen: true, message: result.message });
            if (response.ok) {
                setQuery(editedQuery);
                setIsQueryEditing(false);
            }
        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro ao salvar Query: ${error.message}` });
        } finally {
            setIsLoadingQuery(false);
        }
    };

    const handleInitiateDelete = () => {
        if (!tabelaSelecionada) return;
        const isCritical = coreTablesList.includes(tabelaSelecionada.value);
        const isMasterAdmin = currentUser?.perfil_id === 'master_admin';

        if (isCritical) {
            if (isMasterAdmin) {
                setCriticalDeleteState({ isOpen: true, step: 1, tableName: tabelaSelecionada.value, userInput: '' });
            } else {
                setAlerta({ isOpen: true, message: 'Ação bloqueada. Esta é uma tabela crítica do sistema e não pode ser excluída.' });
            }
        } else {
            setItemParaAcao({ action: 'delete', data: tabelaSelecionada });
        }
    };

    const handleDeleteTable = async () => {
        const tableName = itemParaAcao?.data?.value || criticalDeleteState.tableName;
        if (!tableName) return;

        setIsLoadingQuery(true);
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/tabelas/${tableName}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            setAlerta({ isOpen: true, message: result.message });
            if (response.ok) {
                fetchListaTabelas();
                setTabelaSelecionada(null);
                setQuery('');
                setEditedQuery('');
            }
        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro ao excluir tabela: ${error.message}` });
        } finally {
            setIsLoadingQuery(false);
            setItemParaAcao({ action: null, data: null });
            setCriticalDeleteState({ isOpen: false, step: 1, tableName: '', userInput: '' });
        }
    };

    const handleCancelEdit = () => {
        setEditedQuery(Query);
        setIsQueryEditing(false);
    };

    const handlePreview = async () => {
        if (previewData) {
            setPreviewData(null);
            return;
        }
        if (!tabelaSelecionada) return;
        setIsPreviewLoading(true);
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/tabelas/${tabelaSelecionada.value}/preview`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            setPreviewData(data);
        } catch (error) {
            setAlerta({ isOpen: true, message: error.message });
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleExpandPreview = async () => {
        if (!tabelaSelecionada) return;
        setIsFullDataLoading(true);
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/db/table-data/${tabelaSelecionada.value}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            const formattedColumns = data.columns.map(col => ({
                key: col, name: col, resizable: true, type: 'text'
            }));

            setFullTableData({ columns: formattedColumns, rows: data.rows });
            setIsPreviewModalOpen(true);

        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro ao carregar dados completos: ${error.message}` });
        } finally {
            setIsFullDataLoading(false);
        }
    };

    const handleFileDrop = (e) => { 
        e.preventDefault(); 
        if (e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]); 
    };
    const handleFileSelect = (e) => { 
        if (e.target.files.length > 0) processFile(e.target.files[0]); 
        e.target.value = null; 
    };

    const processFile = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = utils.sheet_to_json(worksheet, { defval: null });
                setParsedData(jsonData);
                setIsConfigModalOpen(true);
            } catch (error) {
                setAlerta({ isOpen: true, message: `Erro ao ler o arquivo: ${error.message}` });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleStartValidation = (config) => {
        setImportConfig(config);
        setIsConfigModalOpen(false);
        validateData(parsedData, config);
    };

    const validateData = async (csvData, config) => {
        if (!tabelaSelecionada) { setAlerta({ isOpen: true, message: "Selecione uma tabela primeiro." }); return; }
        if (csvData.length === 0) { setAlerta({ isOpen: true, message: "O arquivo CSV está vazio." }); return; }

        try {
            const detailsRes = await fetch(`http://127.0.0.1:5000/api/tabelas/${tabelaSelecionada.value}/details`);
            const tableDetails = await detailsRes.json();
            if (!detailsRes.ok) throw new Error(tableDetails.message);

            const autoIncrementPK = tableDetails.find(col => col.pk && col.type === 'INTEGER');
            const tableColumns = tableDetails.map(col => col.name);
            const notNullColumns = tableDetails.filter(col => col.notnull && (!autoIncrementPK || col.name !== autoIncrementPK.name)).map(col => col.name);

            const existingDataRes = await fetch(`http://127.0.0.1:5000/api/tabelas/${tabelaSelecionada.value}?limit=all`);
            const existingData = await existingDataRes.json();
            if (!existingDataRes.ok) throw new Error(existingData.message);
            
            const existingKeys = new Set();
            if (config.check_mode === 'AND') {
                existingData.rows.forEach(row => {
                    const key = JSON.stringify(config.check_columns.map(col => row[col]));
                    existingKeys.add(key);
                });
            } else {
                existingData.rows.forEach(row => {
                    config.check_columns.forEach(col => {
                        const key = JSON.stringify({[col]: row[col]});
                        existingKeys.add(key);
                    });
                });
            }

            let existingRowsCount = 0;
            csvData.forEach(row => {
                if (config.check_mode === 'AND') {
                    const key = JSON.stringify(config.check_columns.map(col => row[col]));
                    if (existingKeys.has(key)) existingRowsCount++;
                } else {
                    const hasDuplicate = config.check_columns.some(col => {
                        const key = JSON.stringify({[col]: row[col]});
                        return existingKeys.has(key);
                    });
                    if (hasDuplicate) existingRowsCount++;
                }
            });

            const csvHeaders = Object.keys(csvData[0] || {});
            const extraColumns = csvHeaders.filter(h => !tableColumns.includes(h));
            const missingColumns = tableColumns.filter(c => (!autoIncrementPK || c !== autoIncrementPK.name) && !csvHeaders.includes(c));
            const missingRequired = missingColumns.filter(c => notNullColumns.includes(c));
            
            let emptyRequiredCount = 0;
            csvData.forEach(row => {
                if (notNullColumns.some(col => !row[col] && row[col] !== 0)) {
                    emptyRequiredCount++;
                }
            });

            setValidationSummary({
                totalRows: csvData.length, extraColumns, missingColumns, missingRequired,
                emptyRequiredCount, existingRowsCount, hasFatalError: missingRequired.length > 0 || emptyRequiredCount > 0
            });
            setIsValidationModalOpen(true);

        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro na validação: ${error.message}` });
        }
    };
    
    const handleConfirmImport = async () => {
        setIsImporting(true);
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/tabelas/${tabelaSelecionada.value}/insert-data-custom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: parsedData,
                    check_columns: importConfig.check_columns,
                    check_mode: importConfig.check_mode,
                    import_mode: importConfig.import_mode
                })
            });
            const result = await response.json();
            setAlerta({ isOpen: true, message: result.message });
            if (response.ok) {
                setPreviewData(null);
            }
        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro na importação: ${error.message}` });
        } finally {
            setIsImporting(false);
            setIsValidationModalOpen(false);
        }
    };

    const handleCriticalDeleteCancel = () => {
        setCriticalDeleteState({ isOpen: false, step: 1, tableName: '', userInput: '' });
    };

    const handleCriticalDeleteNextStep = () => {
        setCriticalDeleteState(prev => ({ ...prev, step: prev.step + 1, userInput: '' }));
    };

    const handleSaveCoreTables = async (updatedCoreTables) => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/db/core-tables', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ core_tables: updatedCoreTables })
            });
            const result = await response.json();
            setAlerta({ isOpen: true, message: result.message });
            if (response.ok) {
                fetchCoreTables();
            }
        } catch (error) {
            setAlerta({ isOpen: true, message: 'Erro ao salvar tabelas críticas.' });
        }
    };

    const handleOpenBackupManager = () => {
        setIsBackupModalOpen(true);
    };

    const handleInitiateBackupAction = (action, tables) => {
        if (tables.length === 0) {
            setAlerta({ isOpen: true, message: 'Nenhuma tabela selecionada.' });
            return;
        }
        setIsBackupModalOpen(false);
        setConfirmationBackupModal({ isOpen: true, action, tables });
    };

    const handleExecuteBackupAction = async () => {
        const { action, tables } = confirmationBackupModal;
        setConfirmationBackupModal({ isOpen: false, action: null, tables: [] });
        setIsProcessing(true);

        const endpoint = action === 'backup' ? 'executar-backup-sistema' : 'executar-restauracao-sistema';
        
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/db/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tabelas: tables })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Falha na operação.');
            
            setResultadoModal({ isOpen: true, data: result });

        } catch (err) {
            setResultadoModal({ isOpen: true, data: { tempo_execucao: '0s', erros: 1, detalhes: [{ tabela: "Geral", status: "error", mensagem_backup: err.message, detalhamento: "-" }] }});
        } finally {
            setIsProcessing(false);
        }
    };
    
    // NOVO: Handler para o menu de contexto
    const handleContextMenu = (event, tableName) => {
        event.preventDefault();
        setContextMenu({
            x: event.pageX,
            y: event.pageY,
            tableName: tableName
        });
    };


    return (
        <>
            {isProcessing && (
                <div className="processing-overlay">
                    <div className="spinner"></div>
                    <p>Processando...</p>
                </div>
            )}

            <BackupStatusContainer onContextMenu={handleContextMenu} onOpenBackupManager={handleOpenBackupManager} />

            <div className="card">
                <div className="user-edit-header">
                    <h3>Visualizar Estrutura de Tabela</h3>
                    <div className="header-actions">
                        <button className="admin-button" onClick={() => setIsCoreTablesModalOpen(true)}>
                            <i className="bi bi-shield-lock-fill"></i> Tabelas Críticas
                        </button>
                        {tabelaSelecionada && (
                            <>
                                <button className="admin-button" onClick={() => setIsQueryEditing(true)} disabled={isQueryEditing}>
                                    <i className="bi bi-pencil-square"></i> Editar Query
                                </button>
                                <button className="delete-button" onClick={handleInitiateDelete}>
                                    <i className="bi bi-trash-fill"></i> Excluir Tabela
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="filter-group">
                    <label htmlFor="table-select">Selecione uma Tabela:</label>
                    <Select
                        id="table-select"
                        options={listaTabelas}
                        value={tabelaSelecionada}
                        onChange={handleTabelaSelectChange}
                        isClearable
                        placeholder="Selecione uma tabela do banco de dados..."
                    />
                </div>
                <div className="filter-group">
                    <label>Query (CREATE TABLE):</label>
                    <textarea
                        className={`sql-textarea ${isQueryEditing ? 'editable' : ''}`}
                        value={isQueryEditing ? editedQuery : (isLoadingQuery ? 'Carregando Query...' : Query)}
                        readOnly={!isQueryEditing}
                        onChange={(e) => setEditedQuery(e.target.value)}
                        rows="8"
                    />
                    {tabelaSelecionada && !isQueryEditing && (
                        <div className="preview-button-container">
                            <button className="preview-button" onClick={handlePreview} disabled={isPreviewLoading}>
                                {previewData ? <i className="bi bi-eye-slash"></i> : <i className="bi bi-eye"></i>}
                                {isPreviewLoading ? 'Carregando...' : (previewData ? 'Ocultar Prévia' : 'Ver Prévia dos Dados')}
                            </button>
                            {previewData && (
                                <button className="preview-button" onClick={handleExpandPreview} disabled={isFullDataLoading}>
                                    {isFullDataLoading ? 'Carregando...' : <><i className="bi bi-arrows-fullscreen"></i> Expandir</>}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {isPreviewLoading && <p>Carregando prévia...</p>}
                {previewData && <PreviewTable data={previewData} />}

                {tabelaSelecionada && (
                <div>
                    <h3>Inserir Dados via CSV/XLSX</h3>
                    <p>Arraste um arquivo para a área abaixo ou clique para selecionar. Os dados serão validados antes da inserção.</p>
                    <div 
                        className="drop-zone-container"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleFileDrop}
                        onClick={() => fileInputRef.current.click()}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                            style={{ display: 'none' }}
                            onChange={handleFileSelect}
                            disabled={!tabelaSelecionada}
                        />
                        <i className="bi bi-cloud-arrow-up-fill"></i>
                        <p>{tabelaSelecionada ? 'Arraste o arquivo aqui ou clique para selecionar' : 'Selecione uma tabela acima primeiro'}</p>
                    </div>
                </div>
                )}

                
                {isQueryEditing && (
                    <div className="modal-footer" style={{ borderTop: 'none' }}>
                        <div></div>
                        <div className="footer-actions-right">
                            <button type="button" className="modal-button cancel" onClick={handleCancelEdit}>Cancelar</button>
                            <button type="button" className="save-button" onClick={handleInitiateSave}>
                                <i className="bi bi-check-circle"></i> Salvar Alterações
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="card">
                <h3>Criar Nova Tabela</h3>
                <p className="warning-text">
                    <i className="bi bi-exclamation-triangle-fill"></i>
                    <strong>Atenção:</strong> Tabelas criadas por aqui serão perdidas se o banco de dados for reiniciado via script.
                </p>
                <form onSubmit={handleCreateTable}>
                    <div className="user-form-grid">
                        <div className="filter-group">
                            <label>ID da Tabela (nome no sistema):</label>
                            <input name="id" value={formState.id} onChange={handleFormChange} placeholder="ex: minha_tabela_apoio" required />
                        </div>
                        <div className="filter-group">
                            <label>Nome de Exibição:</label>
                            <input name="tabela" value={formState.tabela} onChange={handleFormChange} placeholder="ex: Minha Tabela de Apoio" disabled={!formState.isEditable} required={formState.isEditable} />
                        </div>
                    </div>
                    <div className="filter-group" style={{ marginTop: '15px' }}>
                        <label className="checkbox-label-group" style={{ cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                name="isEditable"
                                checked={formState.isEditable}
                                onChange={handleFormChange}
                            />
                            <span>Incluir tabela nas tabelas editáveis (visível em "Tabelas de Apoio")</span>
                        </label>
                    </div>
                    <div className="filter-group">
                        <label>Query (CREATE TABLE):</label>
                        <textarea
                            name="query"
                            className="sql-textarea editable"
                            value={formState.query}
                            onChange={handleFormChange}
                            rows="8"
                            required
                        />
                    </div>
                    <div className="modal-footer" style={{ borderTop: 'none' }}>
                        <div></div>
                        <button type="submit" className="save-button" disabled={isCreating}>
                            <i className="bi bi-check-circle"></i> {isCreating ? 'Executando...' : 'Criar Tabela'}
                        </button>
                    </div>
                </form>
            </div>

            <ModalAlerta isOpen={alerta.isOpen} onClose={() => setAlerta({ isOpen: false, message: '' })} title="Notificação">
                <p>{alerta.message}</p>
            </ModalAlerta>

            <ModalConfirmacao
                isOpen={itemParaAcao.action === 'save'}
                onClose={() => setItemParaAcao({ action: null, data: null })}
                onConfirm={handleConfirmAction}
                title="Confirmar Alteração"
            >
                {queryChanges && (
                    <div className="schema-diff-container">
                        <p>Você tem certeza que deseja alterar o Query da tabela <strong>{itemParaAcao.data?.value}</strong>?</p>
                        {queryChanges.removed.length > 0 && <div className="diff-section"><h5>Colunas Removidas:</h5><pre className="diff-removed">{queryChanges.removed.join('\n')}</pre></div>}
                        {queryChanges.added.length > 0 && <div className="diff-section"><h5>Colunas Adicionadas:</h5><pre className="diff-added">{queryChanges.added.join('\n')}</pre></div>}
                        <p className="warning-text" style={{backgroundColor: '#fff3cd', color: '#856404', borderColor: '#ffeeba'}}>
                            <strong>Importante:</strong> Os dados de colunas com o mesmo nome serão preservados. Colunas removidas terão seus dados perdidos.
                        </p>
                    </div>
                )}
            </ModalConfirmacao>

            <ModalConfirmacao
                isOpen={itemParaAcao.action === 'delete'}
                onClose={() => setItemParaAcao({ action: null, data: null })}
                onConfirm={handleConfirmAction}
                title="Confirmar Exclusão"
            >
                <p>Você tem certeza que deseja excluir permanentemente a tabela <strong>{itemParaAcao.data?.value}</strong>?</p>
                <p>Esta operação não pode ser desfeita.</p>
            </ModalConfirmacao>


            {criticalDeleteState.isOpen && (
                <Modal isOpen={criticalDeleteState.isOpen} onClose={handleCriticalDeleteCancel} title=" ">
                    <div className="critical-delete-modal-content">
                        {criticalDeleteState.step === 1 && (
                            <>
                                <div className="modal-header modal-header-warning">
                                    <i className="bi bi-exclamation-triangle-fill"></i>
                                    <h3>ALERTA DE EXCLUSÃO CRÍTICA</h3>
                                </div>
                                <div className="modal-body">
                                    <i className="bi bi-exclamation-triangle-fill icon icon-warning"></i>
                                    <h4>Ação Perigosa Detectada</h4>
                                    <p>A tabela <strong>{criticalDeleteState.tableName}</strong> é um componente essencial do sistema.</p>
                                    <p>Sua exclusão pode causar <strong>danos irreversíveis</strong>.</p>
                                    <p>Prossiga apenas se você tiver <strong>absoluta certeza</strong> do que está fazendo.</p>
                                </div>
                                <div className="modal-footer">
                                    <button className="modal-button cancel" onClick={handleCriticalDeleteCancel}>Cancelar</button>
                                    <button className="modal-button confirm" style={{backgroundColor: '#ffc107', color: '#333'}} onClick={handleCriticalDeleteNextStep}>Eu entendo os riscos, prosseguir</button>
                                </div>
                            </>
                        )}
                        {criticalDeleteState.step === 2 && (
                             <>
                                <div className="modal-header modal-header-danger">
                                    <i className="bi bi-shield-fill-exclamation"></i>
                                    <h3>CONFIRMAÇÃO DE SEGURANÇA</h3>
                                </div>
                                <div className="modal-body">
                                    <i className="bi bi-shield-fill-exclamation icon icon-danger"></i>
                                    <h4>Confirmação Adicional Requerida</h4>
                                    <p>Para confirmar, digite o nome da tabela no campo abaixo: <strong>{criticalDeleteState.tableName}</strong></p>
                                    <input 
                                        type="text"
                                        className="confirm-input"
                                        value={criticalDeleteState.userInput}
                                        onChange={(e) => setCriticalDeleteState(prev => ({...prev, userInput: e.target.value}))}
                                    />
                                </div>
                                <div className="modal-footer">
                                    <button className="modal-button cancel" onClick={handleCriticalDeleteCancel}>Cancelar</button>
                                    <button 
                                        className="modal-button confirm" 
                                        style={{backgroundColor: '#dc3545'}}
                                        onClick={handleCriticalDeleteNextStep}
                                        disabled={criticalDeleteState.userInput !== criticalDeleteState.tableName}
                                    >
                                        Verificar e Prosseguir
                                    </button>
                                </div>
                            </>
                        )}
                         {criticalDeleteState.step === 3 && (
                             <>
                                <div className="modal-header modal-header-final">
                                    <i className="bi bi-skull"></i>
                                    <h3>EXCLUSÃO PERMANENTE</h3>
                                </div>
                                <div className="modal-body">
                                    <i className="bi bi-skull icon icon-skull"></i>
                                    <h4>Último Aviso. Sem volta.</h4>
                                    <p>Você está prestes a apagar permanentemente a tabela <strong>{criticalDeleteState.tableName}</strong> e todos os seus dados.</p>
                                    <p><strong>ESTA AÇÃO NÃO PODE SER DESFEITA.</strong></p>
                                </div>
                                <div className="modal-footer" style={{flexDirection: 'column', gap: '10px'}}>
                                    <button className="modal-button final-delete-btn" onClick={handleDeleteTable}>
                                        <i className="bi bi-trash-fill"></i> EU TENHO CERTEZA, EXCLUIR PERMANENTEMENTE
                                    </button>
                                    <button className="modal-button cancel" onClick={handleCriticalDeleteCancel}>Mudei de ideia, cancelar</button>
                                </div>
                            </>
                        )}
                    </div>
                </Modal>
            )}
            
            <ModalGerenciamentoCoreTables 
                isOpen={isCoreTablesModalOpen}
                onClose={() => setIsCoreTablesModalOpen(false)}
                onSave={handleSaveCoreTables}
            />

            {isConfigModalOpen && (
                <ModalConfiguracaoImportacao
                    isOpen={isConfigModalOpen}
                    onClose={() => setIsConfigModalOpen(false)}
                    onConfirm={handleStartValidation}
                    csvHeaders={Object.keys(parsedData[0] || {})}
                />
            )}

            {isValidationModalOpen && validationSummary && (
                <Modal
                    isOpen={isValidationModalOpen}
                    onClose={() => setIsValidationModalOpen(false)}
                    title={`Validação de Importação para: ${tabelaSelecionada?.label}`}
                    size="large"
                >
                    <div className="validation-summary">
                        <h4>Resumo da Validação ({validationSummary.totalRows} linhas no arquivo)</h4>
                        
                        {validationSummary.hasFatalError && (
                            <div className="validation-item error">
                                <i className="bi bi-x-circle-fill"></i>
                                <div>
                                    <strong>Erros Críticos Encontrados</strong>
                                    <p>A importação não pode continuar. Corrija os problemas no seu arquivo e tente novamente.</p>
                                </div>
                            </div>
                        )}

                        {validationSummary.missingRequired.length > 0 && (
                            <div className="validation-item error">
                                <i className="bi bi-exclamation-diamond-fill"></i>
                                <div>
                                    <strong>Colunas Obrigatórias Ausentes:</strong>
                                    <p>As seguintes colunas, que não podem ser nulas, estão faltando no seu arquivo: <strong>{validationSummary.missingRequired.join(', ')}</strong></p>
                                </div>
                            </div>
                        )}

                        {validationSummary.emptyRequiredCount > 0 && (
                            <div className="validation-item error">
                                <i className="bi bi-exclamation-diamond-fill"></i>
                                <div>
                                    <strong>Campos Obrigatórios Vazios:</strong>
                                    <p>Foram encontradas <strong>{validationSummary.emptyRequiredCount}</strong> linhas onde uma ou mais colunas obrigatórias (NOT NULL) estão vazias.</p>
                                </div>
                            </div>
                        )}

                        <div className="validation-item info">
                            <i className="bi bi-info-circle-fill"></i>
                            <div>
                                <strong>Linhas Duplicadas (com base na sua seleção):</strong>
                                <p><strong>{validationSummary.existingRowsCount}</strong> linhas do seu arquivo já existem no banco de dados e serão ignoradas.</p>
                            </div>
                        </div>

                        {validationSummary.extraColumns.length > 0 && (
                            <div className="validation-item warning">
                                <i className="bi bi-exclamation-triangle-fill"></i>
                                <div>
                                    <strong>Colunas Extras Ignoradas:</strong>
                                    <p>As seguintes colunas existem no seu arquivo mas não na tabela, e serão ignoradas: <strong>{validationSummary.extraColumns.join(', ')}</strong></p>
                                </div>
                            </div>
                        )}

                        {validationSummary.missingColumns.length > 0 && (
                            <div className="validation-item info">
                                <i className="bi bi-info-circle-fill"></i>
                                <div>
                                    <strong>Colunas Ausentes (Opcionais):</strong>
                                    <p>As seguintes colunas da tabela não foram encontradas no seu arquivo e serão preenchidas com valores vazios (NULL): <strong>{validationSummary.missingColumns.join(', ')}</strong></p>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="modal-footer">
                        <div></div>
                        <div>
                            <button type="button" className="modal-button cancel" onClick={() => setIsValidationModalOpen(false)}>Cancelar</button>
                            <button 
                                type="button" 
                                className="modal-button confirm" 
                                style={{backgroundColor: '#27ae60'}} 
                                onClick={() => setItemParaAcao({ action: 'import', data: null })}
                                disabled={validationSummary.hasFatalError || isImporting}
                            >
                                {isImporting ? 'Importando...' : 'Confirmar e Inserir Dados'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
            <ModalConfirmacao
                isOpen={itemParaAcao.action === 'import'}
                onClose={() => setItemParaAcao({ action: null, data: null })}
                onConfirm={handleConfirmAction}
                title="Confirmar Importação"
            >
                <p>Você confirma a inserção dos dados na tabela <strong>{tabelaSelecionada?.label}</strong>? As linhas duplicadas e colunas extras serão ignoradas.</p>
            </ModalConfirmacao>

            {fullTableData && (
                 <TableModal 
                    isOpen={isPreviewModalOpen}
                    onClose={() => setIsPreviewModalOpen(false)}
                    title={`Visualização Completa: ${tabelaSelecionada?.label}`}
                    columns={fullTableData.columns}
                    rows={fullTableData.rows}
                />
            )}

            <ModalGerenciarBackup
                isOpen={isBackupModalOpen}
                onClose={() => setIsBackupModalOpen(false)}
                onExecuteAction={handleInitiateBackupAction}
                coreTablesList={coreTablesList}
            />
            <ModalConfirmacaoBackup
                isOpen={confirmationBackupModal.isOpen}
                onClose={() => setConfirmationBackupModal({ isOpen: false, action: null, tables: [] })}
                onConfirm={handleExecuteBackupAction}
                action={confirmationBackupModal.action}
                selectedTables={confirmationBackupModal.tables}
                coreTablesList={coreTablesList}
            />
            <ModalResultadoProcesso 
                isOpen={resultadoModal.isOpen} 
                onClose={() => setResultadoModal({ isOpen: false, data: null })} 
                resultado={resultadoModal.data} 
            />
            
            {/* NOVO: Renderização do Menu de Contexto */}
            <ContextMenu
                menuPosition={contextMenu}
                onClose={() => setContextMenu(null)}
                options={[
                    { label: "Fazer Backup", icon: "bi-save", action: () => handleInitiateBackupAction('backup', [contextMenu.tableName]) },
                    { label: "Restaurar Backup", icon: "bi-arrow-counterclockwise", action: () => handleInitiateBackupAction('restore', [contextMenu.tableName]), className: 'restore' }
                ]}
            />
        </>
    );
};

export default GerenciamentoDB;