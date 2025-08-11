import React, { useState, useEffect } from 'react';

// Componente recursivo para renderizar a árvore de permissões (apenas visualização)
function TreeNode({ node, selection }) {
    // Verifica se este nó ou algum dos seus filhos está selecionado
    const isNodeVisible = (currentNode) => {
        // CORREÇÃO: Converte o ID numérico para string antes de comparar com a seleção.
        // Isso garante que a verificação funcione corretamente.
        if (selection.includes(String(currentNode.id || currentNode.cod_cc))) {
            return true;
        }
        if (currentNode.children && currentNode.children.length > 0) {
            return currentNode.children.some(child => isNodeVisible(child));
        }
        return false;
    };

    if (!isNodeVisible(node)) {
        return null; // Não renderiza o nó se nem ele nem os filhos estiverem na seleção
    }

    const hasChildren = node.children && node.children.length > 0;

    return (
        <li>
            <div className="tree-node">
                <span className="tree-node-label read-only">
                    {node.name || node.nome_cc}
                </span>
            </div>
            {hasChildren && (
                <ul>
                    {node.children.map(childNode => (
                        <TreeNode
                            key={childNode.id || childNode.cod_cc}
                            node={childNode}
                            selection={selection}
                        />
                    ))}
                </ul>
            )}
        </li>
    );
}


function PaginaPerfil({ currentUser }) {
    const [allData, setAllData] = useState({
        funcoes: [],
        unidades: [],
        perfis: [],
        hierarquiaAcesso: null,
        hierarquiaDados: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                const endpoints = [
                    'http://127.0.0.1:5000/api/funcoes',
                    'http://127.0.0.1:5000/api/unidades',
                    'http://127.0.0.1:5000/api/perfis',
                    'http://127.0.0.1:5000/api/hierarquia_acesso',
                    'http://127.0.0.1:5000/api/hierarquia_dados'
                ];
                const responses = await Promise.all(endpoints.map(url => fetch(url)));
                for (const response of responses) {
                    if (!response.ok) throw new Error(`Falha ao buscar dados de ${response.url}`);
                }
                const [funcoes, unidades, perfis, hierarquiaAcesso, hierarquiaDados] = await Promise.all(responses.map(res => res.json()));
                setAllData({ funcoes, unidades, perfis, hierarquiaAcesso, hierarquiaDados });
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, []);


    // Pega as iniciais do nome para o avatar
    const getInitials = (name) => {
        if (!name) return '?';
        const names = name.split(' ');
        const initials = names.map(n => n[0]).join('');
        return initials.substring(0, 2).toUpperCase();
    };

    // Funções para encontrar os nomes correspondentes aos IDs
    const getFuncaoNome = (id) => allData.funcoes.find(f => f.id === id)?.nome || id;
    const getUnidadeNome = (id) => allData.unidades.find(u => u.cod_cc === id)?.nome_cc || id;
    const getPerfilNome = (id) => allData.perfis.find(p => p.id === id)?.nome || id;

    const userAcessos = currentUser.acessos ? currentUser.acessos.split(',') : [];
    const userDados = currentUser.liberacao_dados ? currentUser.liberacao_dados.split(',') : [];

    if (isLoading) {
        return <div className="page-container"><main className="content-area"><p>A carregar perfil...</p></main></div>;
    }
    if (error) {
        return <div className="page-container"><main className="content-area"><p style={{color: 'red'}}>{error}</p></main></div>;
    }

    return (
        <div className="page-container">
            <main className="content-area">
                <div className="page-header">
                    <h1>Meu Perfil</h1>
                    <p>Aqui estão as suas informações de utilizador no portal.</p>
                </div>

                <div className="card">
                    <div className="profile-header">
                        <div className="avatar">
                            {getInitials(currentUser.nome)}
                        </div>
                        <div className="user-main-info">
                            <h2>{currentUser.nome}</h2>
                            <p>{currentUser.email}</p>
                        </div>
                    </div>

                    <div className="profile-details-grid">
                        <div className="profile-info-item">
                            <label>Matrícula</label>
                            <p>{currentUser.matricula}</p>
                        </div>
                        <div className="profile-info-item">
                            <label>Contato</label>
                            <p>{currentUser.contato || 'Não informado'}</p>
                        </div>
                        <div className="profile-info-item">
                            <label>Função</label>
                            <p>{getFuncaoNome(currentUser.funcao_id) || 'Não informada'}</p>
                        </div>
                        <div className="profile-info-item">
                            <label>Unidade</label>
                            <p>{getUnidadeNome(currentUser.unidade_id) || 'Não informada'}</p>
                        </div>
                        <div className="profile-info-item">
                            <label>Nível de Acesso</label>
                            <p>{getPerfilNome(currentUser.perfil_id)}</p>
                        </div>
                         <div className="profile-info-item">
                            <label>Status</label>
                            <p>{currentUser.ativo ? 'Ativo' : 'Inativo'}</p>
                        </div>
                    </div>

                    <div className="profile-permissions-grid">
                        <div className="permission-column">
                            <h4>Acessos a Painéis</h4>
                            <div className="tree-view-container read-only">
                                {allData.hierarquiaAcesso && (
                                    <ul>
                                        <TreeNode node={allData.hierarquiaAcesso} selection={userAcessos} />
                                    </ul>
                                )}
                            </div>
                        </div>
                        <div className="permission-column">
                            <h4>Visibilidade de Dados</h4>
                             <div className="tree-view-container read-only">
                                {allData.hierarquiaDados && (
                                    <ul>
                                        <TreeNode node={allData.hierarquiaDados} selection={userDados} />
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default PaginaPerfil;
