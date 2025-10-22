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

# --- ROTAS PARA DADOS DE INSPEÇÃO E ANÁLISE ---
def get_faixas_pneus(conn):
    faixas_db = conn.execute("SELECT nome_faixa, valor_inicio, valor_fim, status, cor FROM faixas_definicoes WHERE grupo_id = 'estado_pneus'").fetchall()
    return [dict(row) for row in faixas_db]

def classificar_medicao(medicao, faixas):
    if medicao is None or pd.isna(medicao):
        return None
    for faixa in faixas:
        if faixa['valor_inicio'] <= medicao <= faixa['valor_fim']:
            return faixa
    return None

@bp.route('/inspecoes/<prefixo_equipamento>', methods=['GET'])
def get_inspecoes_por_equipamento(prefixo_equipamento):
    conn = None
    try:
        conn = get_db_connection()
        layout_query = """
            SELECT l.configuracao, t.tipo_obj
            FROM equipamentos e
            JOIN tipo_obj t ON e.cod_tipo = t.cod_tipo_obj
            JOIN layouts_pneus l ON t.cod_tipo_obj = l.cod_tipo_obj
            WHERE e.equipamento = ?
        """
        layout_row = conn.execute(layout_query, (prefixo_equipamento,)).fetchone()

        if not layout_row:
            tipo_obj_row = conn.execute("SELECT t.tipo_obj FROM equipamentos e JOIN tipo_obj t ON e.cod_tipo = t.cod_tipo_obj WHERE e.equipamento = ?", (prefixo_equipamento,)).fetchone()
            tipo_obj = tipo_obj_row['tipo_obj'] if tipo_obj_row else None
            return jsonify({"error": "Nenhum layout encontrado para este equipamento.", "tipo_obj": tipo_obj}), 404

        layout_config = json.loads(layout_row['configuracao'])
        tipo_obj_equipamento = layout_row['tipo_obj']

        inspecao_query = "SELECT posicao_agregado, data_medicao, medicao, num_fogo, estado_conservacao, modelo_pneu, medida_pneu FROM controle_pneus WHERE equipamento = ? ORDER BY data_medicao DESC"
        df = pd.read_sql_query(inspecao_query, conn, params=(prefixo_equipamento,))
        
        faixas = get_faixas_pneus(conn)
        
        if df.empty:
            return jsonify({ "layout": layout_config, "ultima_inspecao": {}, "tipo_obj": tipo_obj_equipamento })

        df['data_medicao'] = pd.to_datetime(df['data_medicao'], errors='coerce')
        df.sort_values('data_medicao', ascending=False, na_position='last', inplace=True)
        ultima_inspecao_df = df.drop_duplicates('posicao_agregado')

        ultima_inspecao = {}
        for _, row in ultima_inspecao_df.iterrows():
            pos_num = row['posicao_agregado'][:2]
            medicao_val = row['medicao'] if pd.notna(row['medicao']) else None
            faixa_info = classificar_medicao(medicao_val, faixas)
            
            ultima_inspecao[pos_num] = {
                'medicao': medicao_val,
                'num_fogo': row['num_fogo'],
                'modelo_pneu': row['modelo_pneu'],
                'estado_conservacao': row['estado_conservacao'],
                'data_medicao': row['data_medicao'].strftime('%d/%m/%Y %H:%M') if pd.notna(row['data_medicao']) else None,
                'faixa_info': faixa_info
            }
        
        ultima_inspecao_json = pd.Series(ultima_inspecao).replace({pd.NaT: None, pd.NA: None}).where(pd.notnull(pd.Series(ultima_inspecao)), None).to_json(orient='index')

        return jsonify({
            "layout": layout_config,
            "ultima_inspecao": json.loads(ultima_inspecao_json),
            "tipo_obj": tipo_obj_equipamento
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e), "details": traceback.format_exc()}), 500
    finally:
        if conn:
            conn.close()

