import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import Modal from '../../components/Modal.jsx';
import ModalAlerta from '../../components/ModalAlerta.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';

// --- NOVO COMPONENTE: Modal para Geração do Calendário ---
const ModalGerarCalendario = ({ isOpen, onClose, onSucesso }) => {
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGerar = async () => {
        if (!dataInicio || !dataFim) {
            setError('Ambas as datas são obrigatórias.');
            return;
        }
        if (new Date(dataInicio) > new Date(dataFim)) {
            setError('A data de início não pode ser posterior à data de fim.');
            return;
        }
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('http://127.0.0.1:5000/api/tabelas/calendario/gerar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data_inicio: dataInicio, data_fim: dataFim })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            onSucesso(result.message); // Passa a mensagem de sucesso para o pai
        } catch (err) {
            setError(`Erro ao gerar calendário: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerar Calendário Corporativo">
            <p>Selecione o intervalo de datas para gerar o calendário. Os dados existentes serão substituídos.</p>
            <div className="user-form-grid">
                <div className="filter-group">
                    <label>Data de Início:</label>
                    <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </div>
                <div className="filter-group">
                    <label>Data de Fim:</label>
                    <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                </div>
            </div>
            {error && <p className="error-message" style={{marginTop: '15px'}}>{error}</p>}
            <div className="modal-footer">
                <div></div>
                <div>
                    <button type="button" className="modal-button cancel" onClick={onClose}>Cancelar</button>
                    <button type="button" className="modal-button confirm" onClick={handleGerar} disabled={isLoading} style={{backgroundColor: '#27ae60'}}>
                        {isLoading ? 'A gerar...' : 'Gerar Calendário'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};


// --- Componente principal para a aba de Tabelas de Apoio ---
const GerenciamentoTabelas = ({ currentUser }) => {
    const [listaTabelas, setListaTabelas] = useState([]);
    const [tabelaSelecionada, setTabelaSelecionada] = useState(null);
    const [colunas, setColunas] = useState([]);
    const [linhas, setLinhas] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // **NOVO ESTADO: Armazena a informação da chave primária**
    const [pkInfo, setPkInfo] = useState(null);

    const [isModalEdicaoAberto, setIsModalEdicaoAberto] = useState(false);
    const [isModalCalendarioAberto, setIsModalCalendarioAberto] = useState(false);
    
    const [linhasEditadas, setLinhasEditadas] = useState([]);
    const [editingCell, setEditingCell] = useState({ rowIndex: null, colKey: null });
    const [hoveredRow, setHoveredRow] = useState(null);
    const [showInsertPreview, setShowInsertPreview] = useState(false);

    const [alerta, setAlerta] = useState({ isOpen: false, message: '' });
    const [modalSalvarAberto, setModalSalvarAberto] = useState(false);

    const canEdit = hasPermission(currentUser, 'cadastros_tabelas_editar');
    const selectStyles = { menu: (provided) => ({ ...provided, zIndex: 9999 }) };

    const fetchDataTabela = async (tabela) => {
        if (!tabela) return;
        setIsLoading(true);
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/tabelas/${tabela.value}`);
            if (!response.ok) throw new Error(`Falha ao carregar dados: ${response.statusText}`);
            const data = await response.json();
            
            // **ATUALIZAÇÃO: Captura a informação da chave primária da API**
            const { columns: columnNames, rows: rowData, pk_info } = data;
            setLinhas(rowData || []);
            setPkInfo(pk_info); // Armazena a info da PK no estado

            if (columnNames && columnNames.length > 0) {
                const colunasDefinidas = columnNames.map(key => ({
                    key: key,
                    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                }));
                setColunas(colunasDefinidas);
            } else {
                setColunas([]);
            }
        } catch (error) {
            console.error(`Erro ao buscar dados da tabela ${tabela.value}:`, error);
            setColunas([]); setLinhas([]); setPkInfo(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const fetchListaTabelas = async () => {
            try {
                const response = await fetch('http://127.0.0.1:5000/api/tabelas');
                const data = await response.json();
                const options = data.map(t => ({ value: t.id, label: t.tabela }));
                setListaTabelas(options);
                if (options.length > 0) {
                    setTabelaSelecionada(options[0]);
                    fetchDataTabela(options[0]);
                } else {
                    setIsLoading(false);
                }
            } catch (error) {
                console.error("Erro ao buscar lista de tabelas:", error);
                setIsLoading(false);
            }
        };
        fetchListaTabelas();
    }, []);

    const handleTabelaSelectChange = (tabela) => {
        setTabelaSelecionada(tabela);
        fetchDataTabela(tabela);
    };

    const handleAbrirModal = () => {
        if (!tabelaSelecionada) return;
        if (tabelaSelecionada.value === 'calendario') {
            setIsModalCalendarioAberto(true);
        } else {
            setLinhasEditadas(JSON.parse(JSON.stringify(linhas)));
            setEditingCell({ rowIndex: null, colKey: null });
            setIsModalEdicaoAberto(true);
        }
    };

    const handleSucessoCalendario = (mensagem) => {
        setIsModalCalendarioAberto(false);
        setAlerta({ isOpen: true, message: mensagem });
        fetchDataTabela(tabelaSelecionada);
    };

    const handleSalvarClick = () => setModalSalvarAberto(true);

    const handleConfirmarSalvar = async () => {
        setModalSalvarAberto(false);
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/tabelas/${tabelaSelecionada.value}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(linhasEditadas)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ isOpen: true, message: result.message });
            setLinhas(linhasEditadas);
            setIsModalEdicaoAberto(false);
        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro ao salvar: ${error.message}` });
        }
    };

    const handleAdicionarLinha = () => {
        const hasIdColumn = colunas.some(col => col.key === 'id');
        let novaLinha = {};

        // Apenas preenche o ID se for auto-incremento
        if (hasIdColumn && pkInfo && pkInfo.type === 'INTEGER') {
            const maxId = linhasEditadas.reduce((max, row) => {
                const currentId = parseInt(row.id, 10);
                return !isNaN(currentId) && currentId > max ? currentId : max;
            }, 0);
            const novoId = maxId + 1;
            
            novaLinha = colunas.reduce((acc, col) => {
                acc[col.key] = col.key === 'id' ? novoId : '';
                return acc;
            }, {});
        } else {
            novaLinha = colunas.reduce((acc, col) => ({ ...acc, [col.key]: '' }), {});
        }

        setLinhasEditadas([...linhasEditadas, novaLinha]);
    };

    // **ATUALIZAÇÃO: Lógica de clique na célula agora usa a informação da PK**
    const handleCellClick = (rowIndex, colKey) => {
        // Bloqueia a edição se a coluna for a chave primária E o tipo for INTEGER
        if (pkInfo && colKey === pkInfo.name && pkInfo.type === 'INTEGER') {
            return;
        }
        setEditingCell({ rowIndex, colKey });
    };

    const handleCellChange = (e, rowIndex, colKey) => {
        const novasLinhas = [...linhasEditadas];
        novasLinhas[rowIndex][colKey] = e.target.value;
        setLinhasEditadas(novasLinhas);
    };

    const handleExcluirLinha = (rowIndex) => {
        const novasLinhas = linhasEditadas.filter((_, index) => index !== rowIndex);
        setLinhasEditadas(novasLinhas);
    };
    
    function hasPermission(user, permission) {
        if (!user || !user.permissoes) return false;
        if (user.perfil_id === 'master_admin') return true;
        return user.permissoes.includes(permission);
    }

    return (
        <>
            <div className="card">
                <div className="admin-actions-bar">
                    <div className="filter-group" style={{ flexGrow: '0.5' }}>
                        <label htmlFor="table-select">Selecione uma Tabela de Apoio:</label>
                        <Select
                            id="table-select"
                            options={listaTabelas}
                            value={tabelaSelecionada}
                            onChange={handleTabelaSelectChange}
                            styles={selectStyles}
                        />
                    </div>
                    {canEdit && (
                        <button className="admin-button" onClick={handleAbrirModal}>
                            <i className="bi bi-pencil-square"></i> Alterar Dados
                        </button>
                    )}
                </div>

                <div className="table-container" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                    {isLoading ? <p>A carregar dados...</p> : (
                        linhas.length > 0 && colunas.length > 0 ? (
                            <table className="simple-data-table">
                                <thead>
                                    <tr>
                                        {colunas.map(col => <th key={col.key}>{col.name}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {linhas.map((row, rowIndex) => (
                                        <tr key={row.id || row.data || rowIndex}>
                                            {colunas.map(col => <td key={col.key}>{String(row[col.key] ?? '')}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p style={{ padding: '20px', textAlign: 'center' }}>A tabela está vazia ou não foi possível carregar os dados.</p>
                        )
                    )}
                </div>
            </div>

            <Modal isOpen={isModalEdicaoAberto} onClose={() => setIsModalEdicaoAberto(false)} title={`A editar: ${tabelaSelecionada?.label}`} size="xl">
                <div className="table-container editable-container" style={{ height: '60vh' }}>
                    <table className="simple-data-table editable">
                        <thead>
                            <tr>
                                {colunas.map(col => <th key={col.key}>{col.name}</th>)}
                                <th className="action-column"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {linhasEditadas.map((row, rowIndex) => {
                                // **ATUALIZAÇÃO: Determina se a célula da PK deve ser somente leitura**
                                const isPkReadonly = (colKey) => pkInfo && colKey === pkInfo.name && pkInfo.type === 'INTEGER';

                                return (
                                    <tr 
                                        key={row.id || rowIndex}
                                        onMouseEnter={() => setHoveredRow(rowIndex)}
                                        onMouseLeave={() => setHoveredRow(null)}
                                    >
                                        {colunas.map(col => (
                                            <td 
                                                key={col.key} 
                                                onClick={() => handleCellClick(rowIndex, col.key)}
                                                className={isPkReadonly(col.key) ? 'readonly-cell' : ''}
                                            >
                                                {editingCell.rowIndex === rowIndex && editingCell.colKey === col.key && !isPkReadonly(col.key) ? (
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
                                );
                            })}
                            {showInsertPreview && (
                                <tr className="insert-preview-row">
                                    <td colSpan={colunas.length + 1}></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    <button 
                        className="add-row-btn" 
                        onClick={handleAdicionarLinha}
                        onMouseEnter={() => setShowInsertPreview(true)}
                        onMouseLeave={() => setShowInsertPreview(false)}
                    >
                        +
                    </button>
                </div>
                <div className="modal-footer">
                    <div></div>
                    <div>
                        <button type="button" className="modal-button cancel" onClick={() => setIsModalEdicaoAberto(false)}>Cancelar</button>
                        <button type="button" className="modal-button confirm" style={{ backgroundColor: '#27ae60' }} onClick={handleSalvarClick}>Salvar Alterações</button>
                    </div>
                </div>
            </Modal>
            
            <ModalGerarCalendario 
                isOpen={isModalCalendarioAberto}
                onClose={() => setIsModalCalendarioAberto(false)}
                onSucesso={handleSucessoCalendario}
            />

            <ModalConfirmacao
                isOpen={modalSalvarAberto}
                onClose={() => setModalSalvarAberto(false)}
                onConfirm={handleConfirmarSalvar}
                title="Confirmar Alterações"
            >
                <p>Você tem certeza que deseja salvar todas as alterações feitas nesta tabela?</p>
                <p>Linhas adicionadas, editadas e excluídas serão salvas permanentemente.</p>
            </ModalConfirmacao>

            <ModalAlerta isOpen={alerta.isOpen} onClose={() => setAlerta({ isOpen: false, message: '' })} title="Notificação">
                <p>{alerta.message}</p>
            </ModalAlerta>
        </>
    );
};

export default GerenciamentoTabelas;
