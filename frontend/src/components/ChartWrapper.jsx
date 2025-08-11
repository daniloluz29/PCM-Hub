import React from 'react';

/**
 * Componente "invólucro" para gráficos.
 * Adiciona um título, botão de "modo foto" e cartões de KPI.
 * @param {object} props
 * @param {string} props.title - O título a ser exibido no card.
 * @param {function} props.onPhotoModeClick - A função a ser chamada quando o botão de modo foto é clicado.
 * @param {React.ReactNode} props.children - O conteúdo a ser renderizado (o gráfico).
 * @param {boolean} props.isFilterSource - Se este gráfico é a origem do filtro atual.
 * @param {Array} props.kpiCards - Array de objetos para os cartões de KPI. Ex: [{ title: 'Total', value: 123 }]
 */
const ChartWrapper = ({ title, onPhotoModeClick, children, isFilterSource, kpiCards }) => (
    <div className={`card chart-wrapper ${isFilterSource ? 'filter-source' : ''}`}>
        <div className="chart-header">
            <div className="chart-title-section">
                 <button className="photo-mode-btn" onClick={onPhotoModeClick} title="Modo Foto"><i className="bi bi-camera"></i></button>
                 <h3>{title}</h3>
            </div>
            {kpiCards && kpiCards.length > 0 && (
                <div className="kpi-card-container">
                    {kpiCards.map((kpi, index) => (
                        <div key={index} className="kpi-card">
                            <span className="kpi-card-title">{kpi.title}</span>
                            <span className="kpi-card-value">{kpi.value}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
        <div className="chart-container">
            {children}
        </div>
    </div>
);

export default ChartWrapper;
