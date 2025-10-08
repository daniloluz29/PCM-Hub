import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import Modal from '../../components/Modal.jsx';
import ModalAlerta from '../../components/ModalAlerta.jsx';
import ModalConfirmacao from '../../components/ModalConfirmacao.jsx';

// --- COMPONENTE: Modal para Geração do Calendário ---
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
            onSucesso(result.message);
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
                        {isLoading ? 'Gerando...' : 'Gerar Calendário'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// --- NOVO COMPONENTE: Modal para Gerenciar a Lista de Tabelas de Apoio ---
const ModalGerenciarTabelasApoio = ({ isOpen, onClose, onSave }) => {
    const [linhas, setLinhas] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingCell, setEditingCell] = useState({ rowIndex: null, colKey: null });
    const [hoveredRow, setHoveredRow] = useState(null);
    const [showInsertPreview, setShowInsertPreview] = useState(false);
    const [modalConfirmarAberto, setModalConfirmarAberto] = useState(false);

    const colunas = [
        { key: 'id', name: 'ID da Tabela (Sistema)' },
        { key: 'tabela', name: 'Nome de Exibição (Menu)' }
    ];

    useEffect(() => {
        if (isOpen) {
            const fetchData = async () => {
                setIsLoading(true);
                try {
                    const response = await fetch('http://127.0.0.1:5000/api/tabelas/tabelas');
                    const data = await response.json();
                    setLinhas(data.rows || []);
                } catch (error) {
                    console.error("Erro ao buscar a lista de tabelas de apoio:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchData();
        }
    }, [isOpen]);

    const handleCellChange = (e, rowIndex, colKey) => {
        const novasLinhas = [...linhas];
        novasLinhas[rowIndex][colKey] = e.target.value;
        setLinhas(novasLinhas);
    };

    const handleAdicionarLinha = () => {
        setLinhas([...linhas, { id: '', tabela: '' }]);
    };

    const handleExcluirLinha = (rowIndex) => {
        setLinhas(linhas.filter((_, index) => index !== rowIndex));
    };

    const handleSalvar = () => {
        onSave(linhas);
        setModalConfirmarAberto(false);
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Tabelas de Apoio" size="large">
                <div className="table-container editable-container" style={{ height: '60vh' }}>
                    {isLoading ? <p>Carregando...</p> : (
                        <table className="simple-data-table editable">
                            <thead>
                                <tr>
                                    {colunas.map(col => <th key={col.key}>{col.name}</th>)}
                                    <th className="action-column"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {linhas.map((row, rowIndex) => (
                                    <tr 
                                        key={rowIndex}
                                        onMouseEnter={() => setHoveredRow(rowIndex)}
                                        onMouseLeave={() => setHoveredRow(null)}
                                    >
                                        {colunas.map(col => (
                                            <td key={col.key} onClick={() => setEditingCell({ rowIndex, colKey: col.key })}>
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
                                {showInsertPreview && <tr className="insert-preview-row"><td colSpan={colunas.length + 1}></td></tr>}
                            </tbody>
                        </table>
                    )}
                    <button 
                        className="add-row-btn" 
                        onClick={handleAdicionarLinha}
                        onMouseEnter={() => setShowInsertPreview(true)}
                        onMouseLeave={() => setShowInsertPreview(false)}
                    >+</button>
                </div>
                <div className="modal-footer">
                    <div></div>
                    <div>
                        <button type="button" className="modal-button cancel" onClick={onClose}>Cancelar</button>
                        <button type="button" className="modal-button confirm" style={{ backgroundColor: '#27ae60' }} onClick={() => setModalConfirmarAberto(true)}>Salvar Alterações</button>
                    </div>
                </div>
            </Modal>
            <ModalConfirmacao
                isOpen={modalConfirmarAberto}
                onClose={() => setModalConfirmarAberto(false)}
                onConfirm={handleSalvar}
                title="Confirmar Alterações"
            >
                <p>Você tem certeza que deseja salvar as alterações na lista de tabelas de apoio?</p>
            </ModalConfirmacao>
        </>
    );
};


// --- Componente principal ---
const GerenciamentoTabelas = ({ currentUser }) => {
    const [listaTabelas, setListaTabelas] = useState([]);
    const [tabelaSelecionada, setTabelaSelecionada] = useState(null);
    const [colunas, setColunas] = useState([]);
    const [linhas, setLinhas] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [pkInfo, setPkInfo] = useState(null);
    const [isModalEdicaoAberto, setIsModalEdicaoAberto] = useState(false);
    const [isModalCalendarioAberto, setIsModalCalendarioAberto] = useState(false);
    const [isModalTabelasApoioAberto, setIsModalTabelasApoioAberto] = useState(false); // NOVO ESTADO
    const [linhasEditadas, setLinhasEditadas] = useState([]);
    const [editingCell, setEditingCell] = useState({ rowIndex: null, colKey: null });
    const [hoveredRow, setHoveredRow] = useState(null);
    const [showInsertPreview, setShowInsertPreview] = useState(false);
    const [alerta, setAlerta] = useState({ isOpen: false, message: '' });
    const [modalSalvarAberto, setModalSalvarAberto] = useState(false);

    const canEdit = hasPermission(currentUser, 'cadastros_tabelas_editar');
    const selectStyles = { menu: (provided) => ({ ...provided, zIndex: 9999 }) };

    const fetchListaTabelas = async () => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/tabelas');
            const data = await response.json();
            const options = data.map(t => ({ value: t.id, label: t.tabela }));
            setListaTabelas(options);
            if (options.length > 0 && !tabelaSelecionada) {
                setTabelaSelecionada(options[0]);
            } else if (options.length === 0) {
                setTabelaSelecionada(null);
            }
        } catch (error) {
            console.error("Erro ao buscar lista de tabelas:", error);
        }
    };

    const fetchDataTabela = async (tabela) => {
        if (!tabela) {
            setColunas([]);
            setLinhas([]);
            setIsLoading(false);
            return;
        };
        setIsLoading(true);
        try {
            const response = await fetch(`http://127.0.0.1:5000/api/tabelas/${tabela.value}`);
            if (!response.ok) throw new Error(`Falha ao carregar dados: ${response.statusText}`);
            const data = await response.json();
            const { columns: columnNames, rows: rowData, pk_info } = data;
            setLinhas(rowData || []);
            setPkInfo(pk_info);
            if (columnNames && columnNames.length > 0) {
                setColunas(columnNames.map(key => ({ key, name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) })));
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
        fetchListaTabelas();
    }, []);

    useEffect(() => {
        fetchDataTabela(tabelaSelecionada);
    }, [tabelaSelecionada]);

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
        if (hasIdColumn && pkInfo && pkInfo.type === 'INTEGER') {
            const maxId = linhasEditadas.reduce((max, row) => Math.max(max, parseInt(row.id, 10) || 0), 0);
            novaLinha = colunas.reduce((acc, col) => ({ ...acc, [col.key]: col.key === 'id' ? maxId + 1 : '' }), {});
        } else {
            novaLinha = colunas.reduce((acc, col) => ({ ...acc, [col.key]: '' }), {});
        }
        setLinhasEditadas([...linhasEditadas, novaLinha]);
    };

    const handleCellClick = (rowIndex, colKey) => {
        if (pkInfo && colKey === pkInfo.name && pkInfo.type === 'INTEGER') return;
        setEditingCell({ rowIndex, colKey });
    };

    const handleCellChange = (e, rowIndex, colKey) => {
        const novasLinhas = [...linhasEditadas];
        novasLinhas[rowIndex][colKey] = e.target.value;
        setLinhasEditadas(novasLinhas);
    };

    const handleExcluirLinha = (rowIndex) => {
        setLinhasEditadas(linhasEditadas.filter((_, index) => index !== rowIndex));
    };
    
    // NOVO: Função para salvar a lista de tabelas de apoio
    const handleSaveTabelasApoio = async (editedData) => {
        try {
            const response = await fetch('http://127.0.0.1:5000/api/tabelas/tabelas', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editedData)
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            setAlerta({ isOpen: true, message: result.message });
            setIsModalTabelasApoioAberto(false);
            fetchListaTabelas(); // Atualiza o dropdown principal
        } catch (error) {
            setAlerta({ isOpen: true, message: `Erro ao salvar: ${error.message}` });
        }
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
                    <div className="filter-group" style={{ width: '500px' }}>
                        <label htmlFor="table-select">Selecione uma Tabela de Apoio:</label>
                        <Select
                            id="table-select"
                            options={listaTabelas}
                            value={tabelaSelecionada}
                            onChange={setTabelaSelecionada}
                            styles={selectStyles}
                        />
                    </div>
                    {canEdit && (
                        <div className="header-actions" style={{ width: '370px', columnCount: 2,  gap: '10px' }}>
                                <button className="admin-button" onClick={() => setIsModalTabelasApoioAberto(true)}>
                                    <i className="bi bi-pencil-fill"></i> Tabelas de Apoio
                                </button>
                                <button className="admin-button" onClick={handleAbrirModal} disabled={!tabelaSelecionada}>
                                    <i className="bi bi-pencil-square"></i> Alterar Dados
                                </button>
                            </div>
                    )}
                </div>

                <div className="table-container" style={{ maxHeight: 'calc(100vh - 400px)' }}>
                    {isLoading ? <p>Carregando dados...</p> : (
                        linhas.length > 0 && colunas.length > 0 ? (
                            <table className="simple-data-table">
                                <thead>
                                    <tr>{colunas.map(col => <th key={col.key}>{col.name}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {linhas.map((row, rowIndex) => (
                                        <tr key={row.id || row.data || rowIndex}>
                                            {colunas.map(col => <td key={col.key}>{String(row[col.key] ?? '')}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : <p style={{ padding: '20px', textAlign: 'center' }}>A tabela está vazia ou não foi possível carregar os dados.</p>
                    )}
                </div>
            </div>

            <Modal isOpen={isModalEdicaoAberto} onClose={() => setIsModalEdicaoAberto(false)} title={`Editando: ${tabelaSelecionada?.label}`} size="xl">
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
                                const isPkReadonly = (colKey) => pkInfo && colKey === pkInfo.name && pkInfo.type === 'INTEGER';
                                return (
                                    <tr key={row.id || rowIndex} onMouseEnter={() => setHoveredRow(rowIndex)} onMouseLeave={() => setHoveredRow(null)}>
                                        {colunas.map(col => (
                                            <td key={col.key} onClick={() => handleCellClick(rowIndex, col.key)} className={isPkReadonly(col.key) ? 'readonly-cell' : ''}>
                                                {editingCell.rowIndex === rowIndex && editingCell.colKey === col.key && !isPkReadonly(col.key) ? (
                                                    <input type="text" value={String(row[col.key] ?? '')} onChange={(e) => handleCellChange(e, rowIndex, col.key)} onBlur={() => setEditingCell({ rowIndex: null, colKey: null })} autoFocus />
                                                ) : ( String(row[col.key] ?? '') )}
                                            </td>
                                        ))}
                                        <td className="action-column">
                                            {hoveredRow === rowIndex && (
                                                <button className="delete-row-btn" onClick={() => handleExcluirLinha(rowIndex)}><i className="bi bi-trash"></i></button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {showInsertPreview && <tr className="insert-preview-row"><td colSpan={colunas.length + 1}></td></tr>}
                        </tbody>
                    </table>
                    <button className="add-row-btn" onClick={handleAdicionarLinha} onMouseEnter={() => setShowInsertPreview(true)} onMouseLeave={() => setShowInsertPreview(false)}>+</button>
                </div>
                <div className="modal-footer">
                    <div></div>
                    <div>
                        <button type="button" className="modal-button cancel" onClick={() => setIsModalEdicaoAberto(false)}>Cancelar</button>
                        <button type="button" className="modal-button confirm" style={{ backgroundColor: '#27ae60' }} onClick={() => setModalSalvarAberto(true)}>Salvar Alterações</button>
                    </div>
                </div>
            </Modal>
            
            <ModalGerarCalendario isOpen={isModalCalendarioAberto} onClose={() => setIsModalCalendarioAberto(false)} onSucesso={handleSucessoCalendario} />
            <ModalGerenciarTabelasApoio isOpen={isModalTabelasApoioAberto} onClose={() => setIsModalTabelasApoioAberto(false)} onSave={handleSaveTabelasApoio} />

            <ModalConfirmacao isOpen={modalSalvarAberto} onClose={() => setModalSalvarAberto(false)} onConfirm={handleConfirmarSalvar} title="Confirmar Alterações">
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
