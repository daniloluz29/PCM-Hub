import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer, Cell } from 'recharts';
import ChartWrapper from '../../components/ChartWrapper.jsx';
import ChartModal from '../../components/ChartModal.jsx';
import TableWrapper from '../../components/TableWrapper.jsx';
import TableModal from '../../components/TableModal.jsx';
import Select from 'react-select';

// --- Componente de Tabela para Detalhes ---
const DetalhesRealizadasTable = ({ data }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'Data', direction: 'descending' });

    const headers = ["Centro de Custo", "Equipamento", "Data", "Nº OS", "SL Fluig", "Vencimento", "Término", "Status"];

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
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
    };

    if (!data || data.length === 0) {
        return <p>Nenhuma preventiva antecipada encontrada para os filtros selecionados.</p>;
    }

    return (
        <div className="table-container" style={{ maxHeight: '400px' }}>
            <table className="data-table">
                <thead>
                    <tr>{headers.map(h => <th key={h} onClick={() => requestSort(h)}>{h}{getSortIndicator(h)}</th>)}</tr>
                </thead>
                <tbody>
                    {sortedData.map((row, index) => (
                        <tr key={index}>
                            {headers.map(h => <td key={h} className={h === 'Status' ? 'status-antecipada' : ''}>{row[h]}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// --- Componentes Auxiliares de Gráfico ---
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="custom-tooltip">
        <p className="label">{`${label}`}</p>
        <p className="desc" style={{ color: '#2c3e50' }}>{`Antecipadas: ${data.antecipadas_count}`}</p>
      </div>
    );
  }
  return null;
};

const CustomAxisTick = ({ x, y, payload }) => {
  if (!payload) return null;
  const truncatedValue = payload.value && payload.value.length > 20 ? `${payload.value.substring(0, 20)}...` : payload.value;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{payload.value}</title>
      <text x={0} y={0} dy={10} textAnchor="end" fill="#666" fontSize={10} transform="rotate(-45)">{truncatedValue}</text>
    </g>
  );
};

// --- Componente Principal da Sub-Aba ---
const SubAbaAntecipacao = ({ setSidebarContent, globalFilters, currentUser, clearFiltersTrigger, isActive }) => {
    const [antecipadasData, setAntecipadasData] = useState([]);
    const [tabelaDetalhesData, setTabelaDetalhesData] = useState([]);
    const [kpis, setKpis] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chartInModal, setChartInModal] = useState(null);
    const [isTableModalOpen, setIsTableModalOpen] = useState(false);
    const [activeClick, setActiveClick] = useState([]);
    const [filterSourceChart, setFilterSourceChart] = useState(null);
    const [collapsedBlocks, setCollapsedBlocks] = useState({ antecipacao: false, detalhamento: false });
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);

    const [sidebarFilters, setSidebarFilters] = useState(() => {
        const currentYear = new Date().getFullYear();
        return {
            dateRange: { inicio: `${currentYear}-01-01`, fim: `${currentYear}-12-31` },
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
                dateRange: { inicio: `${currentYear}-01-01`, fim: `${currentYear}-12-31` },
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
                if (response.ok) setClassificacaoOptions(data.classificacoes.map(c => ({ value: c, label: c })));
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
                if (currentUser.perfil_id !== 'master_admin') baseParams.append('user_contracts', currentUser.liberacao_dados || '');
                if (globalFilters.visao) baseParams.append('visao', globalFilters.visao.value);
                if (globalFilters.exibicao) baseParams.append('exibicao', globalFilters.exibicao.value);
                ['superintendencias', 'nucleos', 'contratos', 'estados', 'controladores', 'gestores'].forEach(key => {
                    if (globalFilters[key]?.length > 0) baseParams.append(key, globalFilters[key].map(item => item.value).join(','));
                });
                if (sidebarFilters.dateRange.inicio && sidebarFilters.dateRange.fim) {
                    baseParams.append('data_inicio', sidebarFilters.dateRange.inicio);
                    baseParams.append('data_fim', sidebarFilters.dateRange.fim);
                }
                if (sidebarFilters.tipos.length > 0) baseParams.append('tipos', sidebarFilters.tipos.map(t => t.value).join(','));
                if (sidebarFilters.classificacoes.length > 0) baseParams.append('classificacoes', sidebarFilters.classificacoes.map(c => c.value).join(','));

                const kpisParams = new URLSearchParams(baseParams);
                const detalhesParams = new URLSearchParams(baseParams);
                const kpisGeraisParams = new URLSearchParams(baseParams);
                detalhesParams.append('status_filter', 'Antecipada');

                const grupoFilters = activeClick.filter(f => f.type === 'grupo').map(f => f.value);
                const mesFilters = activeClick.filter(f => f.type === 'mes').map(f => f.value);

                if (grupoFilters.length > 0) {
                    const visaoParam = (globalFilters.visao?.value || 'contrato').toLowerCase();
                    kpisParams.append(visaoParam, grupoFilters.join(','));
                    detalhesParams.append(visaoParam, grupoFilters.join(','));
                    kpisGeraisParams.append(visaoParam, grupoFilters.join(','));
                }
                if (mesFilters.length > 0) {
                    kpisParams.append('mes_ano', mesFilters.join(','));
                    detalhesParams.append('mes_ano', mesFilters.join(','));
                    kpisGeraisParams.append('mes_ano', mesFilters.join(','));
                }

                const [kpisRes, detalhesRes, kpisGeraisRes] = await Promise.all([
                    fetch(`http://127.0.0.1:5000/api/preventivas/kpis-grupo?${kpisParams.toString()}`),
                    fetch(`http://127.0.0.1:5000/api/preventivas/realizadas-detalhes?${detalhesParams.toString()}`),
                    fetch(`http://127.0.0.1:5000/api/preventivas/kpis-gerais?${kpisGeraisParams.toString()}`)
                ]);

                if (!kpisRes.ok || !detalhesRes.ok || !kpisGeraisRes.ok) throw new Error(`Falha ao buscar dados do servidor.`);
                
                const kpisResult = await kpisRes.json();
                const detalhesResult = await detalhesRes.json();
                const kpisGeraisResult = await kpisGeraisRes.json();

                setAntecipadasData(kpisResult.antecipadas || []);
                setTabelaDetalhesData(detalhesResult || []);
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
                        <input type="date" value={sidebarFilters.dateRange.inicio} onChange={e => setSidebarFilters(p => ({...p, dateRange: {...p.dateRange, inicio: e.target.value}}))} />
                        <input type="date" value={sidebarFilters.dateRange.fim} onChange={e => setSidebarFilters(p => ({...p, dateRange: {...p.dateRange, fim: e.target.value}}))} />
                    </div>
                    <div className="filter-group"><label>Tipo de Preventiva</label><Select isMulti options={tipoOptions} value={sidebarFilters.tipos} onChange={s => setSidebarFilters(p => ({...p, tipos: s || []}))} placeholder="Todos"/></div>
                    <div className="filter-group"><label>Classificação</label><Select isMulti options={classificacaoOptions} value={sidebarFilters.classificacoes} onChange={s => setSidebarFilters(p => ({...p, classificacoes: s || []}))} placeholder="Todas"/></div>
                </>
            );
        }
    }, [isActive, setSidebarContent, sidebarFilters, classificacaoOptions]);

    const handleChartClick = (type, data, event, status = null, chartId) => {
        if (!data) return;
        const value = data.nome_grupo;
        const newSelection = { type, value, status };
        let newActiveClick = [];
        let newFilterSourceChart = chartId;
        setActiveClick(prev => {
            const isAlreadySelected = prev.some(item => item.value === newSelection.value);
            if (event.ctrlKey) {
                newActiveClick = isAlreadySelected ? prev.filter(item => item.value !== newSelection.value) : [...prev, newSelection];
            } else {
                newActiveClick = isAlreadySelected && prev.length === 1 ? [] : [newSelection];
            }
            if (newActiveClick.length === 0) newFilterSourceChart = null;
            setFilterSourceChart(newFilterSourceChart);
            return newActiveClick;
        });
    };
    
    const toggleBlock = blockName => setCollapsedBlocks(p => ({...p, [blockName]: !p[blockName]}));
    const tableColumns = useMemo(() => [{ key: 'Centro de Custo', name: 'Centro de Custo', resizable: true }, { key: 'Equipamento', name: 'Equipamento', resizable: true }, { key: 'Data', name: 'Data', resizable: true, type: 'date' }, { key: 'Nº OS', name: 'Nº OS', resizable: true }, { key: 'SL Fluig', name: 'SL Fluig', resizable: true }, { key: 'Vencimento', name: 'Vencimento', resizable: true }, { key: 'Término', name: 'Término', resizable: true }, { key: 'Status', name: 'Status', resizable: true }], []);

    const GenericBarChart = ({ data, dataKey, xAxisKey, onClickHandler, chartId, filterType, kpiStatus }) => (
        <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 50 }} isAnimationActive={false}>
                <XAxis dataKey={xAxisKey} interval={0} height={100} tick={<CustomAxisTick />} />
                <YAxis tick={false} tickLine={false} axisLine={false} />
                {!isCtrlPressed && <Tooltip content={<CustomTooltip />} />}
                <Bar dataKey={dataKey} onClick={(data, index, event) => onClickHandler(filterType, data, event, kpiStatus, chartId)} isAnimationActive={false}>
                    {data.map((entry, index) => {
                        const relevantFilters = activeClick.filter(f => f.type === filterType);
                        const isFiltered = relevantFilters.length > 0 && !relevantFilters.some(f => f.value === entry[xAxisKey]);
                        return <Cell key={`cell-${index}`} fill={isFiltered ? '#dcdcdc' : '#E87722'} style={{ cursor: 'pointer' }} />;
                    })}
                    <LabelList dataKey={dataKey} position="top" fill="#09124F" fontSize={12} fontWeight="bold" />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );

    return (
        <>
            <div className="analysis-block">
                <div className="analysis-block-title" onClick={() => toggleBlock('antecipacao')}>
                    <h2>Antecipação de Preventivas</h2>
                    <button className={`collapse-button ${collapsedBlocks.antecipacao ? 'collapsed' : ''}`}><i className="bi bi-chevron-down"></i></button>
                </div>
                <div className={`analysis-block-content ${collapsedBlocks.antecipacao ? 'collapsed' : ''}`}>
                    <div className="dashboard-grid full-width-grid">
                         <ChartWrapper 
                            title={`Preventivas por Antecipação (>90h) por ${visao} ${activeClick.filter(f=>f.type==='mes').length > 0 ? '(Filtrado)' : ''}`}
                            onPhotoModeClick={() => setChartInModal({ title: `Preventivas por Antecipação (>90h) por ${visao}`, chart: <GenericBarChart data={antecipadasData} dataKey="antecipadas_count" xAxisKey="nome_grupo" onClickHandler={handleChartClick} kpiStatus="Antecipada" filterType="grupo" chartId="antecipadasGrupo" /> })}
                            isFilterSource={filterSourceChart === 'antecipadasGrupo'}
                            kpiCards={[{ title: 'Total Antecipadas', value: kpis.total_antecipadas || 0 }]}
                        >
                            {isLoading ? <p>Carregando...</p> : <GenericBarChart data={antecipadasData} dataKey="antecipadas_count" xAxisKey="nome_grupo" onClickHandler={handleChartClick} kpiStatus="Antecipada" filterType="grupo" chartId="antecipadasGrupo" />}
                        </ChartWrapper>
                    </div>
                </div>
            </div>

            <div className="analysis-block">
                <div className="analysis-block-title" onClick={() => toggleBlock('detalhamento')}>
                    <h2>Detalhamento das Preventivas Antecipadas</h2>
                    <button className={`collapse-button ${collapsedBlocks.detalhamento ? 'collapsed' : ''}`}><i className="bi bi-chevron-down"></i></button>
                </div>
                <div className={`analysis-block-content ${collapsedBlocks.detalhamento ? 'collapsed' : ''}`}>
                    <TableWrapper title="" onExpandClick={() => setIsTableModalOpen(true)}>
                        {isLoading ? <p>Carregando detalhes...</p> : <DetalhesRealizadasTable data={tabelaDetalhesData} />}
                    </TableWrapper>
                </div>
            </div>

            <ChartModal isOpen={!!chartInModal} onClose={() => setChartInModal(null)} chartTitle={chartInModal?.title}>
                {chartInModal?.chart}
            </ChartModal>

            <TableModal isOpen={isTableModalOpen} onClose={() => setIsTableModalOpen(false)} title="Detalhamento Avançado das Preventivas Antecipadas" columns={tableColumns} rows={tabelaDetalhesData} />
        </>
    );
};

export default SubAbaAntecipacao;
