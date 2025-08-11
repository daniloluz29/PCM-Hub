import React from 'react';

/**
 * Componente de cabeçalho de página estilizado e reutilizável.
 * @param {object} props
 * @param {string} props.icon - A classe do ícone Bootstrap (ex: 'bi-shield-check').
 * @param {string} props.title - O título principal da página.
 * @param {string} props.subtitle - O texto descritivo abaixo do título.
 */
const PageHeader = ({ icon, title, subtitle }) => {
    return (
        <div className="page-header-card">
            <div className="page-header-icon-container">
                <i className={`bi ${icon}`}></i>
            </div>
            <div className="page-header-text-container">
                <h1>{title}</h1>
                <p>{subtitle}</p>
            </div>
        </div>
    );
};

export default PageHeader;
