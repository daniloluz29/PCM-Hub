import React from 'react';

// Dados fictícios para os documentos, incluindo um caminho para o arquivo PDF.
const documentosData = [
    {
        id: 1,
        icon: 'bi-wrench-adjustable-circle',
        titulo: 'IT-001: Manutenção Corretiva em Motores',
        descricao: 'Procedimento operacional padrão para diagnóstico e reparo de falhas em motores diesel modelo X.',
        caminhoArquivo: '/docs/IT-001.pdf' // Caminho relativo a partir da pasta 'public'
    },
    {
        id: 2,
        icon: 'bi-shield-check',
        titulo: 'IT-002: Plano de Manutenção Preventiva',
        descricao: 'Checklist e cronograma de atividades para a manutenção preventiva semestral da frota de caminhões.',
        caminhoArquivo: '/docs/IT-002.pdf'
    },
    {
        id: 3,
        icon: 'bi-eyedropper',
        titulo: 'IT-003: Coleta de Análise de Óleo',
        descricao: 'Instruções detalhadas para a coleta correta de amostras de óleo lubrificante para análise laboratorial.',
        caminhoArquivo: '/docs/IT-003.pdf'
    },
    {
        id: 4,
        icon: 'bi-cone-striped',
        titulo: 'PROC-001: Análise de Causa Raiz (RCA)',
        descricao: 'Metodologia para investigação de falhas repetitivas e identificação da causa raiz do problema.',
        caminhoArquivo: '/docs/PROC-001.pdf'
    },
    {
        id: 5,
        icon: 'bi-record-circle',
        titulo: 'PROC-002: Inspeção e Rodízio de Pneus',
        descricao: 'Diretrizes para a inspeção de desgaste, pressão e danos, e o procedimento para o rodízio de pneus da frota.',
        caminhoArquivo: '/docs/PROC-002.pdf'
    },
    {
        id: 6,
        icon: 'bi-journal-text',
        titulo: 'FORM-001: Relatório Diário de Manutenção',
        descricao: 'Modelo do formulário RDM a ser preenchido pela equipe de manutenção ao final de cada turno de trabalho.',
        caminhoArquivo: '/docs/FORM-001.pdf'
    }
];

/**
 * Componente para a página de Documentação / Base de Conhecimento.
 */
function PaginaDocumentacao() {
    // Função para lidar com o clique em um cartão de documento.
    // Abre o arquivo especificado em uma nova aba do navegador.
    const handleCardClick = (caminho) => {
        window.open(caminho, '_blank');
    };

    return (
        <div className="page-container">
            <main className="content-area" style={{marginLeft: '2rem'}}>
                <div className="page-header">
                    <h1>Base de Conhecimento</h1>
                    <p>Encontre aqui todas as Instruções de Trabalho (ITs) e procedimentos do PCM.</p>
                </div>

                {/* Grid que exibe os cartões de documento */}
                <div className="card-grid">
                    {documentosData.map(doc => (
                        <div key={doc.id} className="doc-card" onClick={() => handleCardClick(doc.caminhoArquivo)}>
                            <div className="doc-card-icon">
                                <i className={`bi ${doc.icon}`}></i>
                            </div>
                            <h3 className="doc-card-title">{doc.titulo}</h3>
                            <p className="doc-card-description">{doc.descricao}</p>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}

export default PaginaDocumentacao;
