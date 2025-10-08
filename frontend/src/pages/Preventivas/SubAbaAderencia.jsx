import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer, Cell, ReferenceLine, Label } from 'recharts';
import ChartWrapper from '../../components/ChartWrapper.jsx';
import ChartModal from '../../components/ChartModal.jsx';
import TableWrapper from '../../components/TableWrapper.jsx';
import TableModal from '../../components/TableModal.jsx';
import Select from 'react-select';

// --- Componente de Tabela para Detalhes de Realizadas ---
const DetalhesRealizadasTable = ({ data }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'Data', direction: 'descending' });

    const headers = [
        "Centro de Custo",
        "Equipamento",
        "Data",
        "Nº OS",
        "SL Fluig",
        "Vencimento",
        "Término",
        "Status"
    ];

    const sortedData = React.useMemo(() => {
        let sortableData = [...data];
        if (sortConfig.key !== null) {
            sortableData.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (sortConfig.key === 'Data') {
                    const dateA = aValue ? new Date(aValue.split('/').reverse().join('-')) : new Date(0);
                    const dateB = bValue ? new Date(bValue.split('/').reverse().join('-')) : new Date(0);
                    if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
                    return 0;
                }
                
                if (aValue == null) return 1;
                if (bValue == null) return -1;
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableData;
    }, [data, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    const getStatusClassName = (status) => {
        switch (status) {
            case 'Atrasada': return 'status-atrasada';
            case 'Antecipada': return 'status-antecipada';
            default: return '';
        }
    };

    if (!data || data.length === 0) {
        return <p>Nenhuma preventiva realizada encontrada para os filtros selecionados.</p>;
    }

    return (
        <div className="table-container" style={{ maxHeight: '400px' }}>
            <table className="data-table">
                <thead>
                    <tr>
                        {headers.map(header => (
                            <th key={header} onClick={() => requestSort(header)}>
                                {header}{getSortIndicator(header)}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((row, index) => (
                        <tr key={index}>
                            {headers.map(header => (
                                <td key={header} className={header === 'Status' ? getStatusClassName(row[header]) : ''}>
                                    {row[header]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};


// Componentes auxiliares de gráfico
const CustomBarLabel = (props) => {
    const { x, y, width, value, formatter, useBackground } = props;
    if (value == null) return null;
    const formattedValue = formatter ? formatter(value) : value;
    const textY = y - 6;
    const textX = x + width / 2;
    if (useBackground) {
        const textWidth = String(formattedValue).length * 7;
        const padding = 8;
        const rectWidth = textWidth + padding;
        const rectHeight = 16;
        const rectX = textX - rectWidth / 2;
        const rectY = textY - rectHeight / 2 - 1;
        return (
            <g>
                <rect x={rectX} y={rectY} width={rectWidth} height={rectHeight} fill="rgba(255, 255, 255, 0.85)" rx="4" />
                <text x={textX} y={textY} textAnchor="middle" fill="#09124F" fontSize={12} fontWeight="bold">
                    {formattedValue}
                </text>
            </g>
        );
    }
    return (
        <text x={textX} y={y} dy={-4} fill="#09124F" fontSize={12} fontWeight="bold" textAnchor="middle">
            {formattedValue}
        </text>
    );
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isAderencia = 'aderencia' in data;
    const isAtraso = 'atrasadas_count' in data;

    return (
      <div className="custom-tooltip">
        <p className="label">{`${label}`}</p>
        {isAderencia && (
          <>
            <p className="intro" style={{ color: '#E87722' }}>{`Aderência: ${data.aderencia}%`}</p>
            <p className="desc">{`Realizadas: ${data.total_realizadas}`}</p>
            <p className="desc" style={{ color: '#c0392b' }}>{`Em Atraso: ${data.total_atrasadas}`}</p>
          </>
        )}
        {isAtraso && <p className="desc" style={{ color: '#c0392b' }}>{`Em Atraso: ${data.atrasadas_count}`}</p>}
      </div>
    );
  }
  return null;
};

const formatXAxisTick = (value) => {
    if (value && value.length > 20) {
        return `${value.substring(0, 20)}...`;
    }
    return value;
};

const CustomAxisTick = ({ x, y, payload }) => {
  if (!payload) return null;
  const truncatedValue = formatXAxisTick(payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{payload.value}</title>
      <text x={0} y={0} dy={10} textAnchor="end" fill="#666" fontSize={10} transform="rotate(-45)">
        {truncatedValue}
      </text>
    </g>
  );
};

const SubAbaAderencia = ({ setSidebarContent, globalFilters, currentUser, clearFiltersTrigger, isActive }) => {
    const [aderenciaGrupoData, setAderenciaGrupoData] = useState([]);
    const [aderenciaMensalData, setAderenciaMensalData] = useState([]);
    const [atrasadasData, setAtrasadasData] = useState([]);
    const [tabelaRealizadasData, setTabelaRealizadasData] = useState([]);
    const [kpis, setKpis] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chartInModal, setChartInModal] = useState(null);
    const [isTableModalOpen, setIsTableModalOpen] = useState(false);
    const [activeClick, setActiveClick] = useState([]);
    const [filterSourceChart, setFilterSourceChart] = useState(null);
    const [collapsedBlocks, setCollapsedBlocks] = useState({});
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);

    const [sidebarFilters, setSidebarFilters] = useState(() => {
        const currentYear = new Date().getFullYear();
        return {
            dateRange: {
                inicio: `${currentYear}-01-01`,
                fim: `${currentYear}-12-31`
            },
            tipos: [],
            classificacoes: []
        };
    });

    const [classificacaoOptions, setClassificacaoOptions] = useState([]);
    const tipoOptions = [{ value: 'Por tempo', label: 'Por tempo' }, { value: 'Marco', label: 'Marco' }];
    const visao = globalFilters?.visao?.label || 'Contrato';

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
        if (clearFiltersTrigger > 0) {
            const currentYear = new Date().getFullYear();
            setSidebarFilters({
                dateRange: {
                    inicio: `${currentYear}-01-01`,
                    fim: `${currentYear}-12-31`
                },
                tipos: [],
                classificacoes: []
            });
            setActiveClick([]);
            setFilterSourceChart(null);
        }
    }, [clearFiltersTrigger]);

    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const response = await fetch('http://127.0.0.1:5000/api/preventivas/opcoes-filtro');
                const data = await response.json();
                if (response.ok) {
                    setClassificacaoOptions(data.classificacoes.map(c => ({ value: c, label: c })));
                }
            } catch (err) {
                console.error("Erro ao buscar opções de filtro:", err);
            }
        };
        fetchFilterOptions();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser || !isActive) {
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                
                const baseParams = new URLSearchParams();
                if (currentUser.perfil_id !== 'master_admin') {
                    baseParams.append('user_contracts', currentUser.liberacao_dados || '');
                }
                if (globalFilters.visao) baseParams.append('visao', globalFilters.visao.value);
                if (globalFilters.exibicao) baseParams.append('exibicao', globalFilters.exibicao.value);
                ['superintendencias', 'nucleos', 'contratos', 'estados', 'controladores', 'gestores'].forEach(key => {
                    if (globalFilters[key]?.length > 0) {
                        baseParams.append(key, globalFilters[key].map(item => item.value).join(','));
                    }
                });
                if (sidebarFilters.dateRange.inicio && sidebarFilters.dateRange.fim) {
                    baseParams.append('data_inicio', sidebarFilters.dateRange.inicio);
                    baseParams.append('data_fim', sidebarFilters.dateRange.fim);
                }
                if (sidebarFilters.tipos.length > 0) baseParams.append('tipos', sidebarFilters.tipos.map(t => t.value).join(','));
                if (sidebarFilters.classificacoes.length > 0) baseParams.append('classificacoes', sidebarFilters.classificacoes.map(c => c.value).join(','));

                const realizadasParams = new URLSearchParams(baseParams);
                const mensalParams = new URLSearchParams(baseParams);
                const kpisParams = new URLSearchParams(baseParams);
                const detalhesParams = new URLSearchParams(baseParams);
                const kpisGeraisParams = new URLSearchParams(baseParams);

                const grupoFilters = activeClick.filter(f => f.type === 'grupo');
                const mesFilters = activeClick.filter(f => f.type === 'mes');
                const grupoValues = grupoFilters.map(f => f.value);
                const mesValues = mesFilters.map(f => f.value);
                const kpiStatus = (grupoFilters.length > 0 && grupoFilters[0].status) ? grupoFilters[0].status : null;

                if (grupoValues.length > 0) {
                    const visaoParam = (globalFilters.visao?.value || 'contrato').toLowerCase();
                    const grupoParamValue = grupoValues.join(',');
                    realizadasParams.append(visaoParam, grupoParamValue);
                    mensalParams.append(visaoParam, grupoParamValue);
                    kpisParams.append(visaoParam, grupoParamValue);
                    detalhesParams.append(visaoParam, grupoParamValue);
                    kpisGeraisParams.append(visaoParam, grupoParamValue);
                }
                if (mesValues.length > 0) {
                    const mesParamValue = mesValues.join(',');
                    realizadasParams.append('mes_ano', mesParamValue);
                    kpisParams.append('mes_ano', mesParamValue);
                    detalhesParams.append('mes_ano', mesParamValue);
                    kpisGeraisParams.append('mes_ano', mesParamValue);
                }
                if (kpiStatus) {
                    detalhesParams.append('status_filter', kpiStatus);
                }

                const [realizadasRes, mensalRes, kpisRes, detalhesRes, kpisGeraisRes] = await Promise.all([
                    fetch(`http://127.0.0.1:5000/api/preventivas/realizadas?${realizadasParams.toString()}`),
                    fetch(`http://127.0.0.1:5000/api/preventivas/aderencia-mensal?${mensalParams.toString()}`),
                    fetch(`http://127.0.0.1:5000/api/preventivas/kpis-grupo?${kpisParams.toString()}`),
                    fetch(`http://127.0.0.1:5000/api/preventivas/realizadas-detalhes?${detalhesParams.toString()}`),
                    fetch(`http://127.0.0.1:5000/api/preventivas/kpis-gerais?${kpisGeraisParams.toString()}`)
                ]);
                
                if (!realizadasRes.ok || !mensalRes.ok || !kpisRes.ok || !detalhesRes.ok || !kpisGeraisRes.ok) throw new Error(`Falha ao buscar dados do servidor.`);

                const realizadasResult = await realizadasRes.json();
                const mensalResult = await mensalRes.json();
                const kpisResult = await kpisRes.json();
                const detalhesResult = await detalhesRes.json();
                const kpisGeraisResult = await kpisGeraisRes.json();
                
                setAderenciaGrupoData(realizadasResult.aderencia_por_grupo || []);
                setAderenciaMensalData(mensalResult.aderencia_mensal || []);
                setAtrasadasData(kpisResult.atrasadas || []);
                setTabelaRealizadasData(detalhesResult || []);
                setKpis(kpisGeraisResult);
                setError(null);
            } catch (e) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };
        if (isActive) fetchData();
    }, [globalFilters, currentUser, activeClick, sidebarFilters, isActive]);

    useEffect(() => {
        if (isActive) {
            setSidebarContent(
                <>
                    <div className="filter-group">
                        <label>Período de Conclusão</label>
                        <input type="date" value={sidebarFilters.dateRange.inicio} onChange={(e) => setSidebarFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, inicio: e.target.value }}))} />
                        <input type="date" value={sidebarFilters.dateRange.fim} onChange={(e) => setSidebarFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, fim: e.target.value }}))} />
                    </div>
                    <div className="filter-group"><label>Tipo de Preventiva</label><Select isMulti options={tipoOptions} value={sidebarFilters.tipos} onChange={(selected) => setSidebarFilters(prev => ({ ...prev, tipos: selected || [] }))} placeholder="Todos"/></div>
                    <div className="filter-group"><label>Classificação</label><Select isMulti options={classificacaoOptions} value={sidebarFilters.classificacoes} onChange={(selected) => setSidebarFilters(prev => ({ ...prev, classificacoes: selected || [] }))} placeholder="Todas" /></div>
                </>
            );
        }
    }, [isActive, setSidebarContent, sidebarFilters, classificacaoOptions]);

    const handleChartClick = (type, data, event, status = null, chartId) => {
        if (!data) return;
        const value = type === 'grupo' ? data.nome_grupo : data.name;
        const newSelection = { type, value, status };
        let newActiveClick = [];
        let newFilterSourceChart = chartId;
        setActiveClick(prev => {
            const isAlreadySelected = prev.some(item => item.value === newSelection.value && item.type === newSelection.type);
            const prevStatus = (prev.length > 0 && prev[0].status) ? prev[0].status : null;
            if (event.ctrlKey) {
                if (isAlreadySelected) newActiveClick = prev.filter(item => item.value !== newSelection.value);
                else {
                    if (status && prevStatus && status !== prevStatus) newActiveClick = [newSelection];
                    else newActiveClick = [...prev, newSelection];
                }
            } else {
                if (isAlreadySelected && prev.length === 1) newActiveClick = [];
                else newActiveClick = [newSelection];
            }
            if (newActiveClick.length === 0) newFilterSourceChart = null;
            setFilterSourceChart(newFilterSourceChart);
            return newActiveClick;
        });
    };
    
    const toggleBlock = (blockName) => {
        setCollapsedBlocks(prev => ({ ...prev, [blockName]: !prev[blockName] }));
    };

    const tableColumns = useMemo(() => [
        { key: 'Centro de Custo', name: 'Centro de Custo', resizable: true, type: 'text' },
        { key: 'Equipamento', name: 'Equipamento', resizable: true, type: 'text' },
        { key: 'Data', name: 'Data', resizable: true, type: 'date' },
        { key: 'Nº OS', name: 'Nº OS', resizable: true, type: 'numeric' },
        { key: 'SL Fluig', name: 'SL Fluig', resizable: true, type: 'numeric' },
        { key: 'Vencimento', name: 'Vencimento', resizable: true, type: 'datenum' },
        { key: 'Término', name: 'Término', resizable: true, type: 'datenum' },
        { key: 'Status', name: 'Status', resizable: true, type: 'text' }
    ], []);

    const GenericBarChart = ({ data, dataKey, xAxisKey, onClickHandler, chartId, filterType, kpiStatus, labelFormatter, showReferenceLine = false, useBackgroundLabel = false }) => (
        <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 50 }} isAnimationActive={false}>
                <XAxis dataKey={xAxisKey} interval={0} height={100} tick={<CustomAxisTick />} />
                <YAxis domain={showReferenceLine ? [0, 100] : undefined} tick={false} tickLine={false} axisLine={false} />
                {!isCtrlPressed && <Tooltip content={<CustomTooltip />} />}
                {showReferenceLine && (<ReferenceLine y={100} stroke="#09124F" strokeDasharray="3 3"><Label value="Meta" position='insideBottomRight' fill="#09124F" fontSize={12} /></ReferenceLine>)}
                <Bar dataKey={dataKey} onClick={(data, index, event) => onClickHandler(filterType, data, event, kpiStatus, chartId)} isAnimationActive={false}>
                    {data.map((entry, index) => {
                        const relevantFilters = activeClick.filter(f => f.type === filterType);
                        const isAnyRelevantFilterActive = relevantFilters.length > 0;
                        const isFiltered = isAnyRelevantFilterActive && !relevantFilters.some(f => f.value === entry[xAxisKey]);
                        return (<Cell key={`cell-${index}`} fill={isFiltered ? '#dcdcdc' : (dataKey === 'atrasadas_count' ? '#e87722' : '#E87722')} style={{ cursor: 'pointer' }} />);
                    })}
                    <LabelList dataKey={dataKey} content={<CustomBarLabel formatter={labelFormatter} useBackground={useBackgroundLabel} />}/>
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );

    const percentFormatter = (value) => `${value}%`;

    return (
        <>
            <div className="analysis-block">
                <div className="analysis-block-title" onClick={() => toggleBlock('aderencia')}>
                    <h2>Aderência de Preventivas</h2>
                    <button className={`collapse-button ${collapsedBlocks.aderencia ? 'collapsed' : ''}`}><i className="bi bi-chevron-down"></i></button>
                </div>
                <div className={`analysis-block-content ${collapsedBlocks.aderencia ? 'collapsed' : ''}`}>
                    <div className="dashboard-grid full-width-grid">
                        <ChartWrapper 
                            title={`Aderência de Preventivas por ${visao}`}
                            onPhotoModeClick={() => setChartInModal({ title: `Aderência de Preventivas por ${visao}`, chart: <GenericBarChart data={aderenciaGrupoData} dataKey="aderencia" xAxisKey="nome_grupo" onClickHandler={handleChartClick} filterType="grupo" chartId="aderenciaGrupo" labelFormatter={percentFormatter} showReferenceLine useBackgroundLabel /> })}
                            isFilterSource={filterSourceChart === 'aderenciaGrupo'}
                            kpiCards={[
                                { title: 'Aderência Total', value: `${kpis.aderencia_geral || 0}%` },
                                { title: 'Realizadas', value: kpis.total_geral_realizadas || 0 },
                                { title: 'Atrasadas', value: kpis.total_geral_atrasadas || 0 }
                            ]}
                        >
                            {isLoading ? <p>Carregando...</p> : <GenericBarChart data={aderenciaGrupoData} dataKey="aderencia" xAxisKey="nome_grupo" onClickHandler={handleChartClick} filterType="grupo" chartId="aderenciaGrupo" labelFormatter={percentFormatter} showReferenceLine useBackgroundLabel />}
                        </ChartWrapper>
                    </div>
                    <div className="dashboard-grid preventivas-grid" >
                        <ChartWrapper 
                            title={`Aderência Mensal ${activeClick.filter(f=>f.type==='grupo').length > 0 ? '(Filtrado)' : ''}`}
                            onPhotoModeClick={() => setChartInModal({ title: "Aderência Mensal", chart: <GenericBarChart data={aderenciaMensalData} dataKey="aderencia" xAxisKey="name" onClickHandler={handleChartClick} filterType="mes" chartId="aderenciaMensal" labelFormatter={percentFormatter} showReferenceLine useBackgroundLabel /> })}
                            isFilterSource={filterSourceChart === 'aderenciaMensal'}
                            kpiCards={[{ title: 'Aderência Média', value: `${kpis.aderencia_media || 0}%` }]}
                        >
                            {isLoading ? <p>Carregando...</p> : <GenericBarChart data={aderenciaMensalData} dataKey="aderencia" xAxisKey="name" onClickHandler={handleChartClick} filterType="mes" chartId="aderenciaMensal" labelFormatter={percentFormatter} showReferenceLine useBackgroundLabel />}
                        </ChartWrapper>
                        <ChartWrapper 
                            title={`Preventivas em Atraso por ${visao} ${activeClick.filter(f=>f.type==='mes').length > 0 ? '(Filtrado)' : ''}`}
                            onPhotoModeClick={() => setChartInModal({ title: `Preventivas em Atraso por ${visao}`, chart: <GenericBarChart data={atrasadasData} dataKey="atrasadas_count" xAxisKey="nome_grupo" onClickHandler={handleChartClick} kpiStatus="Atrasada" filterType="grupo" chartId="atrasadasGrupo" /> })}
                            isFilterSource={filterSourceChart === 'atrasadasGrupo'}
                            kpiCards={[{ title: 'Total Atrasadas', value: kpis.total_atrasadas || 0 }]}
                        >
                            {isLoading ? <p>Carregando...</p> : <GenericBarChart data={atrasadasData} dataKey="atrasadas_count" xAxisKey="nome_grupo" onClickHandler={handleChartClick} kpiStatus="Atrasada" filterType="grupo" chartId="atrasadasGrupo" />}
                        </ChartWrapper>
                    </div>
                </div>
            </div>

            <div className="analysis-block">
                <div className="analysis-block-title" onClick={() => toggleBlock('detalhamento')}>
                    <h2>Detalhamento das Preventivas Realizadas</h2>
                    <button className={`collapse-button ${collapsedBlocks.detalhamento ? 'collapsed' : ''}`}><i className="bi bi-chevron-down"></i></button>
                </div>
                <div className={`analysis-block-content ${collapsedBlocks.detalhamento ? 'collapsed' : ''}`}>
                    <TableWrapper title="" onExpandClick={() => setIsTableModalOpen(true)}>
                        {isLoading ? <p>Carregando detalhes...</p> : <DetalhesRealizadasTable data={tabelaRealizadasData} />}
                    </TableWrapper>
                </div>
            </div>

            <ChartModal isOpen={!!chartInModal} onClose={() => setChartInModal(null)} chartTitle={chartInModal?.title}>
                {chartInModal?.chart}
            </ChartModal>

            <TableModal isOpen={isTableModalOpen} onClose={() => setIsTableModalOpen(false)} title="Detalhamento Avançado das Preventivas Realizadas" columns={tableColumns} rows={tabelaRealizadasData} />
        </>
    );
};

export default SubAbaAderencia;
