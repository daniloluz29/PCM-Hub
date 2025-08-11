    import React, { useState, useEffect, useRef } from 'react';
    import Select from 'react-select';
    import Modal from '../../components/Modal.jsx';
    import ModalAlerta from '../../components/ModalAlerta.jsx';
    import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';
    import { read, utils } from 'xlsx';

    // Função auxiliar para extrair definições de colunas de uma query CREATE TABLE
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

    // Componente para renderizar a tabela de pré-visualização
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

    // NOVO: Modal para configurar a verificação de duplicatas
    const ModalConfiguracaoImportacao = ({ isOpen, onClose, onConfirm, csvHeaders }) => {
        const [selectedColumns, setSelectedColumns] = useState([]);
        const [checkMode, setCheckMode] = useState('AND'); // 'AND' para mútua, 'OR' para individual

        const handleColumnToggle = (colName) => {
            setSelectedColumns(prev => 
                prev.includes(colName) ? prev.filter(c => c !== colName) : [...prev, colName]
            );
        };

        const handleConfirm = () => {
            if (selectedColumns.length === 0) {
                alert('Selecione pelo menos uma coluna para verificação de duplicatas.');
                return;
            }
            onConfirm({
                check_columns: selectedColumns,
                check_mode: checkMode
            });
        };

        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Configurar Verificação de Duplicatas">
                <div className="import-config-container">
                    <div className="filter-group">
                        <label>1. Selecione as colunas para verificar duplicatas:</label>
                        <div className="column-checkbox-list">
                            {csvHeaders.map(header => (
                                <label key={header} className="checkbox-label-group">
                                    <input
                                        type="checkbox"
                                        checked={selectedColumns.includes(header)}
                                        onChange={() => handleColumnToggle(header)}
                                    />
                                    <span>{header}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="filter-group">
                        <label>2. Escolha o modo de verificação:</label>
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
        const [formState, setFormState] = useState({
            id: '',
            tabela: '',
            query: 'CREATE TABLE nome_da_tabela (\n  id INTEGER PRIMARY KEY,\n  nome TEXT NOT NULL,\n  valor REAL\n);',
            isEditable: false
        });
        const [isCreating, setIsCreating] = useState(false);
        const [alerta, setAlerta] = useState({ isOpen: false, message: '' });
        const [itemParaAcao, setItemParaAcao] = useState({ action: null, data: null });

        // Estados para importação de dados
        const fileInputRef = useRef(null);
        const [validationSummary, setValidationSummary] = useState(null);
        const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
        const [parsedData, setParsedData] = useState([]);
        const [isImporting, setIsImporting] = useState(false);
        const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
        const [importConfig, setImportConfig] = useState(null);

        const fetchListaTabelas = async () => {
            try {
                const response = await fetch('http://127.0.0.1:5000/api/db/all-tables');
                const data = await response.json();
                setListaTabelas(data);
            } catch (error) {
                setAlerta({ isOpen: true, message: 'Erro ao buscar lista de tabelas.' });
            }
        };

        useEffect(() => { fetchListaTabelas(); }, []);

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

        const handleDeleteTable = async () => {
            setIsLoadingQuery(true);
            try {
                const response = await fetch(`http://127.0.0.1:5000/api/tabelas/${itemParaAcao.data.value}`, {
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

        // --- LÓGICA DE IMPORTAÇÃO DE DADOS ---
        const handleFileDrop = (e) => { 
            e.preventDefault(); 
            if (e.dataTransfer.files.length > 0) 
                processFile(e.dataTransfer.files[0]); 
        };
        const handleFileSelect = (e) => { 
            if (e.target.files.length > 0) 
                processFile(e.target.files[0]); 
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
                    const jsonData = utils.sheet_to_json(worksheet);
                    setParsedData(jsonData);
                    setIsConfigModalOpen(true); // Abre o modal de configuração
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
                } else { // OR mode
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
                    } else { // OR mode
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
                const response = await fetch(`http://127.0.0.1:5000/api/tabelas/${tabelaSelecionada.value}/insert-data`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parsedData)
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


        return (
            <>
                <div className="card">
                    <div className="user-edit-header">
                        <h3>Visualizar Estrutura de Tabela</h3>
                        {tabelaSelecionada && (
                            <div className="header-actions">
                                <button className="admin-button" onClick={() => setIsQueryEditing(true)} disabled={isQueryEditing}>
                                    <i className="bi bi-pencil-square"></i> Editar Query
                                </button>
                                <button className="delete-button" onClick={() => setItemParaAcao({ action: 'delete', data: tabelaSelecionada })}>
                                    <i className="bi bi-trash-fill"></i> Excluir Tabela
                                </button>
                            </div>
                        )}
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
                            </div>
                        )}
                    </div>

                    {isPreviewLoading && <p>Carregando prévia...</p>}
                    {previewData && <PreviewTable data={previewData} />}

                    {tabelaSelecionada && (
                    <div>
                        <h3>Inserir Dados via CSV</h3>
                        <p>Arraste um arquivo CSV para a área abaixo ou clique para selecionar. Os dados serão validados antes da inserção.</p>
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
                            <p>{tabelaSelecionada ? 'Arraste o arquivo CSV/XLSX aqui ou clique para selecionar' : 'Selecione uma tabela acima primeiro'}</p>
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
                            {formState.isEditable && (
                                <div className="filter-group">
                                    <label>Nome de Exibição:</label>
                                    <input name="tabela" value={formState.tabela} onChange={handleFormChange} placeholder="ex: Minha Tabela de Apoio" required={formState.isEditable} />
                                </div>
                            )}
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

                {/* Modal de Confirmação para Salvar/Excluir Query */}
                <ModalConfirmacao
                    isOpen={!!itemParaAcao.action && itemParaAcao.action !== 'import'}
                    onClose={() => setItemParaAcao({ action: null, data: null })}
                    onConfirm={handleConfirmAction}
                    title={`Confirmar ${itemParaAcao.action === 'save' ? 'Alteração' : 'Exclusão'}`}
                >
                {itemParaAcao.action === 'save' && queryChanges && (
                    <div className="schema-diff-container">
                        <p>Você tem certeza que deseja alterar o Query da tabela <strong>{itemParaAcao.data?.value}</strong>?</p>
                        
                        {queryChanges.removed.length > 0 && (
                            <div className="diff-section">
                                <h5>Colunas Removidas:</h5>
                                <pre className="diff-removed">
                                    {queryChanges.removed.join('\n')}
                                </pre>
                            </div>
                        )}
                        
                        {queryChanges.added.length > 0 && (
                             <div className="diff-section">
                                <h5>Colunas Adicionadas:</h5>
                                <pre className="diff-added">
                                    {queryChanges.added.join('\n')}
                                </pre>
                            </div>
                        )}

                        <p className="warning-text" style={{backgroundColor: '#fff3cd', color: '#856404', borderColor: '#ffeeba'}}>
                            <strong>Importante:</strong> Os dados de colunas com o mesmo nome serão preservados. Colunas removidas terão seus dados perdidos.
                        </p>
                    </div>
                )}
                 {itemParaAcao.action === 'delete' && (
                    <>
                        <p>Você tem certeza que deseja excluir permanentemente a tabela <strong>{itemParaAcao.data?.value}</strong>?</p>
                        <p>Esta operação não pode ser desfeita.</p>
                    </>
                )}
                </ModalConfirmacao>

                {/* NOVO: Modal de Configuração de Importação */}
                {isConfigModalOpen && (
                    <ModalConfiguracaoImportacao
                        isOpen={isConfigModalOpen}
                        onClose={() => setIsConfigModalOpen(false)}
                        onConfirm={handleStartValidation}
                        csvHeaders={Object.keys(parsedData[0] || {})}
                    />
                )}

                {/* Modal de Validação para Importação */}
                {isValidationModalOpen && validationSummary && (
                    <Modal
                        isOpen={isValidationModalOpen}
                        onClose={() => setIsValidationModalOpen(false)}
                        title={`Validação de Importação para: ${tabelaSelecionada.label}`}
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
            </>
        );
    };

    export default GerenciamentoDB;
