import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer, Cell } from 'recharts';
import ChartWrapper from '../../components/ChartWrapper.jsx';
import ChartModal from '../../components/ChartModal.jsx';
import TableWrapper from '../../components/TableWrapper.jsx';
import TableModal from '../../components/TableModal.jsx';
import Select from 'react-select';

// --- Componentes Auxiliares de Gráfico (Reutilizados e Aprimorados) ---

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

// --- Componente Principal da Sub-Aba ---

const SubAbaPendentes = ({ setSidebarContent, globalFilters, currentUser, clearFiltersTrigger, isActive }) => {
    // Estados para os dados da API
    const [pendentesAtrasoData, setPendentesAtrasoData] = useState([]);
    const [pendentesEmDiaData, setPendentesEmDiaData] = useState([]);
    const [tabelaAtrasoData, setTabelaAtrasoData] = useState([]);
    const [tabelaEmDiaData, setTabelaEmDiaData] = useState([]);
    const [kpis, setKpis] = useState({});

    // Estados de controle da UI
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingKpis, setIsLoadingKpis] = useState(true); // Loading separado para KPIs/Tabelas
    const [error, setError] = useState(null);
    const [chartInModal, setChartInModal] = useState(null);
    const [isAccordionAtrasoOpen, setIsAccordionAtrasoOpen] = useState(true);
    const [isAccordionEmDiaOpen, setIsAccordionEmDiaOpen] = useState(true);
    
    // Estados para os modais das tabelas
    const [isAtrasoModalOpen, setIsAtrasoModalOpen] = useState(false);
    const [isEmDiaModalOpen, setIsEmDiaModalOpen] = useState(false);

    // Estados para filtros interativos (clique nos gráficos)
    const [activeClick, setActiveClick] = useState([]);
    const [filterSourceChart, setFilterSourceChart] = useState(null);
    const [isCtrlPressed, setIsCtrlPressed] = useState(false);

    const [sidebarFilters, setSidebarFilters] = useState({
        dateRange: {
            inicio: '',
            fim: ''
        },
        tipos: [],
        classificacoes: []
    });

    const [classificacaoOptions, setClassificacaoOptions] = useState([]);
    const tipoOptions = [{ value: 'Por tempo', label: 'Por tempo' }, { value: 'Marco', label: 'Marco' }];
    
    const visao = globalFilters?.visao?.label || 'Contrato';

    // Efeito para detectar a tecla CTRL pressionada
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

    // Efeito para limpar os filtros da sidebar
    useEffect(() => {
        if (clearFiltersTrigger > 0) {
            setSidebarFilters({
                dateRange: { inicio: '', fim: '' },
                tipos: [],
                classificacoes: []
            });
            setActiveClick([]);
            setFilterSourceChart(null);
        }
    }, [clearFiltersTrigger]);

    // Efeito para buscar as opções de classificação para o filtro
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

    // Função auxiliar para construir parâmetros base
    const buildBaseParams = () => {
        const params = new URLSearchParams();
        if (currentUser && currentUser.perfil_id !== 'master_admin') {
            params.append('user_contracts', currentUser.liberacao_dados || '');
        }
        if (globalFilters.visao) params.append('visao', globalFilters.visao.value);
        if (globalFilters.exibicao) params.append('exibicao', globalFilters.exibicao.value);
        
        // CORREÇÃO #2: Adiciona os filtros globais que estavam faltando
        ['superintendencias', 'nucleos', 'contratos', 'estados', 'controladores', 'gestores'].forEach(key => {
            if (globalFilters[key]?.length > 0) {
                params.append(key, globalFilters[key].map(item => item.value).join(','));
            }
        });

        if (sidebarFilters.dateRange.inicio && sidebarFilters.dateRange.fim) {
            params.append('data_inicio', sidebarFilters.dateRange.inicio);
            params.append('data_fim', sidebarFilters.dateRange.fim);
        }
        if (sidebarFilters.tipos.length > 0) params.append('tipos', sidebarFilters.tipos.map(t => t.value).join(','));
        if (sidebarFilters.classificacoes.length > 0) params.append('classificacoes', sidebarFilters.classificacoes.map(c => c.value).join(','));
        return params;
    };

    // Efeito #1: Busca os dados para os GRÁFICOS. 
    useEffect(() => {
        const fetchChartData = async () => {
            if (!currentUser || !isActive) {
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                const params = buildBaseParams();
                const statusRes = await fetch(`http://127.0.0.1:5000/api/preventivas/pendentes-status?${params.toString()}`);
                if (!statusRes.ok) throw new Error(`Falha ao buscar dados dos gráficos.`);
                const statusResult = await statusRes.json();
                setPendentesAtrasoData(statusResult.em_atraso || []);
                setPendentesEmDiaData(statusResult.em_dia || []);
                setError(null);
            } catch (e) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchChartData();
    }, [globalFilters, currentUser, sidebarFilters, isActive]);


    // Efeito #2: Busca dados para KPIs e TABELAS.
    useEffect(() => {
        const fetchFilteredData = async () => {
            if (!currentUser || !isActive) {
                setIsLoadingKpis(false);
                return;
            }
            try {
                setIsLoadingKpis(true);
                const params = buildBaseParams();
                
                const grupoFilters = activeClick.filter(f => f.type === 'grupo');
                if (grupoFilters.length > 0) {
                    const visaoParam = (globalFilters.visao?.value || 'Contrato').toLowerCase();
                    const visaoDrillDownMapping = { 'contrato': 'contrato_nome', 'núcleo': 'nucleo_nome', 'superintendência': 'super_nome' };
                    params.append(visaoDrillDownMapping[visaoParam] || 'contrato_nome', grupoFilters.map(f => f.value).join(','));
                }

                const [detalhesAtrasoRes, detalhesEmDiaRes, kpisRes] = await Promise.all([
                    fetch(`http://127.0.0.1:5000/api/preventivas/pendentes-detalhes?${params.toString()}`),
                    fetch(`http://127.0.0.1:5000/api/preventivas/pendentes-em-dia-detalhes?${params.toString()}`),
                    fetch(`http://127.0.0.1:5000/api/preventivas/kpis-pendentes?${params.toString()}`)
                ]);
                
                if (!detalhesAtrasoRes.ok || !detalhesEmDiaRes.ok || !kpisRes.ok) throw new Error(`Falha ao buscar dados detalhados.`);

                const detalhesAtrasoResult = await detalhesAtrasoRes.json();
                const detalhesEmDiaResult = await detalhesEmDiaRes.json();
                const kpisResult = await kpisRes.json();

                setTabelaAtrasoData(detalhesAtrasoResult || []);
                setTabelaEmDiaData(detalhesEmDiaResult || []);
                setKpis(kpisResult);
                setError(null);
            } catch (e) {
                setError(e.message);
            } finally {
                setIsLoadingKpis(false);
            }
        };
        fetchFilteredData();
    }, [globalFilters, currentUser, sidebarFilters, isActive, activeClick]);


    // Efeito para popular a sidebar de filtros
    useEffect(() => {
        if (isActive) {
            setSidebarContent(
                <>
                    <div className="filter-group">
                        <label>Período de Vencimento</label>
                        <input type="date" value={sidebarFilters.dateRange.inicio} onChange={(e) => setSidebarFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, inicio: e.target.value }}))} />
                        <input type="date" value={sidebarFilters.dateRange.fim} onChange={(e) => setSidebarFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, fim: e.target.value }}))} />
                    </div>
                    <div className="filter-group"><label>Tipo de Preventiva</label><Select isMulti options={tipoOptions} value={sidebarFilters.tipos} onChange={(selected) => setSidebarFilters(prev => ({ ...prev, tipos: selected || [] }))} placeholder="Todos" /></div>
                    <div className="filter-group"><label>Classificação</label><Select isMulti options={classificacaoOptions} value={sidebarFilters.classificacoes} onChange={(selected) => setSidebarFilters(prev => ({ ...prev, classificacoes: selected || [] }))} placeholder="Todas" /></div>
                </>
            );
        }
    }, [isActive, setSidebarContent, sidebarFilters, classificacaoOptions]);

    // Função para lidar com cliques nos gráficos
    const handleChartClick = (type, data, event, chartId) => {
        if (!data) return;
        const newSelection = { type, value: data.nome_grupo };
        
        setActiveClick(prev => {
            const isAlreadySelected = prev.some(item => item.value === newSelection.value);
            if (isCtrlPressed) {
                return isAlreadySelected ? prev.filter(item => item.value !== newSelection.value) : [...prev, newSelection];
            } else {
                return isAlreadySelected && prev.length === 1 ? [] : [newSelection];
            }
        });

        setFilterSourceChart(prevChart => {
            const isSameChart = prevChart === chartId;
            const isSelectionCleared = !isCtrlPressed && activeClick.length === 1 && activeClick[0].value === newSelection.value;
            return isSelectionCleared || (isSameChart && !isCtrlPressed) ? null : chartId;
        });
    };

    // Definição das colunas para o modal de tabela
    const tableColumns = useMemo(() => [
        { key: 'Centro de custo', name: 'Centro de Custo', resizable: true, type: 'text' },
        { key: 'Equipamento', name: 'Equipamento', resizable: true, type: 'text' },
        { key: 'Nº OS', name: 'Nº OS', resizable: true, type: 'numeric' },
        { key: 'SL Fluig', name: 'SL Fluig', resizable: true, type: 'numeric' },
        { key: 'Data Vencimento', name: 'Data Vencimento', resizable: true, type: 'date' },
        { key: 'Horimetro Vencimento', name: 'Horímetro Vencimento', resizable: true, type: 'numeric' },
        { key: 'Horimetro Atual', name: 'Horímetro Atual', resizable: true, type: 'numeric' }
    ], []);

    // Componente genérico para os gráficos de barra
    const GenericBarChart = ({ data, dataKey, xAxisKey, chartId, onClickHandler, chartColor }) => (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey={xAxisKey} interval={0} height={100} tick={<CustomAxisTick />} />
                <YAxis tick={false} tickLine={false} axisLine={false} />
                {!isCtrlPressed && <Tooltip content={<CustomTooltip />} />}
                <Bar dataKey={dataKey} onClick={(data, index, event) => onClickHandler('grupo', data, event, chartId)}>
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
                <div className="analysis-block-title" onClick={() => setIsAccordionAtrasoOpen(!isAccordionAtrasoOpen)}>
                    <h2>Pendentes em Atraso</h2>
                    <button className={`collapse-button ${isAccordionAtrasoOpen ? '' : 'collapsed'}`}><i className="bi bi-chevron-down"></i></button>
                </div>
                <div className={`analysis-block-content ${isAccordionAtrasoOpen ? '' : 'collapsed'}`}>
                    <div className="dashboard-grid full-width-grid">
                        <ChartWrapper 
                            title={`Quantitativo por ${visao}`}
                            onPhotoModeClick={() => setChartInModal({ title: `Pendentes em Atraso por ${visao}`, chart: <GenericBarChart data={pendentesAtrasoData} dataKey="count" xAxisKey="nome_grupo" chartColor="#c0392b" /> })}
                            isFilterSource={filterSourceChart === 'atrasoChart'}
                            kpiCards={[
                                { title: 'Total Pendentes', value: kpis.total_pendentes || 0 },
                                { title: 'Em Atraso', value: kpis.total_em_atraso || 0 }
                            ]}
                        >
                            {isLoading ? <p>Carregando...</p> : error ? <p style={{ color: 'red' }}>{error}</p> : 
                                <GenericBarChart data={pendentesAtrasoData} dataKey="count" xAxisKey="nome_grupo" chartId="atrasoChart" onClickHandler={handleChartClick} chartColor="#c0392b" />
                            }
                        </ChartWrapper>
                    </div>
                    <TableWrapper title="Detalhes das Preventivas em Atraso" onExpandClick={() => setIsAtrasoModalOpen(true)}>
                        {/* CORREÇÃO #1: Removido o .slice(0, 10) */}
                        {isLoadingKpis ? <p>Carregando tabela...</p> : <div className="table-container" style={{ maxHeight: '400px' }}><table className="data-table"><thead><tr>{tableColumns.map(c => <th key={c.key}>{c.name}</th>)}</tr></thead><tbody>{tabelaAtrasoData.map((row, index) => <tr key={index}>{tableColumns.map(c => <td key={c.key}>{row[c.key]}</td>)}</tr>)}</tbody></table></div>}
                    </TableWrapper>
                </div>
            </div>

            <div className="analysis-block">
                <div className="analysis-block-title" onClick={() => setIsAccordionEmDiaOpen(!isAccordionEmDiaOpen)}>
                    <h2>Pendentes em Dia</h2>
                    <button className={`collapse-button ${isAccordionEmDiaOpen ? '' : 'collapsed'}`}><i className="bi bi-chevron-down"></i></button>
                </div>
                <div className={`analysis-block-content ${isAccordionEmDiaOpen ? '' : 'collapsed'}`}>
                    <div className="dashboard-grid full-width-grid">
                         <ChartWrapper 
                            title={`Quantitativo por ${visao}`}
                            onPhotoModeClick={() => setChartInModal({ title: `Pendentes em Dia por ${visao}`, chart: <GenericBarChart data={pendentesEmDiaData} dataKey="count" xAxisKey="nome_grupo" chartColor="#27ae60" /> })}
                            isFilterSource={filterSourceChart === 'emDiaChart'}
                            kpiCards={[
                                { title: 'Em Dia', value: kpis.total_em_dia || 0 }
                            ]}
                        >
                            {isLoading ? <p>Carregando...</p> : error ? <p style={{ color: 'red' }}>{error}</p> : 
                                <GenericBarChart data={pendentesEmDiaData} dataKey="count" xAxisKey="nome_grupo" chartId="emDiaChart" onClickHandler={handleChartClick} chartColor="#27ae60" />
                            }
                        </ChartWrapper>
                    </div>
                    <TableWrapper title="Detalhes das Preventivas em Dia" onExpandClick={() => setIsEmDiaModalOpen(true)}>
                        {/* CORREÇÃO #1: Removido o .slice(0, 10) */}
                        {isLoadingKpis ? <p>Carregando tabela...</p> : <div className="table-container" style={{ maxHeight: '400px' }}><table className="data-table"><thead><tr>{tableColumns.map(c => <th key={c.key}>{c.name}</th>)}</tr></thead><tbody>{tabelaEmDiaData.map((row, index) => <tr key={index}>{tableColumns.map(c => <td key={c.key}>{row[c.key]}</td>)}</tr>)}</tbody></table></div>}
                    </TableWrapper>
                </div>
            </div>

            <ChartModal isOpen={!!chartInModal} onClose={() => setChartInModal(null)} chartTitle={chartInModal?.title}>
                {chartInModal?.chart}
            </ChartModal>
            
            <TableModal 
                isOpen={isAtrasoModalOpen}
                onClose={() => setIsAtrasoModalOpen(false)}
                title="Detalhamento Avançado - Preventivas em Atraso"
                columns={tableColumns}
                rows={tabelaAtrasoData}
            />
            
            <TableModal 
                isOpen={isEmDiaModalOpen}
                onClose={() => setIsEmDiaModalOpen(false)}
                title="Detalhamento Avançado - Preventivas em Dia"
                columns={tableColumns}
                rows={tabelaEmDiaData}
            />
        </>
    );
};

export default SubAbaPendentes;
