# backend/Rotas/faq.py
from flask import Blueprint, jsonify, request
from ..db import get_db_connection
from datetime import datetime

bp = Blueprint('faq', __name__, url_prefix='/api')

# Rota para buscar todos os itens do FAQ
@bp.route('/faq', methods=['GET'])
def get_faq_items():
    """Busca todos os itens do FAQ, juntando o nome de quem criou."""
    conn = get_db_connection()
    query = """
        SELECT f.*, u.nome as criado_por_nome
        FROM faq f
        LEFT JOIN usuarios u ON f.criado_por_id = u.id
        ORDER BY f.id ASC
    """
    faq_items = conn.execute(query).fetchall()
    conn.close()
    return jsonify([dict(row) for row in faq_items])

# Rota para criar um novo item no FAQ
@bp.route('/faq', methods=['POST'])
def create_faq_item():
    """Cria uma nova pergunta e resposta no FAQ."""
    data = request.get_json()
    pergunta = data.get('pergunta')
    resposta = data.get('resposta')
    criado_por_id = data.get('criado_por_id')

    if not all([pergunta, resposta, criado_por_id]):
        return jsonify({"message": "Pergunta, resposta e ID do usuário são obrigatórios."}), 400

    conn = get_db_connection()
    try:
        conn.execute(
            'INSERT INTO faq (pergunta, resposta, criado_por_id, data_criacao) VALUES (?, ?, ?, ?)',
            (pergunta, resposta, criado_por_id, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao criar item: {e}"}), 500
    finally:
        conn.close()
    
    return jsonify({"message": "Pergunta adicionada com sucesso!"}), 201

# Rota para atualizar um item existente no FAQ
@bp.route('/faq/<int:id>', methods=['PUT'])
def update_faq_item(id):
    """Atualiza uma pergunta e resposta existente."""
    data = request.get_json()
    pergunta = data.get('pergunta')
    resposta = data.get('resposta')

    if not all([pergunta, resposta]):
        return jsonify({"message": "Pergunta e resposta são obrigatórias."}), 400

    conn = get_db_connection()
    try:
        conn.execute(
            'UPDATE faq SET pergunta = ?, resposta = ? WHERE id = ?',
            (pergunta, resposta, id)
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao atualizar item: {e}"}), 500
    finally:
        conn.close()

    return jsonify({"message": "Pergunta atualizada com sucesso!"})

# Rota para excluir um item do FAQ
@bp.route('/faq/<int:id>', methods=['DELETE'])
def delete_faq_item(id):
    """Exclui uma pergunta do FAQ."""
    conn = get_db_connection()
    try:
        cursor = conn.execute('DELETE FROM faq WHERE id = ?', (id,))
        if cursor.rowcount == 0:
            conn.rollback()
            return jsonify({"message": "Item não encontrado."}), 404
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao excluir item: {e}"}), 500
    finally:
        conn.close()

    return jsonify({"message": "Pergunta excluída com sucesso!"})
