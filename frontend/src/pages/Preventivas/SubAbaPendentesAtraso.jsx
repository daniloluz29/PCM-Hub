import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer, Cell } from 'recharts';
import ChartWrapper from '../../components/ChartWrapper.jsx';
import ChartModal from '../../components/ChartModal.jsx';
import TableWrapper from '../../components/TableWrapper.jsx';
import TableModal from '../../components/TableModal.jsx';
import Select from 'react-select';

// --- Componentes Auxiliares ---
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="custom-tooltip">
        <p className="label">{`${label}`}</p>
        <p className="desc">{`Quantidade: ${data.count}`}</p>
      </div>
    );
  }
  return null;
};

const CustomAxisTick = ({ x, y, payload }) => {
  if (!payload) return null;
  const truncatedValue = payload.value.length > 20 ? `${payload.value.substring(0, 20)}...` : payload.value;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{payload.value}</title>
      <text x={0} y={0} dy={10} textAnchor="end" fill="#666" fontSize={10} transform="rotate(-45)">{truncatedValue}</text>
    </g>
  );
};

// --- Componente Principal ---
const SubAbaPendentesAtraso = ({ setSidebarContent, globalFilters, currentUser, clearFiltersTrigger, isActive }) => {
    const [pendentesAtrasoData, setPendentesAtrasoData] = useState([]);
    const [tabelaAtrasoData, setTabelaAtrasoData] = useState([]);
    const [kpis, setKpis] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingKpis, setIsLoadingKpis] = useState(true);
    const [error, setError] = useState(null);
    const [chartInModal, setChartInModal] = useState(null);
    const [isTableModalOpen, setIsTableModalOpen] = useState(false);
    const [activeClick, setActiveClick] = useState([]);
    const [filterSourceChart, setFilterSourceChart] = useState(null);
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);
    const [isAccordionOpen, setIsAccordionOpen] = useState(true);
    
    const [sidebarFilters, setSidebarFilters] = useState({ dateRange: { inicio: '', fim: '' }, tipos: [], classificacoes: [] });
    const [classificacaoOptions, setClassificacaoOptions] = useState([]);
    const tipoOptions = [{ value: 'Por tempo', label: 'Por tempo' }, { value: 'Marco', label: 'Marco' }];
    const visao = globalFilters?.visao?.label || 'Contrato';

    useEffect(() => {
        const handleKeyDown = (event) => { if (event.key === 'Control') setIsCtrlPressed(true); };
        const handleKeyUp = (event) => { if (event.key === 'Control') setIsCtrlPressed(false); };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, []);

    useEffect(() => {
        if (clearFiltersTrigger > 0) {
            setSidebarFilters({ dateRange: { inicio: '', fim: '' }, tipos: [], classificacoes: [] });
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
            } catch (err) { console.error("Erro ao buscar opções de filtro:", err); }
        };
        fetchFilterOptions();
    }, []);

    const buildBaseParams = () => {
        const params = new URLSearchParams();
        if (currentUser && currentUser.perfil_id !== 'master_admin') params.append('user_contracts', currentUser.liberacao_dados || '');
        if (globalFilters.visao) params.append('visao', globalFilters.visao.value);
        if (globalFilters.exibicao) params.append('exibicao', globalFilters.exibicao.value);
        ['superintendencias', 'nucleos', 'contratos', 'estados', 'controladores', 'gestores'].forEach(key => {
            if (globalFilters[key]?.length > 0) params.append(key, globalFilters[key].map(item => item.value).join(','));
        });
        if (sidebarFilters.dateRange.inicio && sidebarFilters.dateRange.fim) {
            params.append('data_inicio', sidebarFilters.dateRange.inicio);
            params.append('data_fim', sidebarFilters.dateRange.fim);
        }
        if (sidebarFilters.tipos.length > 0) params.append('tipos', sidebarFilters.tipos.map(t => t.value).join(','));
        if (sidebarFilters.classificacoes.length > 0) params.append('classificacoes', sidebarFilters.classificacoes.map(c => c.value).join(','));
        return params;
    };

    useEffect(() => {
        const fetchChartData = async () => {
            if (!currentUser || !isActive) { setIsLoading(false); return; }
            try {
                setIsLoading(true);
                const params = buildBaseParams();
                const statusRes = await fetch(`http://127.0.0.1:5000/api/preventivas/pendentes-status?${params.toString()}`);
                if (!statusRes.ok) throw new Error(`Falha ao buscar dados dos gráficos.`);
                const statusResult = await statusRes.json();
                setPendentesAtrasoData(statusResult.em_atraso || []);
                setError(null);
            } catch (e) { setError(e.message); } 
            finally { setIsLoading(false); }
        };
        if(isActive) fetchChartData();
    }, [globalFilters, currentUser, sidebarFilters, isActive]);

    useEffect(() => {
        const fetchFilteredData = async () => {
            if (!currentUser || !isActive) { setIsLoadingKpis(false); return; }
            try {
                setIsLoadingKpis(true);
                const params = buildBaseParams();
                const grupoFilters = activeClick.filter(f => f.type === 'grupo');
                if (grupoFilters.length > 0) {
                    const visaoParam = (globalFilters.visao?.value || 'Contrato').toLowerCase();
                    const visaoDrillDownMapping = { 'contrato': 'contrato_nome', 'núcleo': 'nucleo_nome', 'superintendência': 'super_nome' };
                    params.append(visaoDrillDownMapping[visaoParam] || 'contrato_nome', grupoFilters.map(f => f.value).join(','));
                }

                const [detalhesAtrasoRes, kpisRes] = await Promise.all([
                    fetch(`http://127.0.0.1:5000/api/preventivas/pendentes-detalhes?${params.toString()}`),
                    fetch(`http://127.0.0.1:5000/api/preventivas/kpis-pendentes?${params.toString()}`)
                ]);
                
                if (!detalhesAtrasoRes.ok || !kpisRes.ok) throw new Error(`Falha ao buscar dados detalhados.`);
                
                const detalhesAtrasoResult = await detalhesAtrasoRes.json();
                const kpisResult = await kpisRes.json();

                setTabelaAtrasoData(detalhesAtrasoResult || []);
                setKpis(kpisResult);
                setError(null);
            } catch (e) { setError(e.message); } 
            finally { setIsLoadingKpis(false); }
        };
        if(isActive) fetchFilteredData();
    }, [globalFilters, currentUser, sidebarFilters, isActive, activeClick]);

    useEffect(() => {
        if (isActive) {
            setSidebarContent(
                <>
                    <div className="filter-group"><label>Período de Vencimento</label><input type="date" value={sidebarFilters.dateRange.inicio} onChange={e => setSidebarFilters(p => ({ ...p, dateRange: { ...p.dateRange, inicio: e.target.value }}))} /><input type="date" value={sidebarFilters.dateRange.fim} onChange={e => setSidebarFilters(p => ({ ...p, dateRange: { ...p.dateRange, fim: e.target.value }}))} /></div>
                    <div className="filter-group"><label>Tipo de Preventiva</label><Select isMulti options={tipoOptions} value={sidebarFilters.tipos} onChange={s => setSidebarFilters(p => ({ ...p, tipos: s || [] }))} placeholder="Todos" /></div>
                    <div className="filter-group"><label>Classificação</label><Select isMulti options={classificacaoOptions} value={sidebarFilters.classificacoes} onChange={s => setSidebarFilters(p => ({ ...p, classificacoes: s || [] }))} placeholder="Todas" /></div>
                </>
            );
        }
    }, [isActive, setSidebarContent, sidebarFilters, classificacaoOptions]);

    const handleChartClick = (type, data, event, chartId) => {
        if (!data) return;
        const newSelection = { type, value: data.nome_grupo };
        setActiveClick(prev => {
            const isAlreadySelected = prev.some(item => item.value === newSelection.value);
            if (isCtrlPressed) return isAlreadySelected ? prev.filter(item => item.value !== newSelection.value) : [...prev, newSelection];
            return isAlreadySelected && prev.length === 1 ? [] : [newSelection];
        });
        setFilterSourceChart(prev => {
            const isSameChart = prev === chartId;
            const isSelectionCleared = !isCtrlPressed && activeClick.length === 1 && activeClick[0].value === newSelection.value;
            return isSelectionCleared || (isSameChart && !isCtrlPressed) ? null : chartId;
        });
    };

    const tableColumns = useMemo(() => [{ key: 'Centro de custo', name: 'Centro de Custo', resizable: true }, { key: 'Equipamento', name: 'Equipamento', resizable: true }, { key: 'Nº OS', name: 'Nº OS', resizable: true }, { key: 'SL Fluig', name: 'SL Fluig', resizable: true }, { key: 'Data Vencimento', name: 'Data Vencimento', resizable: true, type: 'date' }, { key: 'Horimetro Vencimento', name: 'Horímetro Vencimento', resizable: true }, { key: 'Horimetro Atual', name: 'Horímetro Atual', resizable: true }], []);

    const GenericBarChart = ({ data, dataKey, xAxisKey, chartId, onClickHandler, chartColor }) => (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} isAnimationActive={false}>
                <XAxis dataKey={xAxisKey} interval={0} height={100} tick={<CustomAxisTick />} />
                <YAxis tick={false} tickLine={false} axisLine={false} />
                {!isCtrlPressed && <Tooltip content={<CustomTooltip />} />}
                <Bar dataKey={dataKey} onClick={(data, index, event) => onClickHandler('grupo', data, event, chartId)} isAnimationActive={false}>
                    {data.map((entry, index) => {
                        const isAnyFilterActive = activeClick.length > 0;
                        const isThisBarSelected = activeClick.some(f => f.value === entry[xAxisKey]);
                        const isFiltered = isAnyFilterActive && !isThisBarSelected;
                        return <Cell key={`cell-${index}`} fill={isFiltered ? '#dcdcdc' : chartColor} style={{ cursor: 'pointer' }} />;
                    })}
                    <LabelList dataKey={dataKey} position="top" fontSize={12} fontWeight="bold" fill="#2c3e50" />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );

    return (
        <>
            <div className="analysis-block">
                <div className="analysis-block-title" onClick={() => setIsAccordionOpen(!isAccordionOpen)}>
                    <h2>Pendentes em Atraso</h2>
                    <button className={`collapse-button ${isAccordionOpen ? '' : 'collapsed'}`}><i className="bi bi-chevron-down"></i></button>
                </div>
                <div className={`analysis-block-content ${isAccordionOpen ? '' : 'collapsed'}`}>
                    <div className="dashboard-grid full-width-grid">
                        <ChartWrapper title={`Quantitativo por ${visao}`} onPhotoModeClick={() => setChartInModal({ title: `Pendentes em Atraso por ${visao}`, chart: <GenericBarChart data={pendentesAtrasoData} dataKey="count" xAxisKey="nome_grupo" chartColor="#e87722" /> })} isFilterSource={filterSourceChart === 'atrasoChart'} kpiCards={[{ title: 'Total Pendentes', value: kpis.total_pendentes || 0 }, { title: 'Em Atraso', value: kpis.total_em_atraso || 0 }]}>
                            {isLoading ? <p>Carregando...</p> : error ? <p style={{ color: 'red' }}>{error}</p> : <GenericBarChart data={pendentesAtrasoData} dataKey="count" xAxisKey="nome_grupo" chartId="atrasoChart" onClickHandler={handleChartClick} chartColor="#e87722" />}
                        </ChartWrapper>
                    </div>
                    <TableWrapper title="Detalhes das Preventivas em Atraso" onExpandClick={() => setIsTableModalOpen(true)}>
                        {isLoadingKpis ? <p>Carregando tabela...</p> : <div className="table-container" style={{ maxHeight: '400px' }}><table className="data-table"><thead><tr>{tableColumns.map(c => <th key={c.key}>{c.name}</th>)}</tr></thead><tbody>{tabelaAtrasoData.map((row, index) => <tr key={index}>{tableColumns.map(c => <td key={c.key}>{row[c.key]}</td>)}</tr>)}</tbody></table></div>}
                    </TableWrapper>
                </div>
            </div>
            <ChartModal isOpen={!!chartInModal} onClose={() => setChartInModal(null)} chartTitle={chartInModal?.title}>{chartInModal?.chart}</ChartModal>
            <TableModal isOpen={isTableModalOpen} onClose={() => setIsTableModalOpen(false)} title="Detalhamento Avançado - Preventivas em Atraso" columns={tableColumns} rows={tabelaAtrasoData}/>
        </>
    );
};

export default SubAbaPendentesAtraso;
