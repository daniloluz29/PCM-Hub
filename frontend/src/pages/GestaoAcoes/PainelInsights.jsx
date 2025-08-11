import React, { useMemo, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Legend as PieLegend } from 'recharts';
import html2canvas from 'html2canvas'; // Certifique-se de que esta biblioteca está disponível

// --- COMPONENTES DE GRÁFICO (MODO FOTO) ---
const ChartModal = ({ isOpen, onClose, chartTitle, children }) => {
    if (!isOpen) return null;
    const chartContainerRef = useRef(null);
    const [copyStatus, setCopyStatus] = useState('Copiar Imagem');

    const handleCopyChart = () => {
        if (chartContainerRef.current) {
            setCopyStatus('Copiando...');
            html2canvas(chartContainerRef.current, { backgroundColor: '#ffffff', scale: 2 }).then(canvas => {
                canvas.toBlob(blob => {
                    if (typeof ClipboardItem === "undefined") {
                         setCopyStatus('API indisponível');
                         console.error("A API ClipboardItem não está disponível neste contexto.");
                         setTimeout(() => { setCopyStatus('Copiar Imagem'); }, 2000);
                         return;
                    }
                    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                        .then(() => {
                            setCopyStatus('Copiado!');
                            setTimeout(() => { setCopyStatus('Copiar Imagem'); onClose(); }, 1500);
                        })
                        .catch(err => {
                            setCopyStatus('Falhou!');
                            console.error("Erro ao copiar para a área de transferência:", err);
                        });
                });
            });
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content chart-modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header"><h3>{chartTitle}</h3><button onClick={onClose} className="modal-close-btn">&times;</button></div>
                <div className="chart-modal-body" ref={chartContainerRef}>
                    <div style={{ width: '100%', height: '400px' }}>
                        {children}
                    </div>
                </div>
                <div className="modal-footer chart-modal-footer">
                    <button onClick={handleCopyChart} className="modal-button confirm"><i className="bi bi-clipboard-check"></i> {copyStatus}</button>
                </div>
            </div>
        </div>
    );
};

const ChartWrapper = ({ title, onPhotoModeClick, children }) => (
    <div className="card chart-wrapper">
        <div className="chart-header">
            <h3>{title}</h3>
            <div>
                <button className="photo-mode-btn" onClick={onPhotoModeClick} title="Modo Foto"><i className="bi bi-camera"></i></button>
            </div>
        </div>
        {children}
    </div>
);


// Cores para o gráfico de pizza
const COLORS = {
    'A Fazer': '#3498db',
    'Em Andamento': '#f1c40f',
    'Atrasadas': '#e74c3c',
};

// Componente para a lista de tarefas (Atrasadas e Próximos Vencimentos)
const TaskList = ({ title, tasks, type }) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return (
        <div className="card">
            <h3>{title}</h3>
            <div className="table-container" style={{ maxHeight: '220px' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Tarefa</th>
                            <th>Responsável</th>
                            <th>{type === 'atraso' ? 'Dias Atraso' : 'Vencimento'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.length > 0 ? tasks.map(task => {
                            const prazo = new Date(task.data_prazo);
                            const diffTime = prazo - hoje;
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            const responsavelPrincipal = task.responsaveis[0]?.nome || 'N/A';

                            return (
                                <tr key={task.id}>
                                    <td>{task.titulo}</td>
                                    <td>{responsavelPrincipal}</td>
                                    <td>
                                        {type === 'atraso' 
                                            ? `${Math.abs(diffDays)} dia(s)` 
                                            : new Date(task.data_prazo).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan="3" style={{ textAlign: 'center' }}>Nenhuma tarefa encontrada.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


function PainelInsights({ itens, usuarios }) {
    const [chartInModal, setChartInModal] = useState(null);
    const [activeFilters, setActiveFilters] = useState({ status: null, responsavelId: null });

    const handlePieClick = (data) => {
        setActiveFilters(prev => ({ ...prev, status: prev.status === data.name ? null : data.name, responsavelId: null }));
    };

    const handleBarClick = (data) => {
        setActiveFilters(prev => ({ ...prev, responsavelId: prev.responsavelId === data.id ? null : data.id, status: null }));
    };
    
    const resetFilter = (filterType) => {
        setActiveFilters(prev => ({ ...prev, [filterType]: null }));
    };
    
    const chartData = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const tarefasAtivas = itens.filter(item => item.status !== 'Concluído' && item.status !== 'Cancelado');
        const tarefasAtrasadas = tarefasAtivas.filter(item => new Date(item.data_prazo) < hoje);

        const statusData = [
            { name: 'A Fazer', value: tarefasAtivas.filter(t => t.status === 'A Fazer' && !tarefasAtrasadas.includes(t)).length },
            { name: 'Em Andamento', value: tarefasAtivas.filter(t => t.status === 'Em Andamento' && !tarefasAtrasadas.includes(t)).length },
            { name: 'Atrasadas', value: tarefasAtrasadas.length },
        ].filter(d => d.value > 0);

        const cargaPorResponsavel = usuarios.map(user => {
            const count = tarefasAtivas.filter(item => item.responsaveis.some(resp => resp.id === user.id)).length;
            return { id: user.id, name: user.nome.split(' ')[0], tarefas: count };
        }).filter(u => u.tarefas > 0).sort((a, b) => b.tarefas - a.tarefas);

        return { statusData, cargaPorResponsavel };
    }, [itens, usuarios]);


    const insights = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        let filteredItems = [...itens];
        if (activeFilters.status) {
            if (activeFilters.status === 'Atrasadas') {
                filteredItems = filteredItems.filter(item => new Date(item.data_prazo) < hoje && item.status !== 'Concluído' && item.status !== 'Cancelado');
            } else {
                filteredItems = filteredItems.filter(item => item.status === activeFilters.status && new Date(item.data_prazo) >= hoje);
            }
        }
        if (activeFilters.responsavelId) {
            filteredItems = filteredItems.filter(item => item.responsaveis.some(resp => resp.id === activeFilters.responsavelId));
        }

        const umaSemanaAtras = new Date();
        umaSemanaAtras.setDate(hoje.getDate() - 7);

        const tarefasAtivas = filteredItems.filter(item => item.status !== 'Concluído' && item.status !== 'Cancelado');
        const tarefasAtrasadas = tarefasAtivas.filter(item => new Date(item.data_prazo) < hoje);
        
        // ATUALIZAÇÃO: Lógica para usar a data de conclusão real
        const concluidasNaSemana = filteredItems.filter(item => {
            if (item.status === 'Concluído' && item.data_conclusao) {
                const dataConclusao = new Date(item.data_conclusao);
                return dataConclusao >= umaSemanaAtras && dataConclusao <= hoje;
            }
            return false;
        });

        const responsaveisAtivos = new Set();
        tarefasAtivas.forEach(item => {
            item.responsaveis.forEach(resp => responsaveisAtivos.add(resp.id));
        });
        const cargaMedia = responsaveisAtivos.size > 0 ? (tarefasAtivas.length / responsaveisAtivos.size).toFixed(1) : 0;

        const proximosVencimentos = tarefasAtivas
            .filter(item => {
                const prazo = new Date(item.data_prazo);
                const diffTime = prazo - hoje;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays >= 0 && diffDays <= 3;
            })
            .sort((a, b) => new Date(a.data_prazo) - new Date(b.data_prazo));
            
        return {
            totalAtivas: tarefasAtivas.length,
            totalAtrasadas: tarefasAtrasadas.length,
            totalConcluidasSemana: concluidasNaSemana.length,
            cargaMedia,
            tarefasAtrasadas: tarefasAtrasadas.sort((a, b) => new Date(a.data_prazo) - new Date(b.data_prazo)).slice(0, 5),
            proximosVencimentos
        };
    }, [itens, activeFilters]);

    const displayChartData = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        if (activeFilters.responsavelId) {
            const itensDoResponsavel = itens.filter(item => item.responsaveis.some(resp => resp.id === activeFilters.responsavelId));
            const tarefasAtivas = itensDoResponsavel.filter(item => item.status !== 'Concluído' && item.status !== 'Cancelado');
            const tarefasAtrasadas = tarefasAtivas.filter(item => new Date(item.data_prazo) < hoje);
            const statusData = [
                { name: 'A Fazer', value: tarefasAtivas.filter(t => t.status === 'A Fazer' && !tarefasAtrasadas.includes(t)).length },
                { name: 'Em Andamento', value: tarefasAtivas.filter(t => t.status === 'Em Andamento' && !tarefasAtrasadas.includes(t)).length },
                { name: 'Atrasadas', value: tarefasAtrasadas.length },
            ].filter(d => d.value > 0);
            return { ...chartData, statusData };
        }

        if (activeFilters.status) {
            let itensComStatus;
            if (activeFilters.status === 'Atrasadas') {
                itensComStatus = itens.filter(item => new Date(item.data_prazo) < hoje && item.status !== 'Concluído' && item.status !== 'Cancelado');
            } else {
                itensComStatus = itens.filter(item => item.status === activeFilters.status && new Date(item.data_prazo) >= hoje);
            }
            const cargaPorResponsavel = usuarios.map(user => {
                const count = itensComStatus.filter(item => item.responsaveis.some(resp => resp.id === user.id)).length;
                return { id: user.id, name: user.nome.split(' ')[0], tarefas: count };
            }).filter(u => u.tarefas > 0).sort((a, b) => b.tarefas - a.tarefas);
            return { ...chartData, cargaPorResponsavel };
        }

        return chartData;
    }, [chartData, activeFilters, itens, usuarios]);

    const pieChart = (
        <ResponsiveContainer>
            <PieChart>
                <Pie data={displayChartData.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label onClick={handlePieClick}>
                    {displayChartData.statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name]} cursor="pointer" opacity={activeFilters.status && activeFilters.status !== entry.name ? 0.4 : 1} />
                    ))}
                </Pie>
                <Tooltip />
                <PieLegend />
            </PieChart>
        </ResponsiveContainer>
    );

    const barChart = (
        <ResponsiveContainer>
            <BarChart data={displayChartData.cargaPorResponsavel} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip />
                <Legend />
                <Bar dataKey="tarefas" name="Tarefas Ativas" fill="#8884d8" onClick={handleBarClick}>
                    {displayChartData.cargaPorResponsavel.map((entry, index) => (
                        <Cell key={`cell-${index}`} cursor="pointer" opacity={activeFilters.responsavelId && activeFilters.responsavelId !== entry.id ? 0.4 : 1} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );

    return (
        <>
            <div className="insights-panel">
                {/* 1. KPIs Principais */}
                <div className="kpi-row">
                    <div className="kpi-card"><div className="kpi-title">Total de Tarefas Ativas</div><div className="kpi-value">{insights.totalAtivas}</div></div>
                    <div className="kpi-card"><div className="kpi-title">Tarefas em Atraso</div><div className="kpi-value" style={{color: insights.totalAtrasadas > 0 ? '#e74c3c' : ''}}>{insights.totalAtrasadas}</div></div>
                    <div className="kpi-card"><div className="kpi-title">Concluídas na Semana</div><div className="kpi-value">{insights.totalConcluidasSemana}</div></div>
                    <div className="kpi-card"><div className="kpi-title">Carga Média / Membro</div><div className="kpi-value">{insights.cargaMedia}</div></div>
                </div>

                {/* 2. Visualizações Gráficas */}
                <div className="insights-grid">
                    <ChartWrapper
                        title="Status das Tarefas Ativas"
                        onPhotoModeClick={() => setChartInModal({ title: "Status das Tarefas Ativas", chart: pieChart })}
                    >
                        <div className="chart-container">{pieChart}</div>
                    </ChartWrapper>
                    <ChartWrapper
                        title="Carga de Trabalho por Responsável"
                        onPhotoModeClick={() => setChartInModal({ title: "Carga de Trabalho por Responsável", chart: barChart })}
                    >
                        <div className="chart-container">{barChart}</div>
                    </ChartWrapper>
                </div>

                {/* 3. Listas de Ação Rápida */}
                 <div className="dashboard-grid">
                    <TaskList title="Tarefas em Atraso (Top 5)" tasks={insights.tarefasAtrasadas} type="atraso" />
                    <TaskList title="Próximos Vencimentos (3 dias)" tasks={insights.proximosVencimentos} type="vencimento" />
                </div>
            </div>

            <ChartModal isOpen={!!chartInModal} onClose={() => setChartInModal(null)} chartTitle={chartInModal?.title}>
                {chartInModal?.chart}
            </ChartModal>
        </>
    );
}

export default PainelInsights;
