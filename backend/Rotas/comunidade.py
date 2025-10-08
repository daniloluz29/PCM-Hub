import os
import uuid
from flask import Blueprint, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename
from ..db import get_db_connection

bp = Blueprint('comunidade', __name__, url_prefix='/api')

# --- CONFIGURAÇÃO DE UPLOAD ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, '..', 'images', 'anuncios')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- NOVA ROTA PARA SERVIR IMAGENS ---
@bp.route('/anuncios/images/<filename>')
def serve_anuncio_image(filename):
    # Diretório onde as imagens dos anúncios estão salvas
    anuncios_image_dir = os.path.join(BASE_DIR, '..', 'images', 'anuncios')
    try:
        response = send_from_directory(anuncios_image_dir, filename)
        # CORREÇÃO: Adiciona o cabeçalho CORS manualmente na resposta
        response.headers['Access-Control-Allow-Origin'] = '*'
        return response
    except FileNotFoundError:
        return jsonify({"message": "Arquivo não encontrado"}), 404


# --- ROTAS DE CONTATOS E EVENTOS ---
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
    tipo_id = request.args.get('tipo_id')
    
    base_query = """
        SELECT e.*, u.nome as criado_por_nome, te.tipo as tipo_nome, te.cor
        FROM eventos e
        LEFT JOIN usuarios u ON e.criado_por_id = u.id
        LEFT JOIN tipo_eventos te ON e.tipo_id = te.id
    """
    params = ()
    
    if tipo_id:
        base_query += " WHERE e.tipo_id = ?"
        params = (tipo_id,)

    base_query += " ORDER BY e.data_inicio"
    
    eventos_db = conn.execute(base_query, params).fetchall()
    conn.close()
    return jsonify([dict(ev) for ev in eventos_db])


