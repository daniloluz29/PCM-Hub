from flask import Blueprint, jsonify, request
from ..db import get_db_connection

bp = Blueprint('comunidade', __name__, url_prefix='/api')

@bp.route('/contatos', methods=['GET'])
def get_contatos():
    conn = get_db_connection()
    query = """
        SELECT u.id, u.nome, u.email, u.contato, f.funcao, cc.nome_cc as contrato
        FROM usuarios u
        LEFT JOIN funcoes f ON u.funcao_id = f.id
        LEFT JOIN centros_custo cc ON u.unidade_id = cc.cod_cc
        WHERE u.ativo = 1
        ORDER BY u.nome;
    """
    contatos = conn.execute(query).fetchall()
    conn.close()
    return jsonify([dict(row) for row in contatos])

@bp.route('/eventos', methods=['GET'])
def get_eventos():
    conn = get_db_connection()
    query = "SELECT e.*, u.nome as criado_por_nome FROM eventos e LEFT JOIN usuarios u ON e.criado_por_id = u.id ORDER BY e.data_inicio"
    eventos_db = conn.execute(query).fetchall()
    conn.close()
    return jsonify([dict(ev) for ev in eventos_db])

@bp.route('/eventos', methods=['POST'])
def create_evento():
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute(
            'INSERT INTO eventos (titulo, descricao, data_inicio, data_fim, criado_por_id, visibilidade_tipo, visibilidade_alvo, local, hora_inicio, hora_fim, recorrencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (data['titulo'], data.get('descricao'), data['data_inicio'], data.get('data_fim'), data.get('criado_por_id'), data.get('visibilidade_tipo'), data.get('visibilidade_alvo'), data.get('local'), data.get('hora_inicio'), data.get('hora_fim'), data.get('recorrencia'))
        )
        conn.commit()
    except Exception as e:
        return jsonify({"message": f"Erro: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Evento criado com sucesso!"}), 201

@bp.route('/eventos/<int:id>', methods=['PUT'])
def update_evento(id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute(
            'UPDATE eventos SET titulo = ?, descricao = ?, data_inicio = ?, data_fim = ?, visibilidade_tipo = ?, visibilidade_alvo = ?, local = ?, hora_inicio = ?, hora_fim = ?, recorrencia = ? WHERE id = ?',
            (data['titulo'], data.get('descricao'), data['data_inicio'], data.get('data_fim'), data.get('visibilidade_tipo'), data.get('visibilidade_alvo'), data.get('local'), data.get('hora_inicio'), data.get('hora_fim'), data.get('recorrencia'), id)
        )
        conn.commit()
    except Exception as e:
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Evento atualizado com sucesso!"})

@bp.route('/eventos/<int:id>', methods=['DELETE'])
def delete_evento(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM eventos WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Evento excluído com sucesso!"})
