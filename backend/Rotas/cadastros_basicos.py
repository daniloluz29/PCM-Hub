from flask import Blueprint, jsonify
from ..db import get_db_connection

bp = Blueprint('cadastros_basicos', __name__, url_prefix='/api')

@bp.route('/perfis', methods=['GET'])
def get_perfis():
    conn = get_db_connection()
    # ATUALIZADO: Garante que os perfis sejam sempre retornados na ordem correta.
    rows = conn.execute('SELECT * FROM perfis_acesso ORDER BY hierarquia ASC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@bp.route('/funcoes', methods=['GET'])
def get_funcoes():
    conn = get_db_connection()
    rows = conn.execute('SELECT id, funcao as nome FROM funcoes ORDER BY funcao ASC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])

@bp.route('/unidades', methods=['GET'])
def get_unidades():
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM centros_custo ORDER BY nome_cc').fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])
