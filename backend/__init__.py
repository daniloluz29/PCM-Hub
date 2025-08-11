from flask import Flask
from flask_cors import CORS

def create_app():
    """
    Cria e configura uma instância da aplicação Flask.
    Este padrão é conhecido como 'Application Factory'.
    """
    app = Flask(__name__)
    CORS(app) # Habilita CORS para toda a aplicação

    # Importa todos os blueprints da pasta 'routes'
    from .Rotas import (
        centros_custo, natureza_financeira, faixas, comunidade, chamados,
        gestao_acoes, usuarios, solicitacoes, cadastros_basicos, hierarquias,
        auth, permissoes, faq, notificacoes, tabelas, filtros, preventivas
    )

    # Registra cada blueprint na aplicação.
    # O blueprint organiza um conjunto de rotas relacionadas.
    app.register_blueprint(centros_custo.bp)
    app.register_blueprint(natureza_financeira.bp)
    app.register_blueprint(faixas.bp)
    app.register_blueprint(comunidade.bp)
    app.register_blueprint(chamados.bp)
    app.register_blueprint(gestao_acoes.bp)
    app.register_blueprint(usuarios.bp)
    app.register_blueprint(solicitacoes.bp)
    app.register_blueprint(cadastros_basicos.bp)
    app.register_blueprint(hierarquias.bp)
    app.register_blueprint(auth.bp)
    app.register_blueprint(permissoes.bp)
    app.register_blueprint(faq.bp)
    app.register_blueprint(notificacoes.bp)
    app.register_blueprint(tabelas.bp)
    app.register_blueprint(filtros.bp)
    app.register_blueprint(preventivas.bp)

    return app
