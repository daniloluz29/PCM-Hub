import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://127.0.0.1:5000';

function SubAbaHistoricoMedicoes({ isActive }) {
    const [historicoData, setHistoricoData] = useState({ meses: [], dados: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchHistorico = async () => {
            if (!isActive) return;
            setIsLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/api/pneus/historico-medicoes`);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.details || 'Falha ao buscar histórico de medições.');
                }
                const data = await response.json();
                setHistoricoData(data);
                setError(null);
            } catch (err) {
                setError(err.message);
                setHistoricoData({ meses: [], dados: [] });
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistorico();
    }, [isActive]);

    const renderCelulasMedicao = (linha) => {
        let celulas = [];
        historicoData.meses.forEach(mes => {
            for (let semana = 1; semana <= mes.num_semanas; semana++) {
                const chave = `${mes.mes}-${semana}`;
                const contagem = linha.medicoes[chave] || 0;
                // ALTERADO: Renderiza um círculo verde ou vermelho
                const statusIcon = contagem > 0
                    ? <div className="status-circle green" title={`${contagem} medição(ões)`}></div>
                    : <div className="status-circle red" title="Nenhuma medição"></div>;
                
                celulas.push(<td key={chave} className="history-cell">{statusIcon}</td>);
            }
        });
        return celulas;
    };

    if (isLoading) return <p>Carregando histórico...</p>;
    if (error) return <div className="error-message">Erro ao carregar dados: {error}</div>;

    return (
        <div className="card" style={{ width: '1380px'}}>
            <h2>Histórico de Medições por Semana</h2>
            {/* ALTERADO: Adicionado um wrapper para a barra de rolagem horizontal */}
            <div className="history-table-wrapper">
                <table className="history-table">
                    <thead>
                        <tr>
                            <th className="sticky-col">Equipamento</th>
                            <th className="sticky-col col2">Nº Fogo</th>
                            {historicoData.meses.map(mes => (
                                <th key={mes.mes} colSpan={mes.num_semanas} className="month-header">
                                    {mes.mes}
                                </th>
                            ))}
                        </tr>
                        <tr>
                            <th className="sticky-col"></th>
                            <th className="sticky-col col2"></th>
                            {historicoData.meses.map(mes => (
                                Array.from({ length: mes.num_semanas }, (_, i) => i + 1).map(semana => (
                                    <th key={`${mes.mes}-${semana}`} className="week-header">{semana}</th>
                                ))
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {historicoData.dados.map((linha, index) => (
                            <tr key={`${linha.equipamento}-${linha.num_fogo}-${index}`}>
                                <td className="sticky-col">{linha.equipamento}</td>
                                <td className="sticky-col col2">{linha.num_fogo}</td>
                                {renderCelulasMedicao(linha)}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {historicoData.dados.length === 0 && !isLoading && (
                <p style={{ textAlign: 'center', padding: '20px' }}>Nenhum histórico de medição encontrado.</p>
            )}
        </div>
    );
}

export default SubAbaHistoricoMedicoes;

