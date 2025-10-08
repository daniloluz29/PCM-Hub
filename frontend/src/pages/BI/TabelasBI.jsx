import React, { useState, useEffect, useCallback, useRef } from 'react';
import Toast from '../../components/Toast.jsx'; // Ajuste o caminho se necessário

// Para evitar erros de importação, o componente ModalConfirmacao foi definido aqui.
const ModalConfirmacao = ({ isOpen, onClose, onConfirm, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content modal-small-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title || 'Confirmação'}</h3>
                    <button onClick={onClose} className="modal-close-btn">&times;</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
                <div className="modal-footer">
                    <button onClick={onClose} className="modal-button cancel">Cancelar</button>
                    <button onClick={onConfirm} className="modal-button confirm">Confirmar</button>
                </div>
            </div>
        </div>
    );
};

// Subcomponente para renderizar uma única linha de tabela
const TabelaItem = ({ tabela, onExpand, isExpanded, onMove, moveDirection, canMove, onDragStart, isDragging }) => {
    return (
        <div 
            className={`tabela-item ${isDragging ? 'dragging' : ''}`}
            draggable={canMove}
            onDragStart={(e) => onDragStart(e, tabela, moveDirection === 'add' ? 'available' : 'model')}
        >
            <div className="tabela-item-header">
                <button 
                    className="expand-btn" 
                    onClick={() => onExpand(tabela.name)}
                    disabled={isExpanded && (!tabela.columns || tabela.columns.length === 0)}
                >
                    <i className={`bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'}`}></i>
                </button>
                <span className="tabela-name">{tabela.label || tabela.name}</span>
                <button 
                    className="move-btn"
                    onClick={() => onMove(tabela)}
                    disabled={!canMove}
                    title={moveDirection === 'add' ? 'Adicionar ao modelo' : 'Remover do modelo'}
                >
                    <i className={`bi ${moveDirection === 'add' ? 'bi-plus-lg' : 'bi-dash-lg'}`}></i>
                </button>
            </div>
            {isExpanded && tabela.columns && (
                <div className="tabela-columns-list">
                    {tabela.columns.length > 0 ? (
                        tabela.columns.map(col => <div key={col.name} className="column-item">{col.name}</div>)
                    ) : (
                        <div className="column-item-empty">Nenhuma coluna encontrada.</div>
                    )}
                </div>
            )}
        </div>
    );
};


