from flask import Blueprint, jsonify, request
from ..db import get_db_connection
from werkzeug.security import generate_password_hash
from datetime import datetime
import sqlite3

bp = Blueprint('solicitacoes', __name__, url_prefix='/api')

@bp.route('/solicitacoes', methods=['GET'])
def get_solicitacoes():
    conn = get_db_connection()
    solicitacoes = conn.execute('SELECT * FROM solicitacoes_cadastro ORDER BY data_solicitacao DESC').fetchall()
    conn.close()
    return jsonify([dict(row) for row in solicitacoes])

@bp.route('/solicitacoes', methods=['POST'])
def create_solicitacao():
    data = request.get_json()
    conn = get_db_connection()
    try:
        # Extrai os dados da requisição
        matricula = data.get('matricula')
        email = data.get('email')
        
        # --- Validação de Duplicidade ---
        # 1. Verifica se o usuário já existe na tabela principal 'usuarios'
        usuario_existente = conn.execute(
            'SELECT id FROM usuarios WHERE matricula = ? OR email = ?',
            (matricula, email)
        ).fetchone()
        if usuario_existente:
            return jsonify({"message": "Matrícula ou e-mail já cadastrado no sistema."}), 409 # 409 Conflict

        # 2. Verifica se já existe uma solicitação pendente
        solicitacao_existente = conn.execute(
            'SELECT id FROM solicitacoes_cadastro WHERE matricula = ? OR email = ?',
            (matricula, email)
        ).fetchone()
        if solicitacao_existente:
            return jsonify({"message": "Já existe uma solicitação de cadastro para esta matrícula ou e-mail."}), 409

        # --- Inserção da Nova Solicitação ---
        conn.execute(
            """
            INSERT INTO solicitacoes_cadastro 
            (matricula, nome, email, contato, funcao_id, unidade_id, data_solicitacao)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                matricula, data.get('nome'), email, data.get('contato'),
                data.get('funcao_id'), data.get('unidade_id'),
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            )
        )
        conn.commit()
        
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro inesperado: {e}"}), 500
    finally:
        conn.close()
        
    return jsonify({"message": "Solicitação de cadastro enviada com sucesso! Aguarde a aprovação."}), 201

# --- NOVA ROTA PARA NEGAR/EXCLUIR SOLICITAÇÃO ---
@bp.route('/solicitacoes/<int:id>', methods=['DELETE'])
def delete_solicitacao(id):
    """
    Exclui (nega) uma solicitação de cadastro pendente.
    """
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM solicitacoes_cadastro WHERE id = ?', (id,))
        conn.commit()
        
        if cursor.rowcount == 0:
            return jsonify({"message": "Solicitação não encontrada."}), 404
            
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()
        
    return jsonify({"message": "Solicitação negada com sucesso."}), 200


@bp.route('/cadastrar_solicitacao', methods=['POST'])
def cadastrar_solicitacao():
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute("BEGIN") 
        solicitacao = conn.execute('SELECT * FROM solicitacoes_cadastro WHERE id = ?', (data.get('id'),)).fetchone()
        if not solicitacao:
            raise Exception("Solicitação não encontrada.")

        senha_hashed = generate_password_hash(data.get('senha'))
        conn.execute(
            "INSERT INTO usuarios (matricula, nome, email, contato, funcao_id, unidade_id, senha_hash, perfil_id, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, 'user', 1)",
            (solicitacao['matricula'], solicitacao['nome'], solicitacao['email'], solicitacao['contato'], solicitacao['funcao_id'], solicitacao['unidade_id'], senha_hashed)
        )
        conn.execute('DELETE FROM solicitacoes_cadastro WHERE id = ?', (data.get('id'),))
        conn.commit()
    except Exception as e:
        conn.rollback() 
        return jsonify({'message': str(e)}), 500
    finally:
        conn.close()
    return jsonify({"message": f"Usuário {solicitacao['nome']} cadastrado com sucesso!"}), 201
