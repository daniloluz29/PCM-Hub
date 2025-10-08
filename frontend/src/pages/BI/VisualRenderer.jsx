import React, { useState, useEffect, useMemo } from 'react';
import { Bar, Pie, Line } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement,
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement, ChartDataLabels
);

ChartJS.defaults.font.family = "sans-serif";
ChartJS.defaults.font.weight = 'normal';


// --- COMPONENTE WRAPPER PARA TÍTULO E FUNDO ---
const VisualWrapper = ({ visualConfig, children }) => {
    const format = visualConfig.format || {};
    const showTitle = format.title?.show ?? true;
    const titleText = format.title?.text || visualConfig.name;
    
    const titleFont = format.title?.font || {};
    const titleColor = titleFont.color || '#333';
    const titleSize = titleFont.fontSize || 16;
    const titleWeight = titleFont.bold ? 'bold' : 'normal';

    const backgroundColor = format.background?.color;

    return (
        <div className="visual-wrapper" style={{ backgroundColor }}>
            {showTitle && (
                <h4 className="visual-title" style={{ color: titleColor, fontSize: `${titleSize}px`, fontWeight: titleWeight }}>
                    {titleText}
                </h4>
            )}
            <div className="visual-content">
                {children}
            </div>
        </div>
    );
};


// --- SUBCOMPONENTES PARA VISUAIS ESPECÍFICOS ---

const CardVisual = ({ data, visualConfig }) => {
    const format = visualConfig.format || {};
    const valueField = visualConfig.value;
    if (!valueField || !data || data.length === 0) return <div className="visual-card-no-data">N/D</div>;
    
    const valueKey = Object.keys(data[0])[0];
    const value = data[0][valueKey];

    const decimals = format.dataLabels?.decimals ?? 2;
    const font = format.dataLabels?.font || {};

    const formattedValue = typeof value === 'number' 
        ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
        : value;

    return (
        <VisualWrapper visualConfig={visualConfig}>
            <div className="visual-card">
                <h3 style={{ color: font.color, fontSize: font.fontSize ? `${font.fontSize}px` : '2.5rem', fontWeight: font.bold ? 'bold' : 'normal' }}>{formattedValue}</h3>
                {(format.cardLabel?.show ?? true) && <p style={{ color: format.title?.font?.color }}>{valueKey}</p>}
            </div>
        </VisualWrapper>
    );
};


const evaluateCondition = (cellValue, rule) => {
    const { condition, value1, value2 } = rule;
    let val = cellValue;

    const numVal = parseFloat(String(val).replace(',', '.'));
    if (!isNaN(numVal)) {
        val = numVal;
    }
    
    if (condition === 'is_blank') {
        return val === null || val === undefined || val === '';
    }

    if (typeof val === 'number') {
        const v1 = parseFloat(value1);
        const v2 = parseFloat(value2);
        switch (condition) {
            case '>': return val > v1;
            case '>=': return val >= v1;
            case '<': return val < v1;
            case '<=': return val <= v1;
            case '=': return val === v1;
            case 'between': return val >= v1 && val <= v2;
            case 'not_between': return val < v1 || val > v2;
            default: return false;
        }
    }

    if (typeof val === 'string') {
        const lowerVal = val.toLowerCase();
        const lowerV1 = String(value1).toLowerCase();
         switch (condition) {
            case 'contains': return lowerVal.includes(lowerV1);
            case 'not_contains': return !lowerVal.includes(lowerV1);
            case 'starts_with': return lowerVal.startsWith(lowerV1);
            case 'not_starts_with': return !lowerVal.startsWith(lowerV1);
            case 'is': return lowerVal === lowerV1;
            case 'is_not': return lowerVal !== lowerV1;
            default: return false;
        }
    }
    return false;
};