// Componente principal do Gerenciamento de Tabelas (agora como página)
const TabelasBI = () => {
    const [todasTabelas, setTodasTabelas] = useState([]);
    const [tabelasModelo, setTabelasModelo] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedTabelas, setExpandedTabelas] = useState({});
    const [confirmationState, setConfirmationState] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    
    // Estados para Drag and Drop
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverList, setDragOverList] = useState(null);

    // Estado para controlar a notificação de Toast
    const [toastState, setToastState] = useState({ visible: false, message: '', type: 'info' });
    
    // Ref para evitar o salvamento na montagem inicial do componente
    const isInitialMount = useRef(true);

    // Efeito para salvar automaticamente ao detectar mudanças no modelo
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        const saveModel = async () => {
            setToastState({ visible: true, message: 'A guardar alterações...', type: 'info' });
            try {
                // Prepara os dados para os dois endpoints
                const tablesPayload = { tabelas: tabelasModelo.map(t => ({ name: t.name, displayName: t.displayName || t.name })) };
                const positionsPayload = {
                    positions: tabelasModelo.reduce((acc, t) => {
                        if (t.coords) {
                            acc[t.name] = t.coords;
                        }
                        return acc;
                    }, {})
                };

                // 1. Salva a lista de tabelas no modelo (recria a lista no backend)
                const tablesResponse = await fetch('http://127.0.0.1:5000/api/bi/tables', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tablesPayload)
                });
                if (!tablesResponse.ok) {
                    const errorResult = await tablesResponse.json();
                    throw new Error(errorResult.message || 'Falha ao salvar a lista de tabelas');
                }

                // 2. Se houver posições para salvar, atualiza as coordenadas
                if (Object.keys(positionsPayload.positions).length > 0) {
                    const positionsResponse = await fetch('http://127.0.0.1:5000/api/bi/tables/positions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(positionsPayload)
                    });
                    if (!positionsResponse.ok) {
                        const errorResult = await positionsResponse.json();
                        throw new Error(errorResult.message || 'Falha ao salvar as posições das tabelas');
                    }
                }
                
                console.log("Modelo salvo com sucesso em tempo real!");
                setToastState({ visible: true, message: 'Modelo salvo com sucesso!', type: 'success' });

            } catch (error) {
                console.error("Erro ao salvar o modelo em tempo real:", error);
                setToastState({ visible: true, message: `Erro ao salvar: ${error.message}`, type: 'error' });
            }
        };

        // Adiciona um debounce para evitar chamadas excessivas à API
        const timerId = setTimeout(() => {
            saveModel();
        }, 1000); // Atraso de 1 segundo

        return () => clearTimeout(timerId);

    }, [tabelasModelo]);


    // Efeito para buscar os dados iniciais ao montar o componente
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const allTablesResponse = await fetch('http://127.0.0.1:5000/api/db/all-tables'); 
                const modelTablesResponse = await fetch('http://127.0.0.1:5000/api/bi/tables');
                
                const allTablesData = await allTablesResponse.json();
                const modelTablesData = await modelTablesResponse.json();

                if (allTablesResponse.ok && modelTablesResponse.ok) {
                    const modelTableNames = new Set(modelTablesData.map(t => t.name));
                    const availableTables = allTablesData
                        .map(t => ({ ...t, name: t.value }))
                        .filter(t => !modelTableNames.has(t.name));
                    
                    setTodasTabelas(availableTables);
                    setTabelasModelo(modelTablesData);
                } else {
                    console.error("Erro ao buscar tabelas.");
                }
            } catch (error) {
                console.error("Erro de rede:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleExpandTabela = useCallback(async (tableName) => {
        const isExpanded = !expandedTabelas[tableName];
        setExpandedTabelas(prev => ({ ...prev, [tableName]: isExpanded }));

        if (isExpanded) {
            const tabelaEmTodas = todasTabelas.find(t => t.name === tableName);
            const tabelaEmModelo = tabelasModelo.find(t => t.name === tableName);

            if ((tabelaEmTodas && tabelaEmTodas.columns) || (tabelaEmModelo && tabelaEmModelo.columns)) {
                return;
            }

            try {
                const response = await fetch(`http://127.0.0.1:5000/api/bi/table-schema/${tableName}`);
                const data = await response.json();
                if (response.ok) {
                    const updateWithColumns = (list) => list.map(t => t.name === tableName ? { ...t, columns: data.columns } : t);
                    setTodasTabelas(updateWithColumns);
                    // A atualização do estado tabelasModelo irá disparar o salvamento automático
                    setTabelasModelo(prev => prev.map(t => t.name === tableName ? { ...t, columns: data.columns } : t));
                } else {
                    console.error(`Erro ao buscar colunas da tabela ${tableName}:`, data.message);
                }
            } catch (error) {
                console.error(`Erro de rede ao buscar colunas da tabela ${tableName}:`, error);
            }
        }
    }, [expandedTabelas, todasTabelas, tabelasModelo]);
    
    const handleMoveTabela = (tabela, direction) => {
        if (direction === 'add') {
            // Lógica para adicionar tabela ao modelo
            setTodasTabelas(prev => prev.filter(t => t.name !== tabela.name));
            
            setTabelasModelo(prev => {
                // Calcula a próxima coordenada disponível
                const existingCoords = new Set(prev.map(t => t.coords ? `${t.coords.x},${t.coords.y}` : null));
                let nextCoordValue = 0;
                while (existingCoords.has(`${nextCoordValue},${nextCoordValue}`)) {
                    nextCoordValue += 20;
                }
                
                const newTableWithCoords = {
                    ...tabela,
                    coords: { x: nextCoordValue, y: nextCoordValue }
                };

                return [...prev, newTableWithCoords];
            });
        } else {
            // Lógica para remover tabela do modelo
            setTabelasModelo(prev => prev.filter(t => t.name !== tabela.name));
            setTodasTabelas(prev => [...prev, tabela]);
        }
    };

    // Funções de Drag and Drop
    const handleDragStart = (e, item, sourceList) => {
        setDraggedItem({ ...item, sourceList });
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (targetList) => {
        if (draggedItem && draggedItem.sourceList !== targetList) {
            handleMoveTabela(draggedItem, targetList === 'model' ? 'add' : 'remove');
        }
        setDraggedItem(null);
        setDragOverList(null);
    };

    if (isLoading) {
        return <div className="loading-placeholder">Carregando tabelas...</div>;
    }

    return (
        <div className="tabelas-bi-container">
            {toastState.visible && (
                <Toast
                    message={toastState.message}
                    type={toastState.type}
                    onClose={() => setToastState({ ...toastState, visible: false })}
                />
            )}
            <div 
                className={`tabelas-list-container ${dragOverList === 'available' ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop('available')}
                onDragEnter={() => setDragOverList('available')}
                onDragLeave={() => setDragOverList(null)}
            >
                <h6>Todas as Tabelas do Banco</h6>
                <div className="tabelas-list">
                    {todasTabelas.map(tabela => (
                        <TabelaItem 
                            key={tabela.name}
                            tabela={tabela}
                            onExpand={handleExpandTabela}
                            isExpanded={!!expandedTabelas[tabela.name]}
                            onMove={(t) => handleMoveTabela(t, 'add')}
                            moveDirection="add"
                            canMove={true}
                            onDragStart={handleDragStart}
                            isDragging={draggedItem?.name === tabela.name}
                        />
                    ))}
                </div>
            </div>

            <div 
                className={`tabelas-list-container ${dragOverList === 'model' ? 'drag-over' : ''}`}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop('model')}
                onDragEnter={() => setDragOverList('model')}
                onDragLeave={() => setDragOverList(null)}
            >
                <h6>Tabelas no Modelo</h6>
                 <div className="tabelas-list">
                    {tabelasModelo.map(tabela => (
                        <TabelaItem 
                            key={tabela.name}
                            tabela={tabela}
                            onExpand={handleExpandTabela}
                            isExpanded={!!expandedTabelas[tabela.name]}
                            onMove={(t) => handleMoveTabela(t, 'remove')}
                            moveDirection="remove"
                            canMove={true}
                            onDragStart={handleDragStart}
                            isDragging={draggedItem?.name === tabela.name}
                        />
                    ))}
                </div>
            </div>
            <ModalConfirmacao
                isOpen={confirmationState.isOpen}
                onClose={() => setConfirmationState({ ...confirmationState, isOpen: false })}
                onConfirm={confirmationState.onConfirm}
                title={confirmationState.title}
            >
                <p>{confirmationState.message}</p>
            </ModalConfirmacao>
        </div>
    );
};

export default TabelasBI;
