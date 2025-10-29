import React, { useState, useEffect } from 'react';
import Modal from '../../components/Modal.jsx';

const API_BASE_URL = 'http://127.0.0.1:5000';

function ModalDetalhamentoPneus({ isOpen, onClose, pneuSelecionado }) {
    // Estado para a aba ativa (agregacao ou medicoes)
    const [abaAtiva, setAbaAtiva] = useState('agregacao');

    // Estados para o histórico de agregação
    const [historicoAgregacao, setHistoricoAgregacao] = useState([]);
    const [isLoadingAgregacao, setIsLoadingAgregacao] = useState(false);
    const [agregacaoError, setAgregacaoError] = useState(null);

    // Estados para o histórico de medições
    const [historicoMedicores, setHistoricoMedicores] = useState([]);
    const [isLoadingMedicores, setIsLoadingMedicores] = useState(false);
    const [medicoesError, setMedicoresError] = useState(null);

    // Estado para os detalhes da última medição (quando vindo do context menu)
    const [detalhesMedicao, setDetalhesMedicao] = useState(null);
    const [isLoadingDetalhes, setIsLoadingDetalhes] = useState(false);
    const [detalhesError, setDetalhesError] = useState(null);

    useEffect(() => {
        // Reseta os estados ao abrir o modal ou trocar o pneu
        setHistoricoAgregacao([]);
        setAgregacaoError(null);
        setHistoricoMedicores([]);
        setMedicoresError(null);
        setDetalhesMedicao(null); // Reseta detalhes
        setDetalhesError(null);
        setIsLoadingDetalhes(false); // Garante que o loading de detalhes seja resetado
        setAbaAtiva('agregacao'); // Reseta para a aba padrão

        const num_fogo = pneuSelecionado?.dados?.num_fogo;

        if (isOpen && num_fogo) {

            // Função para buscar agregações
            const fetchAgregacao = async () => {
                setIsLoadingAgregacao(true);
                try {
                    const response = await fetch(`${API_BASE_URL}/api/pneus/historico-agregacao/${num_fogo}`);
                    if (!response.ok) throw new Error('Falha ao buscar histórico de agregação.');
                    const data = await response.json();
                    setHistoricoAgregacao(data);
                    setAgregacaoError(null); // Limpa erro anterior
                } catch (err) {
                    setAgregacaoError(err.message);
                } finally {
                    setIsLoadingAgregacao(false);
                }
            };

            // Função para buscar medições
            const fetchMedicores = async () => {
                setIsLoadingMedicores(true);
                try {
                    const response = await fetch(`${API_BASE_URL}/api/pneus/historico-medicoes-pneu/${num_fogo}`);
                    if (!response.ok) throw new Error('Falha ao buscar histórico de medições.');
                    const data = await response.json();
                    setHistoricoMedicores(data);
                    setMedicoresError(null); // Limpa erro anterior
                } catch (err) {
                    setMedicoresError(err.message);
                } finally {
                    setIsLoadingMedicores(false);
                }
            };

            // Função para buscar detalhes da última medição (se necessário)
            const fetchDetalhesMedicao = async () => {
                // Só busca se os dados originais NÃO tiverem faixa_info ou medicao
                // Ou seja, veio do context menu apenas com num_fogo
                if (!pneuSelecionado?.dados?.faixa_info && pneuSelecionado?.dados?.medicao == null) {
                    setIsLoadingDetalhes(true);
                    setDetalhesError(null); // Limpa erro anterior
                    try {
                        const response = await fetch(`${API_BASE_URL}/api/pneus/pneu-detalhes/${num_fogo}`);
                        if (!response.ok) throw new Error('Falha ao buscar detalhes da última medição.');
                        const data = await response.json();
                        setDetalhesMedicao(data); // Armazena os detalhes buscados
                    } catch (err) {
                        setDetalhesError(err.message);
                        setDetalhesMedicao({ num_fogo: num_fogo }); // Mantém pelo menos o num_fogo em caso de erro
                    } finally {
                        setIsLoadingDetalhes(false);
                    }
                } else {
                    // Se já temos os dados (veio do clique no esqueleto), usa os dados do prop
                    setDetalhesMedicao(pneuSelecionado.dados);
                    setIsLoadingDetalhes(false); // Garante que não fique carregando
                }
            };

            // Executa as buscas
            fetchAgregacao();
            fetchMedicores();
            fetchDetalhesMedicao(); // Busca os detalhes
        } else if (isOpen && !num_fogo && pneuSelecionado?.numero) {
             // Caso especial: Posição vazia (veio do clique no esqueleto)
             setIsLoadingDetalhes(false);
             setIsLoadingAgregacao(false);
             setIsLoadingMedicores(false);
             setDetalhesMedicao(null); // Garante que detalhes fiquem nulos
        }

    }, [isOpen, pneuSelecionado]); // Dependências: executa quando o modal abre ou o pneu muda

    // Renderiza a tabela de histórico de agregação
    const renderHistoricoAgregacao = () => {
        if (isLoadingAgregacao) return <div className="loading-placeholder" style={{padding: '10px 0'}}>Carregando histórico...</div>;
        if (agregacaoError) return <div className="error-message" style={{padding: '10px 0'}}>{agregacaoError}</div>;
        if (historicoAgregacao.length === 0 && !isLoadingAgregacao) {
            return <p style={{textAlign: 'center', padding: '10px 0', color: '#6c757d'}}>Nenhum histórico de agregação encontrado.</p>;
        }

        return (
            <div className="simple-history-wrapper">
                <table className="history-table simple-history-table">
                    <thead>
                        <tr>
                            <th>Equipamento</th>
                            <th>Posição</th>
                            <th>Data Entrada</th>
                            <th>Horím. Entrada</th>
                            <th>Data Saída</th>
                            <th>Horím. Saída</th>
                            <th>Horas Rodadas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {historicoAgregacao.map((item, index) => (
                            <tr key={index}>
                                <td>{item.equipamento}</td>
                                <td>{item.posicao}</td>
                                <td>{item.data_entrada || 'N/A'}</td>
                                <td>{item.horim_entrada != null ? Math.round(item.horim_entrada) : 'N/A'}</td>
                                <td>{item.data_saida || 'Em uso'}</td>
                                <td>{item.horim_saida != null ? Math.round(item.horim_saida) : 'N/A'}</td>
                                <td>
                                    {item.horas_rodadas != null
                                        ? Math.round(item.horas_rodadas)
                                        : (item.data_saida ? 'N/A' : '-')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    // Renderiza a tabela de histórico de medições com desgaste
    const renderHistoricoMedicores = () => {
        if (isLoadingMedicores) return <div className="loading-placeholder" style={{padding: '10px 0'}}>Carregando medições...</div>;
        if (medicoesError) return <div className="error-message" style={{padding: '10px 0'}}>{medicoesError}</div>;
        if (historicoMedicores.length === 0 && !isLoadingMedicores) {
            return <p style={{textAlign: 'center', padding: '10px 0', color: '#6c757d'}}>Nenhum histórico de medição encontrado.</p>;
        }

        return (
            <div className="simple-history-wrapper">
                <table className="history-table simple-history-table">
                    <thead>
                        <tr>
                            <th>Data da Medição</th>
                            <th>Medição (mm)</th>
                            <th>Desgaste (mm)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {historicoMedicores.map((item, index) => (
                            <tr key={index}>
                                <td>{item.data_medicao}</td>
                                <td>{item.medicao != null ? `${item.medicao} mm` : 'N/A'}</td>
                                <td>
                                    {item.desgaste != null ? `${item.desgaste} mm` : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };


    // Renderiza as informações principais (lado esquerdo)
    const renderInfoPrincipal = () => {
        // Usa os detalhes buscados (se houver e não estiver carregando) ou os dados originais
        const dadosParaExibir = !isLoadingDetalhes ? (detalhesMedicao || pneuSelecionado?.dados) : null;

        // Se veio do esqueleto e era posição vazia
        if (isOpen && !pneuSelecionado?.dados && pneuSelecionado?.numero) {
            return (
                 <div className="placeholder-message" style={{ padding: '20px', margin: 0, border: 'none', background: 'transparent' }}>
                    <div className="icon"><i className="bi bi-box"></i></div>
                    <h4>Posição Vazia</h4>
                    <p>Nenhum pneu agregado a esta posição no momento.</p>
                </div>
            );
        }

        // Se está carregando os detalhes
        if (isLoadingDetalhes) return <div className="loading-placeholder" style={{ padding: '20px 0'}}>Carregando detalhes...</div>;
        // Se deu erro ao buscar detalhes
        if (detalhesError) return <div className="error-message" style={{ padding: '20px 0'}}>{detalhesError}</div>;
        // Se não tem dados para exibir (nem original nem buscado)
        if (!dadosParaExibir) return null;


        // Caso: Pneu agregado, mas sem medição encontrada (mesmo após busca)
        // Verifica se dadosParaExibir existe e se não tem medicao OU faixa_info
        // (pode ter um sem o outro em casos raros)
        if (!dadosParaExibir.medicao && !dadosParaExibir.faixa_info) {
             return (
                <div className="info-pneu-content">
                    <div className="info-pneu-item">
                        <strong>Pneu (Nº Fogo):</strong>
                        <span>{dadosParaExibir.num_fogo || 'N/A'}</span>
                    </div>
                     <div className="placeholder-message" style={{padding: '20px 0'}}>
                        <div className="icon"><i className="bi-clipboard-x"></i></div>
                        <p>Este pneu ainda não possui medições registadas.</p>
                    </div>
                </div>
            );
        }

        // Caso: Pneu agregado e com medição
        return (
            <div className="info-pneu-content">
                <div className="info-pneu-item">
                    <strong>Pneu (Nº Fogo):</strong>
                    <span>{dadosParaExibir.num_fogo || 'N/A'}</span>
                </div>
                <div className="info-pneu-item">
                    <strong>Última Medição:</strong>
                    <span>{dadosParaExibir.medicao != null ? `${dadosParaExibir.medicao} mm` : 'N/A'}</span>
                </div>
                <div className="info-pneu-item">
                    <strong>Faixa:</strong>
                    <span>{dadosParaExibir.faixa_info?.nome_faixa || 'N/A'}</span>
                </div>
                <div className="info-pneu-item">
                    <strong>Status:</strong>
                    <span>{dadosParaExibir.faixa_info?.status || 'N/A'}</span>
                </div>
                <div className="info-pneu-item">
                    <strong>Data da Medição:</strong>
                    <span>{dadosParaExibir.data_medicao || 'N/A'}</span>
                </div>
            </div>
        );
    }

    // Determina o título do modal dinamicamente
    const getModalTitle = () => {
        let title = "Detalhes do Pneu";
        const posicaoOriginal = pneuSelecionado?.numero; // Posição vinda do clique no esqueleto
        const posicaoBuscada = !isLoadingDetalhes && detalhesMedicao?.posicao_agregado ? detalhesMedicao.posicao_agregado.slice(0, 2) : null; // Posição vinda da busca

        const posicaoFinal = posicaoOriginal || posicaoBuscada;

        if (posicaoFinal) {
            title += ` - Posição ${posicaoFinal}`;
        } else if (pneuSelecionado?.dados?.num_fogo) {
             // Se não tiver posição mas tiver num_fogo (pode acontecer vindo do hist geral)
             title += ` - Nº ${pneuSelecionado.dados.num_fogo}`;
        }
        return title;
    };

    // Só renderiza o conteúdo do modal se estiver aberto
    if (!isOpen) {
        return null;
    }


    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={getModalTitle()} // Usa a função para o título
            size="xl"
        >
            <div className="modal-pneu-layout">
                {/* Coluna Esquerda: Informações Principais */}
                <div className="info-pneu-bloco">
                    {/* ADICIONADO: Título "Informações gerais" */}
                    <h5 className="info-bloco-title">Informações gerais</h5>
                    {renderInfoPrincipal()}
                </div>

                {/* Coluna Direita: Históricos com Abas */}
                <div className="historico-container">
                    {/* Botões das Abas */}
                    <div className="modal-sub-abas">
                        <button
                            className={`modal-sub-aba-button ${abaAtiva === 'agregacao' ? 'active' : ''}`}
                            onClick={() => setAbaAtiva('agregacao')}
                            disabled={!pneuSelecionado?.dados?.num_fogo} // Desabilita se não tem num_fogo
                        >
                            Histórico de Agregações
                        </button>
                        <button
                            className={`modal-sub-aba-button ${abaAtiva === 'medicoes' ? 'active' : ''}`}
                            onClick={() => setAbaAtiva('medicoes')}
                             disabled={!pneuSelecionado?.dados?.num_fogo} // Desabilita se não tem num_fogo
                        >
                            Histórico de Medições
                        </button>
                    </div>

                    {/* Conteúdo das Abas */}
                    <div className="modal-sub-aba-content">
                        {abaAtiva === 'agregacao' && pneuSelecionado?.dados?.num_fogo && renderHistoricoAgregacao()}
                        {abaAtiva === 'medicoes' && pneuSelecionado?.dados?.num_fogo && renderHistoricoMedicores()}
                         {/* Mensagem se não houver pneu selecionado (posição vazia) */}
                         {!pneuSelecionado?.dados?.num_fogo && pneuSelecionado?.numero && (
                             <p style={{textAlign: 'center', padding: '20px', color: '#6c757d'}}>
                                 Selecione um pneu para ver o histórico.
                            </p>
                         )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}

export default ModalDetalhamentoPneus;

