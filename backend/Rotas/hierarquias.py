from flask import Blueprint, jsonify
from ..db import get_db_connection
from ..db import build_tree

bp = Blueprint('hierarquias', __name__, url_prefix='/api')

@bp.route('/hierarquia_acesso', methods=['GET'])
def get_hierarquia_acesso():
    conn = get_db_connection()
    paineis = conn.execute('SELECT id, nome as name, pai_id FROM paineis').fetchall()
    conn.close()
    tree = build_tree(paineis, id_field='id', parent_field='pai_id', root_parent_id=None)
    return jsonify({'id': 'todos_acessos', 'name': 'Todos os Painéis', 'children': tree})

@bp.route('/hierarquia_dados', methods=['GET'])
def get_hierarquia_dados():
    conn = get_db_connection()
    ccs = conn.execute('SELECT id, cod_cc, nome_cc, pai_id, responde_iqd FROM centros_custo').fetchall()
    conn.close()
    tree = build_tree(ccs, id_field='cod_cc', parent_field='pai_id', root_parent_id=None)
    return jsonify({'cod_cc': 'todos_dados', 'nome_cc': 'Todos os Contratos', 'children': tree})