@bp.route('/analise-geral', methods=['GET'])
def get_analise_geral():
    conn = None
    try:
        conn = get_db_connection()

        equipamentos_query = """
            SELECT e.equipamento, cc.nome_cc, t.tipo_obj, l.configuracao
            FROM equipamentos e
            JOIN centros_custo cc ON e.cod_cc = cc.cod_cc
            LEFT JOIN tipo_obj t ON e.cod_tipo = t.cod_tipo_obj
            LEFT JOIN layouts_pneus l ON t.cod_tipo_obj = l.cod_tipo_obj
        """
        equip_df = pd.read_sql_query(equipamentos_query, conn)
        
        if equip_df.empty:
            return jsonify([])

        faixas = get_faixas_pneus(conn)
        
        placeholders = ','.join('?' for _ in equip_df['equipamento'])
        medicoes_query = f"SELECT equipamento, posicao_agregado, data_medicao, medicao, num_fogo FROM controle_pneus WHERE equipamento IN ({placeholders})"
        medicoes_df = pd.read_sql_query(medicoes_query, conn, params=tuple(equip_df['equipamento'].tolist()))
        medicoes_df['data_medicao'] = pd.to_datetime(medicoes_df['data_medicao'], errors='coerce')

        def analyze_status(row):
            statuses = []
            equip_nome = row['equipamento']
            
            if not row['configuracao'] or pd.isna(row['configuracao']):
                statuses.append("Sem layout cadastrado")
                return " | ".join(statuses)

            config = json.loads(row['configuracao'])
            total_pneus_layout = sum(n['pneus_por_lado'] * 2 for n in config if n['tipo'] == 'eixo')
            
            medicoes_equip = medicoes_df[medicoes_df['equipamento'] == equip_nome]
            
            if medicoes_equip.empty:
                statuses.append("Faltando agregação")
                statuses.append("Faltando medição")
                return " | ".join(statuses)

            agregados_unicos = medicoes_equip['posicao_agregado'].nunique()
            if agregados_unicos < total_pneus_layout:
                statuses.append("Faltando agregação")

            medicoes_validas = medicoes_equip.dropna(subset=['medicao', 'data_medicao'])
            
            if medicoes_validas['posicao_agregado'].nunique() < agregados_unicos:
                statuses.append("Faltando medição")
            
            pneus_criticos = 0
            sem_medicoes_recentes = False
            sete_dias_atras = datetime.now() - timedelta(days=7)

            ultima_medicao_por_pneu = medicoes_validas.sort_values('data_medicao', ascending=False).drop_duplicates('posicao_agregado')

            for _, med in ultima_medicao_por_pneu.iterrows():
                faixa = classificar_medicao(med['medicao'], faixas)
                if faixa and faixa['status'] == 'Crítico':
                    pneus_criticos += 1
                if med['data_medicao'] < sete_dias_atras:
                    sem_medicoes_recentes = True

            if pneus_criticos > 0:
                statuses.append("Pneus com alto desgaste")
            
            if sem_medicoes_recentes and "Faltando medição" not in statuses:
                 statuses.append("Sem medições recentes")

            if not statuses:
                return "OK"
                
            return " | ".join(statuses)

        equip_df['status'] = equip_df.apply(analyze_status, axis=1)

        def get_ultima_inspecao(equip_nome):
            medicoes_equip = medicoes_df[medicoes_df['equipamento'] == equip_nome]
            if medicoes_equip.empty:
                return {}
            
            medicoes_equip.sort_values('data_medicao', ascending=False, na_position='last', inplace=True)
            ultima_inspecao_df = medicoes_equip.drop_duplicates('posicao_agregado')
            
            ultima_inspecao = {}
            for _, row in ultima_inspecao_df.iterrows():
                pos_num = row['posicao_agregado'][:2]
                medicao_val = row['medicao'] if pd.notna(row['medicao']) else None
                faixa_info = classificar_medicao(medicao_val, faixas)
                ultima_inspecao[pos_num] = { 'faixa_info': faixa_info }
            return ultima_inspecao

        equip_df['ultima_inspecao'] = equip_df['equipamento'].apply(get_ultima_inspecao)

        def get_pneus_agregados_count(equip_nome):
            return medicoes_df[medicoes_df['equipamento'] == equip_nome]['posicao_agregado'].nunique()
        
        equip_df['pneus_agregados'] = equip_df['equipamento'].apply(get_pneus_agregados_count)
        
        def get_ultima_medicao_data(equip_nome):
            data = medicoes_df[medicoes_df['equipamento'] == equip_nome]['data_medicao'].max()
            return data.strftime('%d/%m/%Y') if pd.notna(data) else 'Sem medições'
        
        equip_df['ultima_medicao'] = equip_df['equipamento'].apply(get_ultima_medicao_data)
        
        equip_df['configuracao'] = equip_df['configuracao'].apply(lambda x: json.loads(x) if pd.notna(x) else None)

        resultado_final = equip_df.groupby('nome_cc').apply(
            lambda x: x[['equipamento', 'tipo_obj', 'pneus_agregados', 'ultima_medicao', 'status', 'configuracao', 'ultima_inspecao']].to_dict('records')
        ).reset_index(name='equipamentos')
        
        resultado_final.rename(columns={'nome_cc': 'centro_custo'}, inplace=True)
        return jsonify(resultado_final.to_dict('records'))

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": "Ocorreu um erro interno no servidor.", "details": traceback.format_exc()}), 500
    finally:
        if conn:
            conn.close()

