from flask import Blueprint, jsonify, request
from ..db import get_db_connection
import sqlite3
# Importa a função de criar notificação
from ..Rotas.notificacoes import criar_notificacao

bp = Blueprint('centros_custo', __name__, url_prefix='/api/centros_custo')

@bp.route('', methods=['GET'])
def get_centros_custo():
    conn = get_db_connection()
    centros_custo = conn.execute('SELECT * FROM centros_custo ORDER BY nome_cc').fetchall()
    conn.close()
    return jsonify([dict(row) for row in centros_custo])

@bp.route('', methods=['POST'])
def create_centro_custo():
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        
        # CORREÇÃO: Renomeado para 'autor_id' para refletir o utilizador que realiza a ação
        autor_id = data.pop('autor_id', None)
        autor_nome = "um utilizador"
        if autor_id:
            autor = conn.execute('SELECT nome FROM usuarios WHERE id = ?', (autor_id,)).fetchone()
            if autor:
                autor_nome = autor['nome']

        # Insere o novo centro de custo
        conn.execute(
            'INSERT INTO centros_custo (cod_cc, nome_cc, tipo, pai_id, estado, gestor, controlador, responde_iqd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (data['cod_cc'], data['nome_cc'], data['tipo'], data.get('pai_id'), data['estado'], data['gestor'], data['controlador'], data['responde_iqd'])
        )
        
        # Cria a notificação estratégica para os admins interessados
        texto_notificacao = f"Novo Centro de Custo '{data['nome_cc']}' foi criado por {autor_nome}."
        criar_notificacao(conn, 'bi-building-add', texto_notificacao, 'cadastros', None, None, tipo_notificacao_estrategica='cadastro_cc')
        
        conn.commit()
        message = {"message": f"Centro de Custo '{data['nome_cc']}' criado com sucesso!"}
    except sqlite3.IntegrityError:
        conn.rollback()
        return jsonify({"message": f"Erro: Código de CC '{data['cod_cc']}' já existe."}), 400
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify(message), 201

@bp.route('/<int:id>', methods=['PUT'])
def update_centro_custo(id):
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

        # Atualiza o centro de custo
        conn.execute(
            'UPDATE centros_custo SET cod_cc = ?, nome_cc = ?, tipo = ?, pai_id = ?, estado = ?, gestor = ?, controlador = ?, responde_iqd = ? WHERE id = ?',
            (data['cod_cc'], data['nome_cc'], data['tipo'], data.get('pai_id'), data['estado'], data['gestor'], data['controlador'], data['responde_iqd'], id)
        )
        
        # Cria a notificação estratégica
        texto_notificacao = f"O Centro de Custo '{data['nome_cc']}' foi atualizado por {autor_nome}."
        criar_notificacao(conn, 'bi-building-gear', texto_notificacao, 'cadastros', None, None, tipo_notificacao_estrategica='edicao_cc')
        
        conn.commit()
        message = {"message": "Centro de Custo atualizado com sucesso!"}
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
    return jsonify(message)

@bp.route('/<int:id>', methods=['DELETE'])
def delete_centro_custo(id):
    autor_id = request.args.get('autor_id') # Recebe o ID do autor pela URL
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')

        autor_nome = "um utilizador"
        if autor_id:
            autor = conn.execute('SELECT nome FROM usuarios WHERE id = ?', (autor_id,)).fetchone()
            if autor:
                autor_nome = autor['nome']
        
        cc_para_deletar = conn.execute('SELECT nome_cc FROM centros_custo WHERE id = ?', (id,)).fetchone()
        if not cc_para_deletar:
             return jsonify({"message": "Centro de Custo não encontrado."}), 404
        nome_cc = cc_para_deletar['nome_cc']

        conn.execute('DELETE FROM centros_custo WHERE id = ?', (id,))
        
        texto_notificacao = f"O Centro de Custo '{nome_cc}' foi excluído por {autor_nome}."
        criar_notificacao(conn, 'bi-building-dash', texto_notificacao, 'cadastros', None, None, tipo_notificacao_estrategica='exclusao_cc')

        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao excluir Centro de Custo: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Centro de Custo excluído com sucesso!"})
