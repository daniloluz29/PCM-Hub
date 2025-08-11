import React, { useState } from 'react';
import GerenciamentoUsuarios from './Cadastros/GerenciamentoUsuarios.jsx';
import GerenciamentoCentrosCusto from './Cadastros/GerenciamentoCC.jsx';
import GerenciamentoNaturezaFinanceira from './Cadastros/GerenciamentoNatureza.jsx';
import GerenciamentoFaixas from './Cadastros/GerenciamentoFaixas.jsx';
import GerenciamentoPerfis from './Cadastros/GerenciamentoPerfis.jsx';
import GerenciamentoTabelas from './Cadastros/GerenciamentoTabelas.jsx';
import GerenciamentoDB from './Cadastros/GerenciamentoDB.jsx';

function PaginaCadastros({ currentUser }) {
    const [moduloAtivo, setModuloAtivo] = useState('usuarios');
    
    // NOVO: Adiciona o módulo de Relacionamentos
    const modulos = [
        { id: 'usuarios', nome: 'Usuários', icon: 'bi-people-fill' },
        { id: 'ccs', nome: 'Centros de Custo', icon: 'bi-building' },
        { id: 'natureza', nome: 'Natureza Financeira', icon: 'bi-piggy-bank-fill' },
        { id: 'faixas', nome: 'Faixas', icon: 'bi-reception-4' },
        { id: 'tabelas', nome: 'Tabelas de Apoio', icon: 'bi-table' },
        { id: 'db', nome: 'Banco de Dados', icon: 'bi-database' },
        { id: 'perfis', nome: 'Perfis de Acesso', icon: 'bi-shield-lock-fill' },
    ];

    const renderModulo = () => {
        switch (moduloAtivo) {
            case 'usuarios':
                return <GerenciamentoUsuarios currentUser={currentUser} />;
            case 'ccs':
                return <GerenciamentoCentrosCusto currentUser={currentUser} />;
            case 'natureza':
                return <GerenciamentoNaturezaFinanceira currentUser={currentUser} />;
            case 'faixas':
                return <GerenciamentoFaixas currentUser={currentUser} />;
            case 'tabelas':
                return <GerenciamentoTabelas currentUser={currentUser} />;
            case 'db':
                return <GerenciamentoDB currentUser={currentUser} />;
            case 'perfis':
                return <GerenciamentoPerfis currentUser={currentUser} />;
            default:
                return <p>Selecione um módulo válido</p>;
        }
    };

    return (
        <div className="page-container">
            <main className="content-area" style={{ marginLeft: '5px' }}>
                <div className="page-header">
                    <h1>Gerenciamento de Cadastros</h1>
                    <p>Administre as tabelas e permissões centrais do portal.</p>
                </div>

                <div className="admin-layout-container">
                    <aside className="admin-layout-sidebar">
                        <nav>
                            <ul>
                                {modulos.map(modulo => (
                                    <li key={modulo.id}>
                                        <button
                                            className={`sidebar-nav-button ${moduloAtivo === modulo.id ? 'active' : ''}`}
                                            onClick={() => setModuloAtivo(modulo.id)}
                                        >
                                            <i className={`bi ${modulo.icon}`}></i>
                                            <span>{modulo.nome}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    </aside>

                    <main className="admin-layout-content">
                        {renderModulo()}
                    </main>
                </div>
            </main>
        </div>
    );
}

export default PaginaCadastros;