// --- INÍCIO DA CORREÇÃO: Lógica de aplicação de estilo condicional ---
// Esta função agora busca regras apenas na formatação da coluna específica.
const getConditionalStyle = (cellValue, headerKey, columnSettings) => {
    const settings = columnSettings[headerKey];
    if (!settings?.values?.conditionalRules) {
        return {};
    }

    // Itera sobre as regras NA ORDEM em que foram definidas
    for (const rule of settings.values.conditionalRules) {
        if (evaluateCondition(cellValue, rule)) {
            return { color: rule.color }; // Aplica a cor da primeira regra que der match
        }
    }

    return {}; // Nenhuma regra deu match
};
// --- FIM DA CORREÇÃO ---


const SortableTable = ({ data, visualConfig, headers }) => {
    const [sortConfig, setSortConfig] = useState(null);
    const format = visualConfig.format || {};
    const columnSettings = format.columnSettings || {};

    const sortedData = useMemo(() => {
        let sortableData = [...data];
        if (sortConfig !== null) {
            sortableData.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableData;
    }, [data, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const totals = useMemo(() => {
        if (!format.total?.show) return null;

        const calculatedTotals = {};
        headers.forEach((header, index) => {
            const columnConfig = visualConfig.columns.find(c => (c.displayName || c.columnName) === header);
            const aggregation = columnConfig?.aggregation;

            if (aggregation === 'none' || !aggregation) {
                calculatedTotals[header] = index === 0 ? 'Total' : '';
                return;
            }

            const values = data.map(row => {
                const raw = row[header];
                if (typeof raw === 'string') {
                    const num = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
                    return isNaN(num) ? 0 : num;
                }
                return typeof raw === 'number' ? raw : 0;
            }).filter(v => v !== null && v !== undefined);

            if (values.length === 0) {
                 calculatedTotals[header] = '';
                 return;
            }

            let result;
            switch (aggregation) {
                case 'sum':
                    result = values.reduce((acc, val) => acc + val, 0);
                    break;
                case 'average':
                    result = values.reduce((acc, val) => acc + val, 0) / values.length;
                    break;
                case 'count':
                    result = data.filter(row => row[header] != null).length;
                    break;
                case 'countd':
                    result = new Set(data.map(row => row[header]).filter(v => v != null)).size;
                    break;
                case 'min':
                     result = Math.min(...values);
                     break;
                case 'max':
                     result = Math.max(...values);
                     break;
                default:
                    result = '';
            }
            calculatedTotals[header] = typeof result === 'number' ? new Intl.NumberFormat('pt-BR').format(result) : result;
        });
        return calculatedTotals;
    }, [data, headers, visualConfig.columns, format.total?.show]);
    
    // --- INÍCIO DA CORREÇÃO: Lógica de aplicação de estilo da célula ---
    const getCellStyle = (headerKey, cellValue) => {
        const allSettings = columnSettings.all || {};
        const specificSettings = columnSettings[headerKey] || {};
        
        // 1. Começa com o estilo base (de "todas as colunas")
        const baseStyle = {
             color: allSettings.values?.font?.color,
             textAlign: allSettings.values?.align || 'left',
        };
        
        // 2. Sobrescreve com o estilo específico da coluna
        const specificStyle = {
            ...baseStyle,
            color: specificSettings.values?.font?.color || baseStyle.color,
            textAlign: specificSettings.values?.align || baseStyle.textAlign,
        };
        
        // 3. Busca o estilo condicional, que terá a maior prioridade
        const conditionalStyle = getConditionalStyle(cellValue, headerKey, columnSettings);

        // 4. Combina os estilos, garantindo que o condicional sobrescreva os outros
        return { ...specificStyle, ...conditionalStyle };
    };
    // --- FIM DA CORREÇÃO ---
    
     const getHeaderStyle = (headerKey) => {
        const allSettings = columnSettings.all || {};
        const specificSettings = columnSettings[headerKey] || {};
        return {
            color: specificSettings.header?.font?.color || allSettings.header?.font?.color,
            fontWeight: specificSettings.header?.font?.bold || allSettings.header?.font?.bold ? 'bold' : 'normal',
            backgroundColor: specificSettings.header?.backgroundColor || allSettings.header?.backgroundColor,
            textAlign: specificSettings.values?.align || allSettings.values?.align || 'left',
        };
    };

    return (
        <VisualWrapper visualConfig={visualConfig}>
            <div className="visual-table-container">
                <table className="visual-table">
                    <thead>
                        <tr>
                            {headers.map(header => (
                                <th key={header} onClick={() => requestSort(header)} className="sortable-header" style={getHeaderStyle(header)}>
                                    {header}
                                    {sortConfig?.key === header && (
                                        <i className={`bi bi-arrow-${sortConfig.direction === 'ascending' ? 'up' : 'down'} sort-icon`}></i>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((row, index) => (
                            <tr key={index}>
                                {headers.map(header => <td key={header} style={getCellStyle(header, row[header])}>{row[header]}</td>)}
                            </tr>
                        ))}
                    </tbody>
                    {totals && (
                        <tfoot>
                             <tr>
                                {headers.map(header => (
                                    <td key={header} style={{ textAlign: getHeaderStyle(header).textAlign }}>{totals[header]}</td>
                                ))}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </VisualWrapper>
    );
};


const MatrixVisual = ({ data, visualConfig }) => {
    const { rows, columns, values } = visualConfig;
    if (!rows?.length || !columns?.length || !values?.length) return <div className="visual-no-data">Configure linhas, colunas e valores.</div>;

    const rowKey = rows[0].displayName || rows[0].columnName;
    const colKey = columns[0].displayName || columns[0].columnName;
    const valKey = Object.keys(data[0]).find(k => k.includes(values[0].displayName || values[0].columnName));

    if (!valKey) return <div className="visual-no-data">Valor não encontrado nos dados.</div>;

    const uniqueRows = [...new Set(data.map(item => item[rowKey]))].sort();
    const uniqueCols = [...new Set(data.map(item => item[colKey]))].sort();

    const matrixData = uniqueRows.map(rowValue => {
        const rowData = { [rowKey]: rowValue };
        uniqueCols.forEach(colValue => {
            const cell = data.find(d => d[rowKey] === rowValue && d[colKey] === colValue);
            rowData[colValue] = cell ? cell[valKey] : null;
        });
        return rowData;
    });
    
    const headers = [rowKey, ...uniqueCols];

    return <SortableTable data={matrixData} visualConfig={visualConfig} headers={headers} />;
};

const TableVisual = ({ data, visualConfig }) => {
    if (!data || data.length === 0) return null;
    
    const headers = visualConfig.columns.map(c => c.displayName || c.columnName);

    return <SortableTable data={data} visualConfig={visualConfig} headers={headers} />;
};


const GaugeVisual = ({ data, visualConfig }) => {
    const format = visualConfig.format || {};
    const valueField = visualConfig.value;
    if (!valueField || !data || data.length === 0) return <div className="visual-card-no-data">N/D</div>;

    const valueKey = Object.keys(data[0]).find(k => k.includes(valueField.displayName || valueField.columnName));
    const minKey = visualConfig.minValue ? Object.keys(data[0]).find(k => k.includes(visualConfig.minValue.displayName)) : null;
    const maxKey = visualConfig.maxValue ? Object.keys(data[0]).find(k => k.includes(visualConfig.maxValue.displayName)) : null;

    const value = data[0][valueKey] || 0;
    const min = format.gauge?.min ?? (minKey && data[0][minKey] ? data[0][minKey] : 0);
    const max = format.gauge?.max ?? (maxKey && data[0][maxKey] ? data[0][maxKey] : 100);

    const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;
    const rotation = Math.min(Math.max(percentage, 0), 100) * 1.8 - 90;
    
    const valueColor = format.gauge?.valueColor || '#E87722';
    const bgColor = format.gauge?.backgroundColor || '#e9ecef';

    return (
        <VisualWrapper visualConfig={visualConfig}>
            <div className="visual-gauge">
                <svg viewBox="0 0 120 70" className="gauge-svg">
                    <path className="gauge-bg" d="M10 60 A 50 50 0 0 1 110 60" style={{ stroke: bgColor }} />
                    <path className="gauge-value" d="M10 60 A 50 50 0 0 1 110 60" style={{ strokeDasharray: `${percentage * Math.PI}, 315`, stroke: valueColor }} />
                    <g className="gauge-pointer" style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '60px 60px' }}>
                        <line x1="60" y1="60" x2="60" y2="20" />
                        <circle cx="60" cy="60" r="3" />
                    </g>
                </svg>
                <div className="gauge-text" style={{ color: format.title?.font?.color }}>{new Intl.NumberFormat('pt-BR').format(value)}</div>
            </div>
        </VisualWrapper>
    );
};


// --- COMPONENTE PRINCIPAL ---

const VisualRenderer = ({ visualConfig, pageFilters, chartKey }) => {
    const [result, setResult] = useState({ data: null, query: null });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!visualConfig || !visualConfig.hasData) {
                setResult({ data: null, query: null });
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch('http://127.0.0.1:5000/api/bi/visual-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ visual: visualConfig, pageFilters })
                });
                const resData = await response.json();
                if (!response.ok) throw new Error(resData.message || 'Falha ao buscar dados.');
                setResult(resData);
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [visualConfig, pageFilters]);

    if (isLoading) return <div className="visual-loading">Carregando...</div>;
    if (error) return <div className="visual-error" title={result.query}>Erro: {error}</div>;
    if (!result.data || result.data.length === 0) return <div className="visual-no-data">Sem dados para exibir.</div>;

    const { data } = result;
    const format = visualConfig.format || {};

    const getRandomColor = (index) => {
        const colors = ['rgba(232, 119, 34, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)', 'rgba(75, 192, 192, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 99, 132, 0.7)'];
        return colors[index % colors.length];
    };

    const prepareChartData = () => {
        const { id, legend, values, xAxis, yAxis, columnValues } = visualConfig;
        const emptyChart = { labels: [], datasets: [] };

        if (id === 'pie-chart') {
            if (!legend || !values) return emptyChart;
            const legendKey = legend.displayName || legend.columnName;
            const valueKey = Object.keys(data[0]).find(k => k.includes(values.displayName || values.columnName));
            if (!valueKey || data[0][legendKey] === undefined) return emptyChart;
            return {
                labels: data.map(item => item[legendKey]),
                datasets: [{ data: data.map(item => item[valueKey]), backgroundColor: data.map((_, i) => getRandomColor(i)) }]
            };
        }

        let axisFieldList = id === 'bar-chart' ? yAxis : xAxis;
        let valueFieldList = id === 'bar-chart' ? xAxis : (columnValues || yAxis);

        const axisFields = (Array.isArray(axisFieldList) ? axisFieldList : [axisFieldList]).filter(Boolean);
        const valueFields = (Array.isArray(valueFieldList) ? valueFieldList : [valueFieldList]).filter(Boolean);

        if (axisFields.length > 0 && valueFields.length > 0) {
            const axisKey = axisFields[0].displayName || axisFields[0].columnName;
            if (data[0][axisKey] === undefined) return emptyChart;

            const labels = [...new Set(data.map(item => item[axisKey]))].sort((a, b) => String(a).localeCompare(String(b), undefined, {numeric: true}));
            
            const datasets = valueFields.map((field, i) => {
                const valueKey = Object.keys(data[0]).find(k => k.includes(field.displayName || field.columnName));
                if (!valueKey) return { label: field.displayName || field.columnName, data: [] };
                
                return {
                    label: valueKey,
                    data: labels.map(label => {
                        const dataRow = data.find(d => d[axisKey] === label);
                        return dataRow ? dataRow[valueKey] : 0;
                    }),
                    backgroundColor: format.dataColors?.defaultColor || getRandomColor(i),
                    borderColor: format.dataColors?.defaultColor || getRandomColor(i),
                    fill: false,
                };
            });
            return { labels, datasets };
        }

        return emptyChart;
    };

    const chartData = prepareChartData();
    
    const getChartOptions = () => {
        const dataLabelsFont = format.dataLabels?.font || {};
        const xAxisFont = format.xAxis?.font || {};
        const yAxisFont = format.yAxis?.font || {};

        const options = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: false },
                legend: {
                    display: format.legend?.show ?? (visualConfig.id !== 'pie-chart'),
                    position: 'bottom',
                },
                datalabels: {
                    display: format.dataLabels?.show ?? false,
                    color: dataLabelsFont.color || '#363636',
                    anchor: format.dataLabels?.position || 'end',
                    align: format.dataLabels?.position === 'center' ? 'center' : (format.dataLabels?.position === 'start' ? 'start' : 'end'),
                    font: {
                        size: dataLabelsFont.fontSize || 12,
                        weight: dataLabelsFont.bold ? 'bold' : 'normal',
                        family: 'sans-serif', // Garante a fonte
                    },
                    formatter: (value) => {
                        const decimals = format.dataLabels?.decimals ?? 0;
                        return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
                    }
                }
            },
            scales: {
                x: {
                    display: format.xAxis?.show ?? true,
                    grid: { display: format.grid?.show ?? true },
                    title: {
                        display: format.xAxis?.showTitle ?? true,
                        text: visualConfig.xAxis?.[0]?.displayName,
                        color: xAxisFont.color,
                        font: { size: xAxisFont.fontSize ? xAxisFont.fontSize + 2 : 12, weight: xAxisFont.bold ? 'bold' : 'normal' }
                    },
                    ticks: {
                        color: xAxisFont.color,
                        font: { size: xAxisFont.fontSize || 12, weight: xAxisFont.bold ? 'bold' : 'normal' }
                    }
                },
                y: {
                    display: format.yAxis?.show ?? true,
                    grid: { display: format.grid?.show ?? true },
                    title: {
                        display: format.yAxis?.showTitle ?? true,
                        text: visualConfig.yAxis?.[0]?.displayName,
                        color: yAxisFont.color,
                        font: { size: yAxisFont.fontSize ? yAxisFont.fontSize + 2 : 12, weight: yAxisFont.bold ? 'bold' : 'normal' }
                    },
                    ticks: {
                        color: yAxisFont.color,
                        font: { size: yAxisFont.fontSize || 12, weight: yAxisFont.bold ? 'bold' : 'normal' }
                    }
                }
            }
        };

        if (chartData.datasets.length > 0) {
            const allData = chartData.datasets.flatMap(ds => ds.data);
            const maxValue = Math.max(...allData.filter(v => typeof v === 'number'));
            if (isFinite(maxValue)) {
                if (visualConfig.id === 'column-chart' || visualConfig.id === 'line-chart') {
                    options.scales.y.max = maxValue * 1.2;
                }
                if (visualConfig.id === 'bar-chart') {
                    options.scales.x.max = maxValue * 1.2;
                }
            }
        }
        
        return options;
    };

    const chartOptions = getChartOptions();

    const renderChart = (ChartComponent, options) => {
        if (!chartData || !chartData.labels) {
            return <div className="visual-no-data">Configuração de dados incompleta.</div>;
        }
        return (
            <VisualWrapper visualConfig={visualConfig}>
                <ChartComponent key={chartKey} data={chartData} options={options} />
            </VisualWrapper>
        );
    }

    switch (visualConfig.id) {
        case 'card':
            return <CardVisual data={data} visualConfig={visualConfig} />;
        case 'table':
            return <TableVisual data={data} visualConfig={visualConfig} />;
        case 'matrix':
            return <MatrixVisual data={data} visualConfig={visualConfig} />;
        case 'gauge-chart':
            return <GaugeVisual data={data} visualConfig={visualConfig} />;
        case 'bar-chart':
            return renderChart(Bar, { ...chartOptions, indexAxis: 'y' });
        case 'column-chart':
            return renderChart(Bar, chartOptions);
        case 'line-chart':
            return renderChart(Line, chartOptions);
        case 'pie-chart':
            return renderChart(Pie, chartOptions);
        default:
            return <div className="visual-no-data">Tipo de visual desconhecido.</div>;
    }
};

export default VisualRenderer;

