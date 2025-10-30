from flask import Flask
from flask_cors import CORS
import os

# --- 1. Importações do Cache ---
from flask_caching import Cache

# --- 2. Criação do Objeto Cache (ainda não inicializado) ---
# Criamos o objeto 'cache' aqui, para que ele possa ser importado
# por todos os seus 24 arquivos de rota (blueprints).
cache = Cache()

def create_app():
    """
    Cria e configura uma instância da aplicação Flask.
    Este padrão é conhecido como 'Application Factory'.
    """
    app = Flask(__name__)
    CORS(app) # Habilita CORS para toda a aplicação

    # --- 3. Configuração do Cache (Opção 2 - FileSystem) ---
    # Define o tipo de cache que queremos
    app.config['CACHE_TYPE'] = 'FileSystemCache'
    
    # Define a pasta onde os arquivos de cache serão salvos
    # (Estamos criando uma pasta 'cache_storage' dentro da pasta 'backend')
    cache_dir = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'cache_storage')
    app.config['CACHE_DIR'] = cache_dir

    # Cria a pasta de cache se ela não existir
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)
        
    # --- 4. Inicializa o Cache com a Aplicação ---
    # Agora o objeto 'cache' está pronto para ser usado.
    cache.init_app(app)

    # Importa todos os blueprints da pasta 'routes'
    from .Rotas import (
        centros_custo, natureza_financeira, faixas, comunidade, chamados,
        gestao_acoes, usuarios, solicitacoes, cadastros_basicos, hierarquias,
        auth, permissoes, faq, notificacoes, tabelas, filtros, preventivas, 
        atualizacao_backup, assistente_pcm, bi, pneus
    )

    # Registra cada blueprint na aplicação.
    # (Nenhuma mudança necessária aqui)
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
    app.register_blueprint(atualizacao_backup.bp)
    app.register_blueprint(assistente_pcm.bp)
    app.register_blueprint(bi.bp)
    app.register_blueprint(pneus.bp)

    return app

