import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer, Cell } from 'recharts';
import ChartWrapper from '../../components/ChartWrapper.jsx';
import ChartModal from '../../components/ChartModal.jsx';
import TableWrapper from '../../components/TableWrapper.jsx';
import TableModal from '../../components/TableModal.jsx';

const API_BASE_URL = 'http://127.0.0.1:5000';

// --- Componentes Auxiliares (Reutilizados e Adaptados do Exemplo) ---

const DetalhesPneusTable = ({ data }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'medicao', direction: 'descending' });
    const headers = ["Equipamento", "Nº Fogo", "Posição", "Classificação", "Medição (mm)", "Faixa"];
    const keys = ["equipamento", "num_fogo", "posicao_agregado", "classificacao", "medicao", "faixa"];

    const sortedData = useMemo(() => {
        let sortableData = [...data];
        if (sortConfig.key) {
            sortableData.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableData;
    }, [data, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    if (!data || data.length === 0) {
        return <p>Nenhum pneu encontrado para os filtros selecionados.</p>;
    }

    return (
        <div className="table-container" style={{ maxHeight: '400px' }}>
            <table className="data-table">
                <thead>
                    <tr>{headers.map((h, i) => <th key={h} onClick={() => requestSort(keys[i])}>{h}</th>)}</tr>
                </thead>
                <tbody>
                    {sortedData.map((row, index) => (
                        <tr key={`${row.equipamento}-${row.num_fogo}-${index}`}>
                            {keys.map(key => <td key={key}>{key === 'medicao' ? `${row[key] || 'N/A'} mm` : row[key]}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="custom-tooltip">
        <p className="label">{`Faixa: ${label}`}</p>
        <p className="desc" style={{ color: data.cor }}>{`Total de Pneus: ${data.total_pneus}`}</p>
      </div>
    );
  }
  return null;
};


// --- Componente Principal da Sub-Aba ---
const SubAbaAnaliseEstados = ({ setSidebarContent, isActive }) => {
    const [graficosData, setGraficosData] = useState([]);
    const [tabelaDetalhesData, setTabelaDetalhesData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chartInModal, setChartInModal] = useState(null);
    const [isTableModalOpen, setIsTableModalOpen] = useState(false);
    
    const [activeClick, setActiveClick] = useState([]);
    const [collapsedBlocks, setCollapsedBlocks] = useState({});
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    
    // NOVO: Estado para rastrear o gráfico que origina o filtro
    const [filterSourceChart, setFilterSourceChart] = useState(null);


    useEffect(() => {
        const handleKeyDown = (event) => { if (event.key === 'Control') setIsCtrlPressed(true); };
        const handleKeyUp = (event) => { if (event.key === 'Control') setIsCtrlPressed(false); };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!isActive) return;
            setIsLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/api/pneus/analise-estados`);
                if (!response.ok) throw new Error('Falha ao buscar dados de análise de estados.');
                const data = await response.json();
                setGraficosData(data.graficos || []);
                setTabelaDetalhesData(data.tabela_detalhes || []);
                setCollapsedBlocks({ graficos: false, detalhamento: false });
                setError(null);
            } catch (e) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [isActive]);
    
    useEffect(() => {
        if (isActive) {
            setSidebarContent(
                <p style={{ padding: '10px', color: '#6c757d', textAlign: 'center', fontSize: '14px' }}>
                    Filtros para esta aba serão implementados futuramente.
                </p>
            );
        }
    }, [isActive, setSidebarContent]);

    // ALTERADO: A função de clique agora também define o gráfico de origem do filtro
    const handleChartClick = (type, data, chartId) => {
        if (!data) return;
        const value = data.faixa;
        const newSelection = { type, value };
        
        setActiveClick(prev => {
            const isAlreadySelected = prev.some(item => item.value === newSelection.value);
            let newActiveClick;
            if (isCtrlPressed) {
                newActiveClick = isAlreadySelected ? prev.filter(item => item.value !== newSelection.value) : [...prev, newSelection];
            } else {
                newActiveClick = isAlreadySelected && prev.length === 1 ? [] : [newSelection];
            }
            
            if (newActiveClick.length > 0) {
                setFilterSourceChart(chartId);
            } else {
                setFilterSourceChart(null);
            }
            
            return newActiveClick;
        });
    };

    const filteredTableData = useMemo(() => {
        if (activeClick.length === 0) return tabelaDetalhesData;

        const faixasAtivas = activeClick.map(f => f.value);
        return tabelaDetalhesData.filter(row => faixasAtivas.includes(row.faixa));
    }, [tabelaDetalhesData, activeClick]);

    const toggleBlock = blockName => setCollapsedBlocks(p => ({...p, [blockName]: !p[blockName]}));
    
    // ALTERADO: A função de renderização do gráfico agora sabe o seu próprio ID
    const renderChart = (grupo) => {
        const chartId = grupo.grupo_classificacao;
        return (
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={grupo.dados} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="faixa" />
                    <YAxis tick={false} tickLine={false} axisLine={false} width={0} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="total_pneus" isAnimationActive={false} onClick={(data) => handleChartClick('faixa', data, chartId)}>
                        {grupo.dados.map((entry, index) => {
                            const isFiltered = activeClick.length > 0 && !activeClick.some(f => f.value === entry.faixa);
                            return <Cell key={`cell-${index}`} fill={isFiltered ? '#dcdcdc' : entry.cor} style={{ cursor: 'pointer' }} />;
                        })}
                        <LabelList dataKey="total_pneus" position="top" fill="#2c3e50" fontWeight="bold" />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        );
    };

    return (
        <>
            {isLoading && <p>Carregando análise...</p>}
            {error && <p className="error-message">Erro: {error}</p>}
            {!isLoading && !error && (
                <>
                    <div className="analysis-block">
                        <div className="analysis-block-title" onClick={() => toggleBlock('graficos')}>
                            <h2>Estados de Conservação</h2>
                            <button className={`collapse-button ${collapsedBlocks.graficos ? 'collapsed' : ''}`}><i className="bi bi-chevron-down"></i></button>
                        </div>
                        <div className={`analysis-block-content ${collapsedBlocks.graficos ? 'collapsed' : ''}`}>
                            {graficosData.map(grupo => (
                                <ChartWrapper
                                    key={grupo.grupo_classificacao}
                                    title={`Classificação: ${grupo.grupo_classificacao}`}
                                    onPhotoModeClick={() => setChartInModal({ title: `Estado de Conservação - ${grupo.grupo_classificacao}`, chart: renderChart(grupo) })}
                                    kpiCards={[{ title: 'Total de Pneus', value: grupo.dados.reduce((acc, item) => acc + item.total_pneus, 0) }]}
                                    // NOVO: Adiciona a propriedade que destaca o gráfico
                                    isFilterSource={filterSourceChart === grupo.grupo_classificacao}
                                >
                                   {renderChart(grupo)}
                                </ChartWrapper>
                            ))}
                        </div>
                    </div>

                    <div className="analysis-block">
                        <div className="analysis-block-title" onClick={() => toggleBlock('detalhamento')}>
                            <h2>Detalhamento dos Pneus</h2>
                            <button className={`collapse-button ${collapsedBlocks.detalhamento ? 'collapsed' : ''}`}><i className="bi bi-chevron-down"></i></button>
                        </div>
                        <div className={`analysis-block-content ${collapsedBlocks.detalhamento ? 'collapsed' : ''}`}>
                            <TableWrapper title={`Exibindo ${filteredTableData.length} de ${tabelaDetalhesData.length} pneus`} onExpandClick={() => setIsTableModalOpen(true)}>
                                <DetalhesPneusTable data={filteredTableData} />
                            </TableWrapper>
                        </div>
                    </div>
                </>
            )}

            <ChartModal isOpen={!!chartInModal} onClose={() => setChartInModal(null)} chartTitle={chartInModal?.title}>
                {chartInModal?.chart}
            </ChartModal>
            
            <TableModal 
                isOpen={isTableModalOpen} 
                onClose={() => setIsTableModalOpen(false)} 
                title="Detalhamento Avançado dos Pneus" 
                columns={[{ key: 'equipamento', name: 'Equipamento' }, {key: 'num_fogo', name: 'Nº Fogo'}, {key: 'posicao_agregado', name: 'Posição'}, {key: 'classificacao', name: 'Classificação'}, {key: 'medicao', name: 'Medição (mm)'}, {key: 'faixa', name: 'Faixa'}]} 
                rows={filteredTableData} 
            />
        </>
    );
};

export default SubAbaAnaliseEstados;

