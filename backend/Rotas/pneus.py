from flask import Blueprint, jsonify, request
from ..db import get_db_connection
import json
import pandas as pd
import traceback # NOVO: Import para depuração detalhada

bp = Blueprint('pneus', __name__, url_prefix='/api/pneus')

# --- ROTAS PARA GERENCIAMENTO DE LAYOUTS ---

@bp.route('/layouts', methods=['POST'])
def criar_layout():
    """Cria um novo layout de pneu no banco de dados."""
    dados = request.get_json()
    # O campo 'nome_layout' foi removido da validação e da inserção.
    if not dados or 'cod_tipo_obj' not in dados or 'configuracao' not in dados:
        return jsonify({"error": "Dados incompletos"}), 400

    conn = None
    try:
        conn = get_db_connection()
        configuracao_json = json.dumps(dados['configuracao'])
        
        cursor = conn.cursor()
        # A coluna nome_layout foi removida do INSERT.
        cursor.execute(
            "INSERT INTO layouts_pneus (cod_tipo_obj, configuracao) VALUES (?, ?)",
            (dados['cod_tipo_obj'], configuracao_json)
        )
        conn.commit()
        return jsonify({"id": cursor.lastrowid}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@bp.route('/layouts', methods=['GET'])
def listar_layouts():
    """Lista todos os layouts de pneus, juntando com o nome do tipo de objeto."""
    conn = None
    try:
        conn = get_db_connection()
        # O campo 'nome_layout' foi removido da consulta.
        layouts_db = conn.execute("""
            SELECT l.id, l.cod_tipo_obj, l.configuracao, t.tipo_obj 
            FROM layouts_pneus l
            JOIN tipo_obj t ON l.cod_tipo_obj = t.cod_tipo_obj
            ORDER BY t.tipo_obj
        """).fetchall()
        
        layouts = []
        for row in layouts_db:
            layout = dict(row)
            layout['configuracao'] = json.loads(layout['configuracao'])
            layouts.append(layout)
            
        return jsonify(layouts)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@bp.route('/layouts/<int:layout_id>', methods=['PUT'])
def atualizar_layout(layout_id):
    """Atualiza um layout de pneu existente."""
    dados = request.get_json()
    # O campo 'nome_layout' foi removido da validação e da atualização.
    if not dados or 'configuracao' not in dados:
        return jsonify({"error": "Dados incompletos"}), 400

    conn = None
    try:
        conn = get_db_connection()
        configuracao_json = json.dumps(dados['configuracao'])
        # A coluna nome_layout foi removida do UPDATE.
        conn.execute(
            "UPDATE layouts_pneus SET configuracao = ? WHERE id = ?",
            (configuracao_json, layout_id)
        )
        conn.commit()
        return jsonify({"message": "Layout atualizado com sucesso"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@bp.route('/layouts/<int:layout_id>', methods=['DELETE'])
def deletar_layout(layout_id):
    """Deleta um layout de pneu."""
    conn = None
    try:
        conn = get_db_connection()
        conn.execute("DELETE FROM layouts_pneus WHERE id = ?", (layout_id,))
        conn.commit()
        return jsonify({"message": "Layout deletado com sucesso"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()
            
@bp.route('/tipos-equipamento', methods=['GET'])
def get_tipos_equipamento():
    """Busca os tipos de equipamento da tabela tipo_obj."""
    conn = None
    try:
        conn = get_db_connection()
        tipos = conn.execute("SELECT cod_tipo_obj, tipo_obj FROM tipo_obj ORDER BY tipo_obj").fetchall()
        return jsonify([dict(row) for row in tipos])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()


# --- ROTAS PARA DADOS DE INSPEÇÃO ---

@bp.route('/inspecoes/<prefixo_equipamento>', methods=['GET'])
def get_inspecoes_por_equipamento(prefixo_equipamento):
    """
    Busca o layout e os dados de inspeção para um equipamento específico.
    """
    conn = None
    try:
        conn = get_db_connection()

        # ETAPA 1: Buscar o layout do equipamento fazendo o JOIN entre as tabelas.
        layout_query = """
            SELECT
                l.configuracao
            FROM equipamentos e
            JOIN tipo_obj t ON e.cod_tipo = t.cod_tipo_obj
            JOIN layouts_pneus l ON t.cod_tipo_obj = l.cod_tipo_obj
            WHERE e.equipamento = ?
        """
        layout_row = conn.execute(layout_query, (prefixo_equipamento,)).fetchone()

        if not layout_row:
            return jsonify({"error": "Nenhum layout encontrado para este equipamento."}), 404

        layout_config = json.loads(layout_row['configuracao'])

        # ETAPA 2: Buscar os dados de inspeção do equipamento.
        inspecao_query = """
            SELECT 
                posicao_agregado,
                data_medicao,
                medicao,
                num_fogo,
                estado_conservacao,
                modelo_pneu,
                medida_pneu
            FROM controle_pneus 
            WHERE equipamento = ?
            ORDER BY data_medicao DESC
        """
        df = pd.read_sql_query(inspecao_query, conn, params=(prefixo_equipamento,))

        # Se não houver inspeções, retorna o layout com dados vazios.
        if df.empty:
            return jsonify({
                "layout": layout_config,
                "ultima_inspecao": {},
                "historico": []
            })

        # ETAPA 3: Processar os dados da inspeção.
        df['data_medicao'] = pd.to_datetime(df['data_medicao'])
        ultima_inspecao_df = df.sort_values('data_medicao', ascending=False).drop_duplicates('posicao_agregado')
        
        ultima_inspecao = {
            row['posicao_agregado']: {
                'medicao': row['medicao'],
                'num_fogo': row['num_fogo'],
                'modelo_pneu': row['modelo_pneu'],
                'estado_conservacao': row['estado_conservacao'],
                'data_medicao': row['data_medicao'].strftime('%d/%m/%Y %H:%M')
            } for index, row in ultima_inspecao_df.iterrows()
        }

        # Formatar histórico
        df['data_medicao'] = df['data_medicao'].dt.strftime('%d/%m/%Y %H:%M')
        historico = df.to_dict('records')

        # ETAPA 4: Retornar o payload completo.
        return jsonify({
            "layout": layout_config,
            "ultima_inspecao": ultima_inspecao,
            "historico": historico
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@bp.route('/equipamentos', methods=['GET'])
def get_equipamentos():
    """Busca a lista de equipamentos únicos da tabela de controle."""
    conn = None
    try:
        conn = get_db_connection()
        # Alterado para buscar da tabela 'equipamentos' que é a fonte oficial.
        equipamentos = conn.execute("SELECT DISTINCT equipamento FROM equipamentos WHERE equipamento IS NOT NULL ORDER BY equipamento").fetchall()
        return jsonify([row['equipamento'] for row in equipamentos])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()
            
# ALTERADO: Endpoint para a análise geral com lógica de filtragem de CC corrigida
@bp.route('/analise-geral', methods=['GET'])
def get_analise_geral():
    """Busca e agrupa dados de pneus por centro de custo e equipamento."""
    conn = None
    try:
        conn = get_db_connection()
        
        # ETAPA 1: Identificar os centros de custo que têm pelo menos uma medição.
        ccs_com_medicao_query = """
            SELECT DISTINCT e.cod_cc
            FROM controle_pneus cp
            JOIN equipamentos e ON cp.equipamento = e.equipamento
            WHERE e.cod_cc IS NOT NULL
        """
        ccs_validos_df = pd.read_sql_query(ccs_com_medicao_query, conn)
        
        if ccs_validos_df.empty:
            return jsonify([])
        
        ccs_validos_lista = tuple(ccs_validos_df['cod_cc'].tolist())
        
        # ETAPA 2: Buscar todos os equipamentos desses centros de custo e suas medições.
        placeholders = ','.join('?' for _ in ccs_validos_lista)
        query = f"""
            SELECT
                e.equipamento,
                cc.nome_cc,
                cp.data_medicao,
                cp.num_fogo
            FROM equipamentos e
            JOIN centros_custo cc ON e.cod_cc = cc.cod_cc
            LEFT JOIN controle_pneus cp ON e.equipamento = cp.equipamento
            WHERE e.cod_cc IN ({placeholders})
        """
        df = pd.read_sql_query(query, conn, params=ccs_validos_lista)

        if df.empty:
            return jsonify([])

        # ETAPA 3: Processar os dados como antes.
        df['data_medicao'] = pd.to_datetime(df['data_medicao'], errors='coerce')
        
        def agg_fogo(series):
            return list(series.dropna().unique())

        agg_funcs = {
            'data_medicao': 'max',
            'num_fogo': ['nunique', agg_fogo]
        }
        df_agg = df.groupby(['equipamento', 'nome_cc']).agg(agg_funcs).reset_index()

        df_agg.columns = ['equipamento', 'nome_cc', 'ultima_medicao', 'pneus_agregados', 'numeros_fogo']
        
        df_agg['pneus_agregados'] = df_agg['pneus_agregados'].astype(int)

        df_agg['ultima_medicao'] = df_agg['ultima_medicao'].dt.strftime('%d/%m/%Y').fillna('Sem medições')

        resultado_final = df_agg.groupby('nome_cc').apply(
            lambda x: x[['equipamento', 'pneus_agregados', 'ultima_medicao', 'numeros_fogo']].to_dict('records')
        ).reset_index(name='equipamentos')
        
        resultado_final.rename(columns={'nome_cc': 'centro_custo'}, inplace=True)
        
        return jsonify(resultado_final.to_dict('records'))

    except Exception as e:
        print("--- ERRO DETALHADO EM /api/pneus/analise-geral ---")
        traceback.print_exc()
        print("-------------------------------------------------")
        return jsonify({"error": "Ocorreu um erro interno no servidor."}), 500
    finally:
        if conn:
            conn.close()

