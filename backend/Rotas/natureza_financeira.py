from flask import Blueprint, jsonify, request
from ..db import get_db_connection
import sqlite3
# Importa a função de criar notificação
from ..Rotas.notificacoes import criar_notificacao

bp = Blueprint('natureza_financeira', __name__, url_prefix='/api/natureza_financeira')

@bp.route('', methods=['GET'])
def get_natureza_financeira():
    conn = get_db_connection()
    items = conn.execute('SELECT * FROM natureza_financeira ORDER BY id_gerencial').fetchall()
    conn.close()
    return jsonify([dict(row) for row in items])

@bp.route('', methods=['POST'])
def create_natureza_financeira():
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')

        autor_id = data.pop('autor_id', None)
        autor_nome = "um utilizador"
        if autor_id:
            autor = conn.execute('SELECT nome FROM usuarios WHERE id = ?', (autor_id,)).fetchone()
            if autor:
                autor_nome = autor['nome']

        required_fields = ['id_gerencial', 'desc_gerencial', 'id_contabil', 'desc_contabil', 'imposto']
        if not all(field in data and data[field] is not None for field in required_fields):
            return jsonify({"message": "Erro: Todos os campos são obrigatórios."}), 400

        conn.execute(
            'INSERT INTO natureza_financeira (id_gerencial, desc_gerencial, id_contabil, desc_contabil, imposto) VALUES (?, ?, ?, ?, ?)',
            (data['id_gerencial'], data['desc_gerencial'], data['id_contabil'], data['desc_contabil'], data['imposto'])
        )
        
        # Cria a notificação estratégica
        texto_notificacao = f"Nova Natureza Financeira '{data['desc_gerencial']}' foi criada por {autor_nome}."
        criar_notificacao(conn, 'bi-piggy-bank-fill', texto_notificacao, 'cadastros', None, None, tipo_notificacao_estrategica='cadastro_nf')

        conn.commit()
        message = {"message": f"Natureza '{data['desc_gerencial']}' criada com sucesso!"}
    except sqlite3.IntegrityError:
        conn.rollback()
        return jsonify({"message": f"Erro: ID Gerencial '{data['id_gerencial']}' já existe."}), 400
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify(message), 201

@bp.route('/<string:id_gerencial>', methods=['PUT'])
def update_natureza_financeira(id_gerencial):
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')

        autor_id = data.pop('autor_id', None)
        autor_nome = "um utilizador"
        if autor_id:
            autor = conn.execute('SELECT nome FROM usuarios WHERE id = ?', (autor_id,)).fetchone()
            if autor:
                autor_nome = autor['nome']

        conn.execute(
            'UPDATE natureza_financeira SET desc_gerencial = ?, id_contabil = ?, desc_contabil = ?, imposto = ? WHERE id_gerencial = ?',
            (data['desc_gerencial'], data['id_contabil'], data['desc_contabil'], data['imposto'], id_gerencial)
        )
        
        # Cria a notificação estratégica
        texto_notificacao = f"A Natureza Financeira '{data['desc_gerencial']}' foi atualizada por {autor_nome}."
        criar_notificacao(conn, 'bi-piggy-bank', texto_notificacao, 'cadastros', None, None, tipo_notificacao_estrategica='edicao_nf')
        
        conn.commit()
        message = {"message": "Natureza Financeira atualizada com sucesso!"}
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify(message)

@bp.route('/<string:id_gerencial>', methods=['DELETE'])
def delete_natureza_financeira(id_gerencial):
    autor_id = request.args.get('autor_id')
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')

        autor_nome = "um utilizador"
        if autor_id:
            autor = conn.execute('SELECT nome FROM usuarios WHERE id = ?', (autor_id,)).fetchone()
            if autor:
                autor_nome = autor['nome']

        item_para_deletar = conn.execute('SELECT desc_gerencial FROM natureza_financeira WHERE id_gerencial = ?', (id_gerencial,)).fetchone()
        if not item_para_deletar:
            return jsonify({"message": "Natureza Financeira não encontrada."}), 404
        desc_gerencial = item_para_deletar['desc_gerencial']

        conn.execute('DELETE FROM natureza_financeira WHERE id_gerencial = ?', (id_gerencial,))
        
        # Cria a notificação estratégica
        texto_notificacao = f"A Natureza Financeira '{desc_gerencial}' foi excluída por {autor_nome}."
        criar_notificacao(conn, 'bi-trash3-fill', texto_notificacao, 'cadastros', None, None, tipo_notificacao_estrategica='exclusao_nf')
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao excluir Natureza Financeira: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Natureza Financeira excluída com sucesso!"})