@bp.route('/eventos', methods=['POST'])
def create_evento():
    data = request.get_json()
    conn = get_db_connection()
    try:
        conn.execute(
            'INSERT INTO eventos (titulo, descricao, data_inicio, data_fim, criado_por_id, visibilidade_tipo, visibilidade_alvo, local, hora_inicio, hora_fim, recorrencia, tipo_id, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (data['titulo'], data.get('descricao'), data['data_inicio'], data.get('data_fim'), data.get('criado_por_id'), data.get('visibilidade_tipo'), data.get('visibilidade_alvo'), data.get('local'), data.get('hora_inicio'), data.get('hora_fim'), data.get('recorrencia'), data.get('tipo_id'), data.get('latitude'), data.get('longitude'))
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
            'UPDATE eventos SET titulo = ?, descricao = ?, data_inicio = ?, data_fim = ?, visibilidade_tipo = ?, visibilidade_alvo = ?, local = ?, hora_inicio = ?, hora_fim = ?, recorrencia = ?, tipo_id = ?, latitude = ?, longitude = ? WHERE id = ?',
            (data['titulo'], data.get('descricao'), data['data_inicio'], data.get('data_fim'), data.get('visibilidade_tipo'), data.get('visibilidade_alvo'), data.get('local'), data.get('hora_inicio'), data.get('hora_fim'), data.get('recorrencia'), data.get('tipo_id'), data.get('latitude'), data.get('longitude'), id)
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


@bp.route('/tipos_eventos', methods=['GET'])
def get_tipos_eventos():
    conn = get_db_connection()
    tipos = conn.execute('SELECT id, tipo, cor FROM tipo_eventos ORDER BY tipo').fetchall()
    conn.close()
    return jsonify([dict(row) for row in tipos])

@bp.route('/tipos_eventos/batch', methods=['POST'])
def batch_update_tipos_eventos():
    data = request.get_json()
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if data.get('insert'):
            for item in data['insert']:
                cursor.execute('INSERT INTO tipo_eventos (tipo, cor) VALUES (?, ?)', (item['tipo'], item['cor']))
        if data.get('update'):
            for item in data['update']:
                cursor.execute('UPDATE tipo_eventos SET tipo = ?, cor = ? WHERE id = ?', (item['tipo'], item['cor'], item['id']))
        if data.get('delete'):
            for item in data['delete']:
                cursor.execute('DELETE FROM tipo_eventos WHERE id = ?', (item['id'],))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao processar alterações: {e}"}), 500
    finally:
        conn.close()
    return jsonify({"message": "Tipos de evento atualizados com sucesso!"})

# --- ROTAS DE ANÚNCIOS ---

@bp.route('/anuncios', methods=['GET'])
def get_anuncios():
    conn = get_db_connection()
    query = """
        SELECT a.*, u.nome as criado_por_nome 
        FROM anuncios a 
        LEFT JOIN usuarios u ON a.criado_por_id = u.id 
        ORDER BY a.data_criacao DESC
    """
    anuncios = conn.execute(query).fetchall()
    conn.close()
    return jsonify([dict(row) for row in anuncios])


@bp.route('/anuncios', methods=['POST'])
def create_anuncio():
    tipo = request.form.get('tipo')
    criado_por_id = request.form.get('criado_por_id')
    link = request.form.get('link')
    data_publicacao = request.form.get('data_publicacao') or None

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        if tipo == 'imagem':
            if 'file' not in request.files:
                return jsonify({'message': 'Nenhum arquivo enviado'}), 400

            file = request.files['file']
            if file.filename == '' or not allowed_file(file.filename):
                return jsonify({'message': 'Arquivo inválido ou não permitido'}), 400

            ext = file.filename.rsplit('.', 1)[1].lower()
            filename = f"{uuid.uuid4().hex}.{ext}"
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            save_path = os.path.join(UPLOAD_FOLDER, filename)
            file.save(save_path)

            conteudo = f"images/anuncios/{filename}".replace('\\', '/')
            cursor.execute(
                'INSERT INTO anuncios (tipo, conteudo, criado_por_id, link, data_publicacao) VALUES (?, ?, ?, ?, ?)',
                (tipo, conteudo, criado_por_id, link, data_publicacao)
            )

        elif tipo == 'html':
            conteudo = request.form.get('conteudo')
            if not conteudo:
                return jsonify({'message': 'Conteúdo HTML não pode ser vazio'}), 400
            cursor.execute(
                'INSERT INTO anuncios (tipo, conteudo, criado_por_id, link, data_publicacao) VALUES (?, ?, ?, ?, ?)',
                (tipo, conteudo, criado_por_id, link, data_publicacao)
            )
        else:
            return jsonify({'message': 'Tipo de anúncio inválido'}), 400

        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao salvar no banco de dados: {e}"}), 500
    finally:
        conn.close()

    return jsonify({"message": "Anúncio criado com sucesso!"}), 201


@bp.route('/anuncios/<int:id>', methods=['PUT'])
def update_anuncio(id):
    tipo = request.form.get('tipo')
    link = request.form.get('link')
    data_publicacao = request.form.get('data_publicacao') or None

    conn = get_db_connection()
    cursor = conn.cursor()

    anuncio_antigo = cursor.execute('SELECT * FROM anuncios WHERE id = ?', (id,)).fetchone()
    if not anuncio_antigo:
        conn.close()
        return jsonify({"message": "Anúncio não encontrado"}), 404

    conteudo = anuncio_antigo['conteudo']

    try:
        if tipo == 'imagem':
            if 'file' in request.files:
                file = request.files['file']
                if file and allowed_file(file.filename):
                    if anuncio_antigo['tipo'] == 'imagem':
                        old_file_path = os.path.join(BASE_DIR, '..', anuncio_antigo['conteudo'])
                        if os.path.exists(old_file_path):
                            os.remove(old_file_path)

                    ext = file.filename.rsplit('.', 1)[1].lower()
                    filename = f"{uuid.uuid4().hex}.{ext}"
                    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
                    save_path = os.path.join(UPLOAD_FOLDER, filename)
                    file.save(save_path)
                    conteudo = f"images/anuncios/{filename}".replace('\\', '/')

        elif tipo == 'html':
            if anuncio_antigo['tipo'] == 'imagem':
                old_file_path = os.path.join(BASE_DIR, '..', anuncio_antigo['conteudo'])
                if os.path.exists(old_file_path):
                    os.remove(old_file_path)
            conteudo = request.form.get('conteudo')

        cursor.execute(
            'UPDATE anuncios SET tipo = ?, conteudo = ?, link = ?, data_publicacao = ? WHERE id = ?',
            (tipo, conteudo, link, data_publicacao, id)
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao atualizar anúncio: {e}"}), 500
    finally:
        conn.close()

    return jsonify({"message": "Anúncio atualizado com sucesso!"})


@bp.route('/anuncios/<int:id>', methods=['DELETE'])
def delete_anuncio(id):
    conn = get_db_connection()
    anuncio = conn.execute('SELECT * FROM anuncios WHERE id = ?', (id,)).fetchone()

    if not anuncio:
        conn.close()
        return jsonify({"message": "Anúncio não encontrado"}), 404

    if anuncio['tipo'] == 'imagem':
        try:
            file_path = os.path.join(BASE_DIR, '..', anuncio['conteudo'])
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            print(f"Erro ao deletar arquivo de imagem: {e}")

    conn.execute('DELETE FROM anuncios WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Anúncio excluído com sucesso!"})

