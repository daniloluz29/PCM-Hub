import React, { useState, useEffect } from 'react';
import TabAtivos from './TabAtivos';
import TabSolicitacoes from './TabSolicitacoes.jsx';

// Componente principal de gerenciamento de usuários
const GerenciamentoUsuarios = ({ currentUser }) => { // Recebe currentUser
    // A lógica de busca de dados agora reside neste componente.
    const [usuarios, setUsuarios] = useState([]);
    const [solicitacoes, setSolicitacoes] = useState([]);
    const [perfis, setPerfis] = useState([]);
    const [hierarquiaAcesso, setHierarquiaAcesso] = useState(null);
    const [hierarquiaDados, setHierarquiaDados] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [funcoes, setFuncoes] = useState([]);
    const [unidades, setUnidades] = useState([]);
    
    const [subAbaAtiva, setSubAbaAtiva] = useState('ativos');

    const fetchData = async () => {
        try {
            const endpoints = [
                'http://127.0.0.1:5000/api/usuarios',
                'http://127.0.0.1:5000/api/solicitacoes',
                'http://127.0.0.1:5000/api/perfis',
                'http://127.0.0.1:5000/api/funcoes',
                'http://127.0.0.1:5000/api/unidades',
                'http://127.0.0.1:5000/api/hierarquia_acesso',
                'http://127.0.0.1:5000/api/hierarquia_dados'
            ];

            const responses = await Promise.all(endpoints.map(url => fetch(url)));

            for (const response of responses) {
                if (!response.ok) {
                    throw new Error(`Erro: ${response.statusText} (${response.url})`);
                }
            }

            const [
                dataUsuarios, 
                dataSolicitacoes, 
                dataPerfis, 
                dataFuncoes,
                dataUnidades,
                dataHierarquiaAcesso, 
                dataHierarquiaDados
            ] = await Promise.all(responses.map(r => r.json()));

            setUsuarios(dataUsuarios);
            setSolicitacoes(dataSolicitacoes);
            setPerfis(dataPerfis);
            setFuncoes(dataFuncoes);
            setUnidades(dataUnidades);
            setHierarquiaAcesso(dataHierarquiaAcesso);
            setHierarquiaDados(dataHierarquiaDados);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);


    if (isLoading) {
        return <div className="card"><p>Carregando dados de usuários...</p></div>;
    }
    
    if (error) {
        return <div className="card" style={{ color: 'red' }}><h3>Erro ao carregar dados:</h3><p>{error}</p></div>;
    }

    return (
        <>
            <div className="tabs-container">
                <button
                    className={`tab-item ${subAbaAtiva === 'ativos' ? 'active' : ''}`}
                    onClick={() => setSubAbaAtiva('ativos')}
                >
                    Usuários Ativos
                </button>
                <button
                    className={`tab-item ${subAbaAtiva === 'solicitacoes' ? 'active' : ''}`}
                    onClick={() => setSubAbaAtiva('solicitacoes')}
                >
                    Solicitações Pendentes
                </button>
            </div>

            <div className="tab-content">
                {subAbaAtiva === 'ativos' ? (
                    <TabAtivos
                        usuarios={usuarios}
                        perfis={perfis}
                        funcoes={funcoes}
                        unidades={unidades}
                        hierarquiaAcesso={hierarquiaAcesso}
                        hierarquiaDados={hierarquiaDados}
                        onDataChange={fetchData} 
                        currentUser={currentUser} // Passa para o filho
                    />
                ) : (
                    <TabSolicitacoes
                        solicitacoes={solicitacoes}
                        funcoes={funcoes}
                        unidades={unidades}
                        onDataChange={fetchData} 
                    />
                )}
            </div>
        </>
    );
};

export default GerenciamentoUsuarios;