# --- ROTAS PARA GERENCIAMENTO DE POSIÇÕES ---

@bp.route('/posicoes', methods=['GET'])
def listar_posicoes():
    """Lista posições classificadas e pendentes."""
    conn = None
    try:
        conn = get_db_connection()
        
        classificadas_db = conn.execute("SELECT id, nome_posicao, classificacao FROM pneus_posicoes ORDER BY nome_posicao").fetchall()
        classificadas = [dict(row) for row in classificadas_db]

        todas_posicoes_db = conn.execute("SELECT DISTINCT posicao_agregado FROM controle_pneus WHERE posicao_agregado IS NOT NULL").fetchall()
        todas_posicoes = {row['posicao_agregado'] for row in todas_posicoes_db}
        
        posicoes_classificadas_set = {row['nome_posicao'] for row in classificadas}
        pendentes = sorted(list(todas_posicoes - posicoes_classificadas_set))

        return jsonify({
            "classificadas": classificadas,
            "pendentes": pendentes
        })

    except Exception as e:
        return jsonify({"error": str(e), "details": traceback.format_exc()}), 500
    finally:
        if conn:
            conn.close()

@bp.route('/posicoes', methods=['POST'])
def adicionar_posicao():
    dados = request.get_json()
    if not dados or 'nome_posicao' not in dados or 'classificacao' not in dados:
        return jsonify({"error": "Dados incompletos"}), 400

    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO pneus_posicoes (nome_posicao, classificacao) VALUES (?, ?)",
            (dados['nome_posicao'], dados['classificacao'])
        )
        conn.commit()
        return jsonify({"id": cursor.lastrowid, **dados}), 201
    except Exception as e:
        return jsonify({"error": str(e), "details": traceback.format_exc()}), 500
    finally:
        if conn:
            conn.close()

@bp.route('/posicoes/<int:posicao_id>', methods=['PUT'])
def atualizar_posicao(posicao_id):
    dados = request.get_json()
    if not dados or 'classificacao' not in dados:
        return jsonify({"error": "Dados incompletos"}), 400

    conn = None
    try:
        conn = get_db_connection()
        conn.execute(
            "UPDATE pneus_posicoes SET classificacao = ? WHERE id = ?",
            (dados['classificacao'], posicao_id)
        )
        conn.commit()
        return jsonify({"message": "Classificação atualizada com sucesso."})
    except Exception as e:
        return jsonify({"error": str(e), "details": traceback.format_exc()}), 500
    finally:
        if conn:
            conn.close()

@bp.route('/posicoes/<int:posicao_id>', methods=['DELETE'])
def deletar_posicao(posicao_id):
    conn = None
    try:
        conn = get_db_connection()
        conn.execute("DELETE FROM pneus_posicoes WHERE id = ?", (posicao_id,))
        conn.commit()
        return jsonify({"message": "Classificação deletada com sucesso."})
    except Exception as e:
        return jsonify({"error": str(e), "details": traceback.format_exc()}), 500
    finally:
        if conn:
            conn.close()
            
