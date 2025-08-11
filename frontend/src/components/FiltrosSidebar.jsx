import React, { useState } from 'react';

/**
 * Componente de barra lateral retrátil para filtros.
 * @param {object} props
 * @param {function} props.onToggle - Função para notificar o componente pai sobre a mudança de estado (expandido/recolhido).
 * @param {React.ReactNode} props.children - Os elementos de filtro a serem renderizados dentro da barra.
 * @param {function} props.onClearFilters - Função para limpar os filtros.
 */
const FiltrosSidebar = ({ onToggle, children, onClearFilters }) => { // CORREÇÃO: Recebendo a nova prop
    const [isExpanded, setIsExpanded] = useState(true);

    const handleToggle = () => {
        const newState = !isExpanded;
        setIsExpanded(newState);
        if (onToggle) {
            onToggle(newState);
        }
    };

    return (
        <aside className={`filter-sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
            <div className="sidebar-header">
                {isExpanded && <h3>Filtros de Análise</h3>}
                <button onClick={handleToggle} className="sidebar-toggle-btn" title={isExpanded ? "Recolher" : "Expandir"}>
                    <i className={`bi ${isExpanded ? 'bi-chevron-left' : 'bi-chevron-right'}`}></i>
                </button>
            </div>

            {isExpanded ? (
                <>
                    <div className="sidebar-content">
                        <button className="clear-filters-btn" onClick={onClearFilters}> {/* CORREÇÃO: Adicionando o evento onClick */}
                            <i className="bi bi-eraser-fill"></i>
                            Limpar Filtros
                        </button>
                        {children}
                    </div>
                </>
            ) : (
                <div className="sidebar-title-vertical">
                    Filtros
                </div>
            )}
        </aside>
    );
};

export default FiltrosSidebar;
