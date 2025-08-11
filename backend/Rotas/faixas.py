from flask import Blueprint, jsonify, request
from ..db import get_db_connection
# Importa a função de criar notificação
from ..Rotas.notificacoes import criar_notificacao

bp = Blueprint('faixas', __name__, url_prefix='/api')

@bp.route('/faixas_grupos', methods=['GET'])
def get_faixas_grupos():
    conn = get_db_connection()
    grupos = conn.execute('SELECT * FROM faixas_grupos ORDER BY nome_grupo').fetchall()
    conn.close()
    return jsonify([dict(row) for row in grupos])

@bp.route('/faixas_grupos/<string:id>', methods=['PUT'])
def update_faixas_grupo(id):
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute('UPDATE faixas_grupos SET nome_exibicao = ? WHERE id = ?', (data['nome_exibicao'], id))
        conn.commit()
    except Exception as e:
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Grupo atualizado com sucesso!"})

@bp.route('/faixas/<string:grupo_id>', methods=['GET'])
def get_faixas_por_grupo(grupo_id):
    conn = get_db_connection()
    valores = conn.execute('SELECT * FROM faixas_definicoes WHERE grupo_id = ? ORDER BY valor_inicio', (grupo_id,)).fetchall()
    conn.close()
    return jsonify([dict(row) for row in valores])

@bp.route('/faixas_definicoes', methods=['POST'])
def create_faixa():
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
            'INSERT INTO faixas_definicoes (grupo_id, nome_faixa, valor_inicio, valor_fim, status) VALUES (?, ?, ?, ?, ?)',
            (data['grupo_id'], data['nome_faixa'], data['valor_inicio'], data['valor_fim'], data.get('status', 'Ativo'))
        )
        
        # CORREÇÃO: Busca o nome de exibição do grupo para a notificação
        grupo = conn.execute('SELECT nome_exibicao FROM faixas_grupos WHERE id = ?', (data['grupo_id'],)).fetchone()
        nome_exibicao_grupo = grupo['nome_exibicao'] if grupo else "Faixas"

        texto_notificacao = f"A tabela de Faixas '{nome_exibicao_grupo}' foi atualizada por {autor_nome}."
        criar_notificacao(conn, 'bi-reception-4', texto_notificacao, 'cadastros', None, None, tipo_notificacao_estrategica='alteracao_faixas')
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Faixa criada com sucesso!"}), 201

@bp.route('/faixas_definicoes/<int:id>', methods=['PUT'])
def update_faixa(id):
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

        # CORREÇÃO: Busca o grupo da faixa antes de atualizar
        faixa_info = conn.execute('SELECT grupo_id FROM faixas_definicoes WHERE id = ?', (id,)).fetchone()
        
        conn.execute(
            'UPDATE faixas_definicoes SET nome_faixa = ?, valor_inicio = ?, valor_fim = ?, status = ? WHERE id = ?',
            (data['nome_faixa'], data['valor_inicio'], data['valor_fim'], data['status'], id)
        )
        
        grupo = conn.execute('SELECT nome_exibicao FROM faixas_grupos WHERE id = ?', (faixa_info['grupo_id'],)).fetchone()
        nome_exibicao_grupo = grupo['nome_exibicao'] if grupo else "Faixas"

        texto_notificacao = f"A tabela de Faixas '{nome_exibicao_grupo}' foi atualizada por {autor_nome}."
        criar_notificacao(conn, 'bi-pencil-square', texto_notificacao, 'cadastros', None, None, tipo_notificacao_estrategica='alteracao_faixas')
        
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Faixa atualizada com sucesso!"})

@bp.route('/faixas_definicoes/<int:id>', methods=['DELETE'])
def delete_faixa(id):
    autor_id = request.args.get('autor_id')
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        
        autor_nome = "um utilizador"
        if autor_id:
            autor = conn.execute('SELECT nome FROM usuarios WHERE id = ?', (autor_id,)).fetchone()
            if autor:
                autor_nome = autor['nome']
        
        # CORREÇÃO: Busca o grupo da faixa antes de excluir
        item_para_deletar = conn.execute('SELECT grupo_id FROM faixas_definicoes WHERE id = ?', (id,)).fetchone()
        if not item_para_deletar:
            return jsonify({"message": "Faixa não encontrada."}), 404

        grupo = conn.execute('SELECT nome_exibicao FROM faixas_grupos WHERE id = ?', (item_para_deletar['grupo_id'],)).fetchone()
        nome_exibicao_grupo = grupo['nome_exibicao'] if grupo else "Faixas"

        conn.execute('DELETE FROM faixas_definicoes WHERE id = ?', (id,))
        
        texto_notificacao = f"A tabela de Faixas '{nome_exibicao_grupo}' foi atualizada por {autor_nome}."
        criar_notificacao(conn, 'bi-trash3-fill', texto_notificacao, 'cadastros', None, None, tipo_notificacao_estrategica='alteracao_faixas')

        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao excluir faixa: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Faixa excluída com sucesso!"})