# NOVO: ROTA PARA ANÁLISE DE ESTADOS DE PNEUS
@bp.route('/analise-estados', methods=['GET'])
def get_analise_estados():
    conn = None
    try:
        conn = get_db_connection()
        faixas = get_faixas_pneus(conn)
        
        # Query principal para buscar as últimas medições de cada pneu
        query = """
            WITH UltimaMedicao AS (
                SELECT
                    cp.num_fogo,
                    cp.equipamento,
                    pp.classificacao,
                    MAX(cp.data_medicao) as ultima_data
                FROM controle_pneus cp
                JOIN pneus_posicoes pp ON cp.posicao_agregado = pp.nome_posicao
                WHERE cp.num_fogo IS NOT NULL AND cp.medicao IS NOT NULL
                GROUP BY cp.num_fogo, cp.equipamento, pp.classificacao
            )
            SELECT
                um.num_fogo,
                um.equipamento,
                um.classificacao,
                cp.medicao,
                cp.posicao_agregado
            FROM UltimaMedicao um
            JOIN controle_pneus cp ON um.num_fogo = cp.num_fogo AND um.ultima_data = cp.data_medicao
        """
        df = pd.read_sql_query(query, conn)

        if df.empty:
            return jsonify({"graficos": [], "tabela_detalhes": []})

        # Classifica cada medição
        def get_faixa_info(medicao):
            return classificar_medicao(medicao, faixas)

        df['faixa_info'] = df['medicao'].apply(get_faixa_info)
        df.dropna(subset=['faixa_info'], inplace=True) # Remove pneus sem faixa correspondente

        # Prepara dados para os gráficos
        df['faixa'] = df['faixa_info'].apply(lambda x: x['nome_faixa'])
        df['cor'] = df['faixa_info'].apply(lambda x: x['cor'])
        
        contagem_faixas = df.groupby(['classificacao', 'faixa', 'cor']).size().reset_index(name='total_pneus')
        
        graficos_data = []
        for classificacao, group in contagem_faixas.groupby('classificacao'):
            dados_grafico = group[['faixa', 'total_pneus', 'cor']].to_dict('records')
            # Ordena as faixas pela ordem de valor_inicio para o gráfico
            faixas_ordenadas = sorted(faixas, key=lambda x: x['valor_inicio'])
            nomes_faixas_ordenados = [f['nome_faixa'] for f in faixas_ordenadas]
            dados_grafico.sort(key=lambda x: nomes_faixas_ordenados.index(x['faixa']) if x['faixa'] in nomes_faixas_ordenados else -1)
            
            graficos_data.append({
                "grupo_classificacao": classificacao,
                "dados": dados_grafico
            })

        # Prepara dados para a tabela de detalhes
        tabela_detalhes = df[['equipamento', 'num_fogo', 'posicao_agregado', 'classificacao', 'medicao', 'faixa']].to_dict('records')

        return jsonify({
            "graficos": graficos_data,
            "tabela_detalhes": tabela_detalhes
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e), "details": traceback.format_exc()}), 500
    finally:
        if conn:
            conn.close()

# --- ROTA PARA HISTÓRICO DE MEDIÇÕES ---

@bp.route('/historico-medicoes', methods=['GET'])
def get_historico_medicoes():
    conn = None
    try:
        conn = get_db_connection()
        # CORREÇÃO: Adicionada a coluna 'mes' para ordenação
        query = """
            SELECT 
                cp.equipamento, 
                cp.num_fogo, 
                c.ano, 
                c.mes,
                c.mesext, 
                c.semanames, 
                COUNT(cp.medicao) as contagem
            FROM controle_pneus cp
            JOIN calendario c ON DATE(cp.data_medicao) = c.data
            WHERE cp.num_fogo IS NOT NULL AND cp.data_medicao IS NOT NULL
            GROUP BY cp.equipamento, cp.num_fogo, c.ano, c.mes, c.mesext, c.semanames
            ORDER BY cp.equipamento, cp.num_fogo
        """
        df = pd.read_sql_query(query, conn)
        
        if df.empty: return jsonify({"meses": [], "dados": []})

        pivot_df = df.pivot_table(
            index=['equipamento', 'num_fogo'],
            columns=['ano', 'mesext', 'semanames'],
            values='contagem',
            fill_value=0
        )

        dados_finais = []
        for idx, row in pivot_df.iterrows():
            equipamento, num_fogo = idx
            medicoes = {}
            for (ano, mes, semana), contagem in row.items():
                chave = f"{mes}-{semana}"
                medicoes[chave] = int(contagem)
            
            dados_finais.append({
                "equipamento": str(equipamento),
                "num_fogo": str(num_fogo),
                "medicoes": medicoes
            })
            
        # CORREÇÃO: Lógica de ordenação do cabeçalho
        # 1. Agrupa para obter a informação de cada mês e o número de semanas
        header_info = df.groupby(['ano', 'mes', 'mesext'])['semanames'].nunique().reset_index()
        # 2. Ordena cronologicamente por ano e depois pelo número do mês
        header_info.sort_values(by=['ano', 'mes'], inplace=True)

        meses_header = []
        # Usa drop_duplicates para garantir que cada mês apareça apenas uma vez, mantendo a ordem
        for _, row in header_info.drop_duplicates(subset=['mesext'], keep='first').iterrows():
            meses_header.append({ "mes": row['mesext'], "num_semanas": int(row['semanames']) })

        return jsonify({ "meses": meses_header, "dados": dados_finais })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e), "details": traceback.format_exc()}), 500
    finally:
        if conn:
            conn.close()

