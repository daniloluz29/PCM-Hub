# backend/db.py
# Contém funções utilitárias para interagir com o banco de dados.

import sqlite3
import os

# --- INÍCIO DA CORREÇÃO ---
# Constrói um caminho absoluto para o arquivo do banco de dados.
# Isso garante que o banco de dados seja encontrado independentemente de onde
# o script `run.py` é executado.

# 1. Pega o caminho absoluto do diretório onde este arquivo (db.py) está.
#    Ex: /caminho/para/seu-projeto/PCM Hub/backend
_basedir = os.path.abspath(os.path.dirname(__file__))

# 2. Define que o arquivo 'database.db' está na mesma pasta que este script.
#    Ex: /caminho/para/seu-projeto/PCM Hub/backend/database.db
DATABASE_PATH = os.path.join(_basedir, 'database.db')
# --- FIM DA CORREÇÃO ---


def get_db_connection():
    """Cria e retorna uma conexão com o banco de dados SQLite."""
    # Usa o caminho absoluto que definimos acima.
    conn = sqlite3.connect(DATABASE_PATH)
    # A configuração row_factory permite acessar as colunas pelo nome.
    conn.row_factory = sqlite3.Row
    return conn

def build_tree(rows, id_field, parent_field, root_parent_id=None):
    """
    Constrói uma estrutura de árvore (hierarquia) a partir de uma lista
    de linhas do banco de dados.
    Útil para estruturas como centros de custo ou painéis.
    """
    nodes = {dict(row)[id_field]: dict(row) for row in rows}
    for node_id in nodes:
        nodes[node_id]['children'] = []
    
    root_nodes = []
    for node_id, node_data in nodes.items():
        parent_id = node_data.get(parent_field)
        if parent_id in nodes:
            # Aninha o nó filho sob o nó pai.
            nodes[parent_id]['children'].append(node_data)
        elif parent_id == root_parent_id:
            # Adiciona nós que não têm pai à raiz da árvore.
            root_nodes.append(node_data)
            
    return root_nodes
