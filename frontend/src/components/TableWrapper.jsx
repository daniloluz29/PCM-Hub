import React from 'react';

/**
 * Componente "invólucro" para tabelas.
 * Adiciona um título e um botão de "expandir" para abrir a tabela em um modal.
 * @param {object} props
 * @param {string} props.title - O título a ser exibido no card.
 * @param {function} props.onExpandClick - A função a ser chamada quando o botão de expandir é clicado.
 * @param {React.ReactNode} props.children - O conteúdo a ser renderizado (geralmente a tabela simples).
 */
const TableWrapper = ({ title, onExpandClick, children }) => {
    return (
        <div className="card table-wrapper">
            <div className="table-wrapper-header">
                <h3>{title}</h3>
                <button className="expand-table-btn" onClick={onExpandClick} title="Abrir tabela avançada">
                    {/* Usando um ícone de filtro/ordenação similar ao que você enviou */}
                    <i className="bi bi-filter-left"></i>
                </button>
            </div>
            {children}
        </div>
    );
};

export default TableWrapper;
