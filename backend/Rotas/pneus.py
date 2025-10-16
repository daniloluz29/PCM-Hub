from flask import Blueprint, jsonify, request
from ..db import get_db_connection
import json
import pandas as pd
import traceback 
from datetime import datetime, timedelta

bp = Blueprint('pneus', __name__, url_prefix='/api/pneus')

# --- ROTAS PARA GERENCIAMENTO DE LAYOUTS ---

@bp.route('/layouts', methods=['POST'])
def criar_layout():
    """Cria um novo layout de pneu no banco de dados."""
    dados = request.get_json()
    if not dados or 'cod_tipo_obj' not in dados or 'configuracao' not in dados:
        return jsonify({"error": "Dados incompletos"}), 400

    conn = None
    try:
        conn = get_db_connection()
        configuracao_json = json.dumps(dados['configuracao'])
        
        cursor = conn.cursor()
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
    if not dados or 'configuracao' not in dados:
        return jsonify({"error": "Dados incompletos"}), 400

    conn = None
    try:
        conn = get_db_connection()
        configuracao_json = json.dumps(dados['configuracao'])
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

        # ETAPA 1: Buscar o layout, o tipo de objeto e o cod_tipo do equipamento.
        query_equipamento = """
            SELECT
                e.equipamento,
                t.tipo_obj,
                t.cod_tipo_obj,
                l.configuracao
            FROM equipamentos e
            JOIN tipo_obj t ON e.cod_tipo = t.cod_tipo_obj
            LEFT JOIN layouts_pneus l ON t.cod_tipo_obj = l.cod_tipo_obj
            WHERE e.equipamento = ?
        """
        equip_row = conn.execute(query_equipamento, (prefixo_equipamento,)).fetchone()

        if not equip_row:
            return jsonify({"error": "Equipamento não encontrado."}), 404
        
        # Converte para um dicionário mutável
        dados_equipamento = dict(equip_row)

        if not dados_equipamento['configuracao']:
            # Retorna informações básicas mesmo sem layout, para a UI de erro.
            return jsonify({
                "equipamento": dados_equipamento['equipamento'],
                "tipo_obj": dados_equipamento['tipo_obj'],
                "layout": None,
                "ultima_inspecao": {}
            }), 404 # Mantém o 404 para indicar que o recurso principal (layout) não foi encontrado

        dados_equipamento['configuracao'] = json.loads(dados_equipamento['configuracao'])

        # ETAPA 2: Buscar as faixas de definição de pneus
        faixas_query = "SELECT nome_faixa, valor_inicio, valor_fim, status, cor FROM faixas_definicoes WHERE grupo_id = 'estado_pneus'"
        faixas_df = pd.read_sql_query(faixas_query, conn)

        # ETAPA 3: Buscar os dados de inspeção do equipamento.
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
        """
        df = pd.read_sql_query(inspecao_query, conn, params=(prefixo_equipamento,))

        # Se não houver inspeções, retorna o layout com dados vazios.
        if df.empty:
            return jsonify({
                "layout": dados_equipamento['configuracao'],
                "ultima_inspecao": {},
                "tipo_obj": dados_equipamento['tipo_obj'],
                "equipamento": dados_equipamento['equipamento']
            })

        # ETAPA 4: Processar os dados da inspeção.
        df['data_medicao'] = pd.to_datetime(df['data_medicao'], errors='coerce')
        df.sort_values('data_medicao', ascending=False, inplace=True, na_position='last')
        ultima_inspecao_df = df.drop_duplicates('posicao_agregado')
        
        ultima_inspecao_formatada = {}
        for _, row in ultima_inspecao_df.iterrows():
            posicao = str(row['posicao_agregado']).split(' ')[0].zfill(2)
            medicao = row['medicao']
            
            # Enriquecer com informações da faixa
            faixa_info = None
            if pd.notna(medicao):
                for _, faixa in faixas_df.iterrows():
                    if faixa['valor_inicio'] <= medicao <= faixa['valor_fim']:
                        faixa_info = {
                            'nome_faixa': faixa['nome_faixa'],
                            'status': faixa['status'],
                            'cor': faixa['cor']
                        }
                        break
            
            data_medicao_str = row['data_medicao'].strftime('%d/%m/%Y %H:%M') if pd.notna(row['data_medicao']) else None

            # Substitui NaN por None para compatibilidade JSON
            row_dict = row.to_dict()
            for key, value in row_dict.items():
                if pd.isna(value):
                    row_dict[key] = None

            ultima_inspecao_formatada[posicao] = {
                **row_dict,
                'data_medicao': data_medicao_str,
                'faixa_info': faixa_info
            }

        return jsonify({
            "layout": dados_equipamento['configuracao'],
            "ultima_inspecao": ultima_inspecao_formatada,
            "tipo_obj": dados_equipamento['tipo_obj'],
            "equipamento": dados_equipamento['equipamento']
        })

    except Exception as e:
        traceback.print_exc()
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
        equipamentos = conn.execute("SELECT DISTINCT equipamento FROM equipamentos WHERE equipamento IS NOT NULL ORDER BY equipamento").fetchall()
        return jsonify([row['equipamento'] for row in equipamentos])
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()

@bp.route('/analise-geral', methods=['GET'])
def get_analise_geral():
    conn = None
    try:
        conn = get_db_connection()

        base_query = """
            SELECT
                e.equipamento,
                cc.nome_cc,
                t.tipo_obj,
                l.configuracao
            FROM equipamentos e
            JOIN centros_custo cc ON e.cod_cc = cc.cod_cc
            LEFT JOIN tipo_obj t ON e.cod_tipo = t.cod_tipo_obj
            LEFT JOIN layouts_pneus l ON t.cod_tipo_obj = l.cod_tipo_obj
        """
        equip_df = pd.read_sql_query(base_query, conn)

        if equip_df.empty:
            return jsonify([])

        inspecoes_query = "SELECT equipamento, posicao_agregado, data_medicao, medicao, num_fogo FROM controle_pneus"
        inspecoes_df = pd.read_sql_query(inspecoes_query, conn)
        
        faixas_query = "SELECT nome_faixa, valor_inicio, valor_fim, status, cor FROM faixas_definicoes WHERE grupo_id = 'estado_pneus'"
        faixas_df = pd.read_sql_query(faixas_query, conn)

        if not inspecoes_df.empty:
            inspecoes_df['data_medicao'] = pd.to_datetime(inspecoes_df['data_medicao'], errors='coerce')
            ultimas_inspecoes = inspecoes_df.sort_values(['equipamento', 'posicao_agregado', 'data_medicao'], ascending=False, na_position='last').drop_duplicates(['equipamento', 'posicao_agregado'])
        else:
            ultimas_inspecoes = pd.DataFrame()
            # Adiciona a coluna data_medicao para evitar erros posteriores
            ultimas_inspecoes['data_medicao'] = pd.NaT

        # NOVO: Função para calcular o status do equipamento
        def calcular_status_equipamento(row):
            status = []
            config_str = row['configuracao']
            
            # 1. Sem layout cadastrado
            if not config_str or pd.isna(config_str):
                return "Sem layout cadastrado"

            try:
                config = json.loads(config_str)
                total_pneus_layout = sum(2 * nivel['pneus_por_lado'] for nivel in config if nivel['tipo'] == 'eixo')
            except (json.JSONDecodeError, TypeError):
                return "Erro no layout" # Layout inválido

            inspecoes_equip = ultimas_inspecoes[ultimas_inspecoes['equipamento'] == row['equipamento']]
            
            # 2. Faltando agregação
            if len(inspecoes_equip) < total_pneus_layout:
                status.append("Faltando agregação")

            tem_medicao_recente = False
            alguma_medicao_existe = False
            
            for _, insp_row in inspecoes_equip.iterrows():
                medicao = insp_row['medicao']
                data_medicao = insp_row['data_medicao']
                
                # 3. Faltando medição
                if pd.isna(medicao):
                    if "Faltando medição" not in status:
                        status.append("Faltando medição")
                else:
                    alguma_medicao_existe = True
                    # 4. Pneus com alto desgaste
                    for _, faixa in faixas_df.iterrows():
                        if faixa['valor_inicio'] <= medicao <= faixa['valor_fim'] and faixa['status'] == 'Crítico':
                            if "Pneus com alto desgaste" not in status:
                                status.append("Pneus com alto desgaste")
                            break
                
                # 5. Sem medições recentes
                if pd.notna(data_medicao) and data_medicao > datetime.now() - timedelta(days=7):
                    tem_medicao_recente = True
            
            if alguma_medicao_existe and not tem_medicao_recente:
                 status.append("Sem medições recentes")

            # 6. OK
            if not status:
                return "OK"
            
            return " | ".join(status)


        def processar_equipamento(row):
            equip_nome = row['equipamento']
            
            if not ultimas_inspecoes.empty:
                inspecoes_equip = ultimas_inspecoes[ultimas_inspecoes['equipamento'] == equip_nome]
            else:
                inspecoes_equip = pd.DataFrame()

            ultima_inspecao_formatada = {}
            numeros_fogo = []
            
            for _, insp_row in inspecoes_equip.iterrows():
                posicao = str(insp_row['posicao_agregado']).split(' ')[0].zfill(2)
                medicao = insp_row['medicao']
                
                faixa_info = None
                if pd.notna(medicao):
                    for _, faixa in faixas_df.iterrows():
                        if faixa['valor_inicio'] <= medicao <= faixa['valor_fim']:
                            faixa_info = {'cor': faixa['cor'], 'status': faixa['status']} # Passa o status da faixa também
                            break
                
                row_dict = insp_row.to_dict()
                for key, value in row_dict.items():
                    if pd.isna(value): row_dict[key] = None
                
                ultima_inspecao_formatada[posicao] = {**row_dict, 'faixa_info': faixa_info}
                if insp_row['num_fogo']:
                    numeros_fogo.append(insp_row['num_fogo'])

            data_max = inspecoes_equip['data_medicao'].max() if not inspecoes_equip.empty else pd.NaT
            ultima_medicao_str = data_max.strftime('%d/%m/%Y') if pd.notna(data_max) else 'Sem medições'
            
            config = None
            if pd.notna(row['configuracao']):
                try:
                    config = json.loads(row['configuracao'])
                except (json.JSONDecodeError, TypeError):
                    config = None

            return pd.Series([
                len(set(numeros_fogo)),
                ultima_medicao_str,
                config,
                ultima_inspecao_formatada,
                calcular_status_equipamento(row) # Adiciona o status calculado
            ])

        equip_df[['pneus_agregados', 'ultima_medicao', 'configuracao', 'ultima_inspecao', 'status']] = equip_df.apply(processar_equipamento, axis=1)

        resultado_final = equip_df.groupby('nome_cc').apply(
            lambda x: x.drop('nome_cc', axis=1).to_dict('records')
        ).reset_index(name='equipamentos')
        
        resultado_final.rename(columns={'nome_cc': 'centro_custo'}, inplace=True)
        
        return jsonify(resultado_final.to_dict('records'))

    except Exception as e:
        print("--- ERRO DETALHADO EM /api/pneus/analise-geral ---")
        traceback.print_exc()
        print("-------------------------------------------------")
        return jsonify({"error": "Ocorreu um erro interno no servidor.", "details": str(e)}), 500
    finally:
        if conn:
            conn.close()

