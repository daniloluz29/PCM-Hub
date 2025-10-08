from flask import Blueprint, jsonify, request
from ..db import get_db_connection
import pandas as pd
import numpy as np
import re
from datetime import datetime

bp = Blueprint('preventivas', __name__, url_prefix='/api')

# --- Funções e Definições Auxiliares ---

def get_mes_num(mes_abreviado):
    """Mapeia nomes de meses abreviados para números."""
    meses = {"Jan": 1, "Fev": 2, "Mar": 3, "Abr": 4, "Mai": 5, "Jun": 6, 
             "Jul": 7, "Ago": 8, "Set": 9, "Out": 10, "Nov": 11, "Dez": 12}
    return meses.get(mes_abreviado)

@bp.route('/preventivas/opcoes-filtro', methods=['GET'])
def get_filtro_opcoes():
    conn = None
    try:
        conn = get_db_connection()
        classificacoes_db = conn.execute("SELECT DISTINCT classificacao FROM preventivas WHERE classificacao IS NOT NULL AND classificacao != '' ORDER BY classificacao").fetchall()
        classificacoes_formatadas = [row['classificacao'].capitalize() for row in classificacoes_db]
        
        def sort_key(item):
            numbers = re.findall(r'\d+', item)
            return (0, int(numbers[0]), item) if numbers else (1, 0, item)

        classificacoes_unicas = sorted(list(set(classificacoes_formatadas)), key=sort_key)
        
        return jsonify({ "classificacoes": classificacoes_unicas })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

def build_query_and_params(args, conn, initial_where_clause, date_column_name=None):
    """Constrói a cláusula WHERE e os parâmetros com base nos argumentos da requisição."""
    where_clauses = [initial_where_clause]
    params = []
    
    user_contracts_ids_str = args.get('user_contracts')
    if user_contracts_ids_str is not None:
        user_contracts_ids = user_contracts_ids_str.split(',') if user_contracts_ids_str else []
        if not user_contracts_ids: return None, None
        
        placeholders = ','.join('?' for _ in user_contracts_ids)
        cod_cc_rows = conn.execute(f"SELECT cod_cc FROM centros_custo WHERE id IN ({placeholders})", user_contracts_ids).fetchall()
        user_contracts_cod_cc_list = [row['cod_cc'] for row in cod_cc_rows]
        
        if not user_contracts_cod_cc_list: return None, None

        user_contracts_tuple = tuple(user_contracts_cod_cc_list)
        where_clauses.append(f"contrato.cod_cc IN ({','.join('?' for _ in user_contracts_tuple)})")
        params.extend(user_contracts_tuple)

    # Lida com filtros GLOBAIS (que vêm com CÓDIGOS)
    cod_ccs_filtrados = []
    if args.get('contratos'):
        cod_ccs_filtrados.extend(args.get('contratos').split(','))
    elif args.get('nucleos'):
        nucleos = tuple(args.get('nucleos').split(','))
        contratos_de_nucleos = conn.execute(f"SELECT cod_cc FROM centros_custo WHERE pai_id IN ({','.join('?' for _ in nucleos)})", nucleos).fetchall()
        cod_ccs_filtrados.extend([row['cod_cc'] for row in contratos_de_nucleos])
    elif args.get('superintendencias'):
        supers = tuple(args.get('superintendencias').split(','))
        nucleos_de_supers = conn.execute(f"SELECT cod_cc FROM centros_custo WHERE pai_id IN ({','.join('?' for _ in supers)})", supers).fetchall()
        if nucleos_de_supers:
            nucleos_ids = tuple([row['cod_cc'] for row in nucleos_de_supers])
            contratos_de_supers = conn.execute(f"SELECT cod_cc FROM centros_custo WHERE pai_id IN ({','.join('?' for _ in nucleos_ids)})", nucleos_ids).fetchall()
            cod_ccs_filtrados.extend([row['cod_cc'] for row in contratos_de_supers])

    if cod_ccs_filtrados:
        where_clauses.append(f"contrato.cod_cc IN ({','.join('?' for _ in cod_ccs_filtrados)})")
        params.extend(cod_ccs_filtrados)

    # CORREÇÃO: Lida com filtros de DRILL-DOWN (que vêm com NOMES)
    if args.get('contrato_nome'):
        values = tuple(args.get('contrato_nome').split(','))
        where_clauses.append(f"contrato.nome_cc IN ({','.join('?' for _ in values)})")
        params.extend(values)
    if args.get('nucleo_nome'):
        values = tuple(args.get('nucleo_nome').split(','))
        where_clauses.append(f"nucleo.nome_cc IN ({','.join('?' for _ in values)})")
        params.extend(values)
    if args.get('super_nome'):
        values = tuple(args.get('super_nome').split(','))
        where_clauses.append(f"super.nome_cc IN ({','.join('?' for _ in values)})")
        params.extend(values)


    for arg_name, col_name in [('estados', 'estado'), ('controladores', 'controlador'), ('gestores', 'gestor')]:
        if args.get(arg_name):
            values = tuple(args.get(arg_name).split(','))
            where_clauses.append(f"contrato.{col_name} IN ({','.join('?' for _ in values)})")
            params.extend(values)

    if args.get('exibicao', 'ativos') == 'ativos':
        where_clauses.append("contrato.status = 1")
    
    data_inicio = args.get('data_inicio')
    data_fim = args.get('data_fim')
    if data_inicio and data_fim and date_column_name:
        if date_column_name == 'datavencimento':
            where_clauses.append(f"DATE(p.datavencimento) BETWEEN ? AND ?")
        else: 
            where_clauses.append(f"DATE(p.{date_column_name}) BETWEEN ? AND ?")
        params.extend([data_inicio, data_fim])

    tipos = args.get('tipos')
    if tipos:
        tipos_list = tuple(tipos.split(','))
        where_clauses.append(f"p.tipo IN ({','.join('?' for _ in tipos_list)})")
        params.extend(tipos_list)

    classificacoes = args.get('classificacoes')
    if classificacoes:
        classificacoes_list = tuple(c.upper() for c in classificacoes.split(',')) 
        where_clauses.append(f"p.classificacao IN ({','.join('?' for _ in classificacoes_list)})")
        params.extend(classificacoes_list)

    return " AND ".join(where_clauses), params


@bp.route('/preventivas/realizadas', methods=['GET'])
def get_preventivas_realizadas_data():
    conn = None
    try:
        conn = get_db_connection()
        args = request.args
        visao = args.get('visao', 'Contrato')
        mes_ano_filter = args.get('mes_ano')
        
        where_string, params = build_query_and_params(args, conn, "p.datatermino IS NOT NULL AND p.datatermino != ''", date_column_name='datatermino')
        if where_string is None:
            return jsonify({'aderencia_por_grupo': []})

        join_calendario = "JOIN calendario cal ON DATE(p.datatermino) = cal.data" if mes_ano_filter else ""
        
        if mes_ano_filter:
            mes_ano_list = mes_ano_filter.split(',')
            mes_ano_conditions = []
            for item in mes_ano_list:
                mes_str, ano_str = item.split('/')
                ano_completo = f"20{ano_str}"
                mes_num = get_mes_num(mes_str)
                if mes_num:
                    mes_ano_conditions.append("(cal.mes = ? AND cal.ano = ?)")
                    params.extend([mes_num, ano_completo])
            if mes_ano_conditions:
                where_string += f" AND ({ ' OR '.join(mes_ano_conditions) })"
        
        base_query = f"""
            SELECT
                p.datatermino, p.datavencimento, p.hor_termino, p.hor_vencimento, p.tipo,
                contrato.nome_cc, nucleo.nome_cc as nome_nucleo, super.nome_cc as nome_superintendencia
            FROM preventivas p
            LEFT JOIN centros_custo contrato ON p.cod_cc = contrato.cod_cc
            LEFT JOIN centros_custo nucleo ON contrato.pai_id = nucleo.cod_cc
            LEFT JOIN centros_custo super ON nucleo.pai_id = super.cod_cc
            {join_calendario}
            WHERE {where_string}
        """
        
        df = pd.read_sql_query(base_query, conn, params=params)
        
        if df.empty: return jsonify({'aderencia_por_grupo': []})

        df['datatermino_dt'] = pd.to_datetime(df['datatermino'], errors='coerce')
        df['datavencimento_dt'] = pd.to_datetime(df['datavencimento'], dayfirst=True, errors='coerce')

        df['atrasada'] = df.apply(
            lambda row: 1 if (
                'tempo' in str(row['tipo']).lower() and pd.notna(row['datatermino_dt']) and pd.notna(row['datavencimento_dt']) and row['datatermino_dt'] > row['datavencimento_dt']
            ) or (
                'marco' in str(row['tipo']).lower() and pd.notna(row['hor_termino']) and pd.notna(row['hor_vencimento']) and row['hor_termino'] > row['hor_vencimento']
            ) else 0,
            axis=1
        )

        if visao.lower() == 'núcleo': grouping_col_name = "nome_nucleo"
        elif visao.lower() == 'superintendência': grouping_col_name = "nome_superintendencia"
        else: grouping_col_name = "nome_cc"

        df.dropna(subset=[grouping_col_name], inplace=True)
        if df.empty: return jsonify({'aderencia_por_grupo': []})

        aderencia_grupo = df.groupby(grouping_col_name).agg(
            total_realizadas=('atrasada', 'size'),
            total_atrasadas=('atrasada', 'sum')
        ).reset_index()

        aderencia_grupo['aderencia'] = aderencia_grupo.apply(
            lambda row: round(((row['total_realizadas'] - row['total_atrasadas']) / row['total_realizadas'] * 100), 1) if row['total_realizadas'] > 0 else 100,
            axis=1
        )
        
        aderencia_grupo.sort_values(by='aderencia', ascending=False, inplace=True)
        aderencia_grupo.rename(columns={grouping_col_name: 'nome_grupo'}, inplace=True)
        
        return jsonify({'aderencia_por_grupo': aderencia_grupo.to_dict('records')})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@bp.route('/preventivas/aderencia-mensal', methods=['GET'])
def get_aderencia_mensal_data():
    conn = None
    try:
        conn = get_db_connection()
        args = request.args
        
        where_string, params = build_query_and_params(args, conn, "p.datatermino IS NOT NULL AND p.datatermino != ''", date_column_name='datatermino')
        if where_string is None:
            return jsonify({'aderencia_mensal': []})

        visao_map = {'contrato': 'contrato.nome_cc', 'núcleo': 'nucleo.nome_cc', 'superintendência': 'super.nome_cc'}
        for visao_key, db_col in visao_map.items():
            if args.get(visao_key):
                valores = tuple(args.get(visao_key).split(','))
                where_string += f" AND {db_col} IN ({','.join('?' for _ in valores)})"
                params.extend(valores)

        query = f"""
            SELECT
                p.datatermino, p.datavencimento, p.hor_termino, p.hor_vencimento, p.tipo
            FROM preventivas p
            LEFT JOIN centros_custo contrato ON p.cod_cc = contrato.cod_cc
            LEFT JOIN centros_custo nucleo ON contrato.pai_id = nucleo.cod_cc
            LEFT JOIN centros_custo super ON nucleo.pai_id = super.cod_cc
            WHERE {where_string}
        """
        
        df = pd.read_sql_query(query, conn, params=params)
        
        if df.empty: return jsonify({'aderencia_mensal': []})

        df['datatermino_dt'] = pd.to_datetime(df['datatermino'], errors='coerce')
        df['datavencimento_dt'] = pd.to_datetime(df['datavencimento'], dayfirst=True, errors='coerce')

        df.dropna(subset=['datatermino_dt'], inplace=True)
        if df.empty: return jsonify({'aderencia_mensal': []})

        df['atrasada'] = df.apply(
            lambda row: 1 if (
                'tempo' in str(row['tipo']).lower() and pd.notna(row['datatermino_dt']) and pd.notna(row['datavencimento_dt']) and row['datatermino_dt'] > row['datavencimento_dt']
            ) or (
                'marco' in str(row['tipo']).lower() and pd.notna(row['hor_termino']) and pd.notna(row['hor_vencimento']) and row['hor_termino'] > row['hor_vencimento']
            ) else 0,
            axis=1
        )
        
        df['ano'] = df['datatermino_dt'].dt.year
        df['mes'] = df['datatermino_dt'].dt.month
        
        df_grouped = df.groupby(['ano', 'mes']).agg(
            total_realizadas=('atrasada', 'size'),
            total_atrasadas=('atrasada', 'sum')
        ).reset_index()

        df_grouped['aderencia'] = round(
            (df_grouped['total_realizadas'] - df_grouped['total_atrasadas']) / df_grouped['total_realizadas'] * 100, 1
        ) if not df_grouped.empty and df_grouped['total_realizadas'].iloc[0] > 0 else 100.0
        
        df_grouped.sort_values(['ano', 'mes'], inplace=True)
        
        meses_map = {1: "Jan", 2: "Fev", 3: "Mar", 4: "Abr", 5: "Mai", 6: "Jun", 
                     7: "Jul", 8: "Ago", 9: "Set", 10: "Out", 11: "Nov", 12: "Dez"}
        df_grouped['mesext'] = df_grouped['mes'].map(meses_map)
        
        df_grouped['name'] = df_grouped['mesext'] + '/' + df_grouped['ano'].astype(str).str.slice(2, 4)
        
        return jsonify({'aderencia_mensal': df_grouped[['name', 'aderencia', 'total_realizadas', 'total_atrasadas']].to_dict('records')})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@bp.route('/preventivas/kpis-grupo', methods=['GET'])
def get_kpis_por_grupo():
    conn = None
    try:
        conn = get_db_connection()
        args = request.args
        visao = args.get('visao', 'Contrato')
        mes_ano_filter = args.get('mes_ano')

        where_string, params = build_query_and_params(args, conn, "p.datatermino IS NOT NULL AND p.datatermino != ''", date_column_name='datatermino')
        if where_string is None:
            return jsonify({"atrasadas": [], "antecipadas": []})
        
        join_calendario = "JOIN calendario cal ON DATE(p.datatermino) = cal.data" if mes_ano_filter else ""
        
        if mes_ano_filter:
            mes_ano_list = mes_ano_filter.split(',')
            mes_ano_conditions = []
            for item in mes_ano_list:
                mes_str, ano_str = item.split('/')
                ano_completo = f"20{ano_str}"
                mes_num = get_mes_num(mes_str)
                if mes_num:
                    mes_ano_conditions.append("(cal.mes = ? AND cal.ano = ?)")
                    params.extend([mes_num, ano_completo])
            if mes_ano_conditions:
                where_string += f" AND ({ ' OR '.join(mes_ano_conditions) })"

        query = f"""
            SELECT
                p.datatermino, p.datavencimento, p.hor_termino, p.hor_vencimento, p.tipo,
                contrato.nome_cc, nucleo.nome_cc as nome_nucleo, super.nome_cc as nome_superintendencia
            FROM preventivas p
            LEFT JOIN centros_custo contrato ON p.cod_cc = contrato.cod_cc
            LEFT JOIN centros_custo nucleo ON contrato.pai_id = nucleo.cod_cc
            LEFT JOIN centros_custo super ON nucleo.pai_id = super.cod_cc
            {join_calendario}
            WHERE {where_string}
        """
        df = pd.read_sql_query(query, conn, params=params)

        if df.empty:
            return jsonify({"atrasadas": [], "antecipadas": []})
        
        df['datatermino_dt'] = pd.to_datetime(df['datatermino'], errors='coerce')
        df['datavencimento_dt'] = pd.to_datetime(df['datavencimento'], dayfirst=True, errors='coerce')

        df['atrasada'] = df.apply(
            lambda row: 1 if (
                'tempo' in str(row['tipo']).lower() and pd.notna(row['datatermino_dt']) and pd.notna(row['datavencimento_dt']) and row['datatermino_dt'] > row['datavencimento_dt']
            ) or (
                'marco' in str(row['tipo']).lower() and pd.notna(row['hor_termino']) and pd.notna(row['hor_vencimento']) and row['hor_termino'] > row['hor_vencimento']
            ) else 0,
            axis=1
        )
        df['antecipada'] = df.apply(
            lambda row: 1 if 'marco' in str(row['tipo']).lower() and pd.notna(row['hor_termino']) and pd.notna(row['hor_vencimento']) and (row['hor_vencimento'] - row['hor_termino']) > 90 else 0,
            axis=1
        )

        if visao.lower() == 'núcleo': grouping_col_name = "nome_nucleo"
        elif visao.lower() == 'superintendência': grouping_col_name = "nome_superintendencia"
        else: grouping_col_name = "nome_cc"

        df.dropna(subset=[grouping_col_name], inplace=True)
        if df.empty:
            return jsonify({"atrasadas": [], "antecipadas": []})

        df_grouped = df.groupby(grouping_col_name).agg(
            atrasadas_count=('atrasada', 'sum'),
            antecipadas_count=('antecipada', 'sum')
        ).reset_index()
        
        df_grouped.rename(columns={grouping_col_name: 'nome_grupo'}, inplace=True)

        atrasadas_df = df_grouped[df_grouped['atrasadas_count'] > 0].sort_values('atrasadas_count', ascending=False)
        antecipadas_df = df_grouped[df_grouped['antecipadas_count'] > 0].sort_values('antecipadas_count', ascending=False)

        return jsonify({
            "atrasadas": atrasadas_df.to_dict('records'),
            "antecipadas": antecipadas_df.to_dict('records')
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@bp.route('/preventivas/kpis-gerais', methods=['GET'])
def get_kpis_gerais():
    conn = None
    try:
        conn = get_db_connection()
        args = request.args
        
        where_string, params = build_query_and_params(args, conn, "p.datatermino IS NOT NULL AND p.datatermino != ''", date_column_name='datatermino')
        if where_string is None:
            return jsonify({})

        mes_ano_filter = args.get('mes_ano')
        join_calendario = "JOIN calendario cal ON DATE(p.datatermino) = cal.data" if mes_ano_filter else ""
        if mes_ano_filter:
            mes_ano_list = mes_ano_filter.split(',')
            mes_ano_conditions = []
            for item in mes_ano_list:
                mes_str, ano_str = item.split('/')
                ano_completo = f"20{ano_str}"
                mes_num = get_mes_num(mes_str)
                if mes_num:
                    mes_ano_conditions.append("(cal.mes = ? AND cal.ano = ?)")
                    params.extend([mes_num, ano_completo])
            if mes_ano_conditions:
                where_string += f" AND ({ ' OR '.join(mes_ano_conditions) })"
        
        visao_map = {'contrato': 'contrato.nome_cc', 'núcleo': 'nucleo.nome_cc', 'superintendência': 'super.nome_cc'}
        for visao_key, db_col in visao_map.items():
            if args.get(visao_key):
                valores = tuple(args.get(visao_key).split(','))
                where_string += f" AND {db_col} IN ({','.join('?' for _ in valores)})"
                params.extend(valores)

        base_query = f"""
            SELECT
                p.datatermino, p.datavencimento, p.hor_termino, p.hor_vencimento, p.tipo
            FROM preventivas p
            LEFT JOIN centros_custo contrato ON p.cod_cc = contrato.cod_cc
            LEFT JOIN centros_custo nucleo ON contrato.pai_id = nucleo.cod_cc
            LEFT JOIN centros_custo super ON nucleo.pai_id = super.cod_cc
            {join_calendario}
            WHERE {where_string}
        """
        
        df = pd.read_sql_query(base_query, conn, params=params)
        
        if df.empty:
            return jsonify({
                "aderencia_geral": 0, "total_geral_realizadas": 0, "total_geral_atrasadas": 0,
                "aderencia_media": 0, "total_atrasadas": 0, "total_antecipadas": 0
            })

        df['datatermino_dt'] = pd.to_datetime(df['datatermino'], errors='coerce')
        df['datavencimento_dt'] = pd.to_datetime(df['datavencimento'], dayfirst=True, errors='coerce')
        df.dropna(subset=['datatermino_dt'], inplace=True)

        df['atrasada'] = df.apply(
            lambda row: 1 if (
                'tempo' in str(row['tipo']).lower() and pd.notna(row['datatermino_dt']) and pd.notna(row['datavencimento_dt']) and row['datatermino_dt'] > row['datavencimento_dt']
            ) or (
                'marco' in str(row['tipo']).lower() and pd.notna(row['hor_termino']) and pd.notna(row['hor_vencimento']) and row['hor_termino'] > row['hor_vencimento']
            ) else 0,
            axis=1
        )
        df['antecipada'] = df.apply(
            lambda row: 1 if 'marco' in str(row['tipo']).lower() and pd.notna(row['hor_termino']) and pd.notna(row['hor_vencimento']) and (row['hor_vencimento'] - row['hor_termino']) > 90 else 0,
            axis=1
        )

        total_geral_realizadas = int(df.shape[0])
        total_geral_atrasadas = int(df['atrasada'].sum())
        aderencia_geral = round(((total_geral_realizadas - total_geral_atrasadas) / total_geral_realizadas * 100), 1) if total_geral_realizadas > 0 else 0

        df['ano'] = df['datatermino_dt'].dt.year
        df['mes'] = df['datatermino_dt'].dt.month
        df_grouped = df.groupby(['ano', 'mes']).agg(
            total_realizadas_mes=('atrasada', 'size'),
            total_atrasadas_mes=('atrasada', 'sum')
        ).reset_index()
        df_grouped['aderencia'] = round((df_grouped['total_realizadas_mes'] - df_grouped['total_atrasadas_mes']) / df_grouped['total_realizadas_mes'] * 100, 1) if not df_grouped.empty and df_grouped['total_realizadas_mes'].iloc[0] > 0 else 100.0
        aderencia_media = round(df_grouped['aderencia'].mean(), 1) if not df_grouped.empty else 0

        total_atrasadas = int(df['atrasada'].sum())
        total_antecipadas = int(df['antecipada'].sum())

        return jsonify({
            "aderencia_geral": aderencia_geral,
            "total_geral_realizadas": total_geral_realizadas,
            "total_geral_atrasadas": total_geral_atrasadas,
            "aderencia_media": aderencia_media,
            "total_atrasadas": total_atrasadas,
            "total_antecipadas": total_antecipadas
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()


@bp.route('/preventivas/pendentes-status', methods=['GET'])
def get_pendentes_status_data():
    conn = None
    try:
        conn = get_db_connection()
        args = request.args
        visao = args.get('visao', 'Contrato')
        
        where_string, params = build_query_and_params(args, conn, "(p.datatermino IS NULL OR p.datatermino = '')", date_column_name='datavencimento')
        if where_string is None:
            return jsonify({"em_atraso": [], "em_dia": []})

        query = f"""
            SELECT
                p.datavencimento, p.hor_atual, p.hor_vencimento, p.tipo,
                contrato.nome_cc, nucleo.nome_cc as nome_nucleo, super.nome_cc as nome_superintendencia
            FROM preventivas p
            LEFT JOIN centros_custo contrato ON p.cod_cc = contrato.cod_cc
            LEFT JOIN centros_custo nucleo ON contrato.pai_id = nucleo.cod_cc
            LEFT JOIN centros_custo super ON nucleo.pai_id = super.cod_cc
            WHERE {where_string}
        """
        
        df = pd.read_sql_query(query, conn, params=params)
        
        if df.empty:
            return jsonify({"em_atraso": [], "em_dia": []})

        df['datavencimento_dt'] = pd.to_datetime(df['datavencimento'], dayfirst=True, errors='coerce')
        data_atual = pd.to_datetime(datetime.now().date())

        df['status_pendente'] = df.apply(
            lambda row: 'Em Atraso' if (
                'tempo' in str(row['tipo']).lower() and pd.notna(row['datavencimento_dt']) and data_atual > row['datavencimento_dt']
            ) or (
                'marco' in str(row['tipo']).lower() and pd.notna(row['hor_atual']) and pd.notna(row['hor_vencimento']) and row['hor_atual'] > row['hor_vencimento']
            ) else 'Em Dia',
            axis=1
        )

        if visao.lower() == 'núcleo': grouping_col_name = "nome_nucleo"
        elif visao.lower() == 'superintendência': grouping_col_name = "nome_superintendencia"
        else: grouping_col_name = "nome_cc"
            
        df.dropna(subset=[grouping_col_name], inplace=True)
        if df.empty:
            return jsonify({"em_atraso": [], "em_dia": []})

        counts = df.groupby([grouping_col_name, 'status_pendente']).size().unstack(fill_value=0)
        
        if 'Em Atraso' not in counts.columns: counts['Em Atraso'] = 0
        if 'Em Dia' not in counts.columns: counts['Em Dia'] = 0
        
        counts.rename_axis('nome_grupo', inplace=True)
        
        em_atraso_df = counts[counts['Em Atraso'] > 0][['Em Atraso']].reset_index()
        em_atraso_df.rename(columns={'Em Atraso': 'count'}, inplace=True)
        em_atraso_df = em_atraso_df.sort_values('count', ascending=False)
        
        em_dia_df = counts[counts['Em Dia'] > 0][['Em Dia']].reset_index()
        em_dia_df.rename(columns={'Em Dia': 'count'}, inplace=True)
        em_dia_df = em_dia_df.sort_values('count', ascending=False)

        return jsonify({
            "em_atraso": em_atraso_df.to_dict('records'),
            "em_dia": em_dia_df.to_dict('records')
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@bp.route('/preventivas/kpis-pendentes', methods=['GET'])
def get_kpis_pendentes():
    conn = None
    try:
        conn = get_db_connection()
        args = request.args
        
        where_string, params = build_query_and_params(args, conn, "(p.datatermino IS NULL OR p.datatermino = '')", date_column_name='datavencimento')
        if where_string is None:
            return jsonify({"total_pendentes": 0, "total_em_atraso": 0, "total_em_dia": 0})

        query = f"""
            SELECT p.datavencimento, p.hor_atual, p.hor_vencimento, p.tipo
            FROM preventivas p
            LEFT JOIN centros_custo contrato ON p.cod_cc = contrato.cod_cc
            LEFT JOIN centros_custo nucleo ON contrato.pai_id = nucleo.cod_cc
            LEFT JOIN centros_custo super ON nucleo.pai_id = super.cod_cc
            WHERE {where_string}
        """
        df = pd.read_sql_query(query, conn, params=params)
        
        if df.empty:
            return jsonify({"total_pendentes": 0, "total_em_atraso": 0, "total_em_dia": 0})

        df['datavencimento_dt'] = pd.to_datetime(df['datavencimento'], dayfirst=True, errors='coerce')
        data_atual = pd.to_datetime(datetime.now().date())

        df['status_pendente'] = df.apply(
            lambda row: 'Em Atraso' if (
                'tempo' in str(row['tipo']).lower() and pd.notna(row['datavencimento_dt']) and data_atual > row['datavencimento_dt']
            ) or (
                'marco' in str(row['tipo']).lower() and pd.notna(row['hor_atual']) and pd.notna(row['hor_vencimento']) and row['hor_atual'] > row['hor_vencimento']
            ) else 'Em Dia',
            axis=1
        )
        
        total_pendentes = int(df.shape[0])
        total_em_atraso = int(df[df['status_pendente'] == 'Em Atraso'].shape[0])
        total_em_dia = int(df[df['status_pendente'] == 'Em Dia'].shape[0])

        return jsonify({
            "total_pendentes": total_pendentes,
            "total_em_atraso": total_em_atraso,
            "total_em_dia": total_em_dia
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()


@bp.route('/preventivas/pendentes-detalhes', methods=['GET'])
def get_pendentes_detalhes_data():
    conn = None
    try:
        conn = get_db_connection()
        args = request.args
        
        where_string, params = build_query_and_params(args, conn, "(p.datatermino IS NULL OR p.datatermino = '')", date_column_name='datavencimento')
        if where_string is None:
            return jsonify([])

        where_string += " AND ((LOWER(p.tipo) LIKE '%tempo%' AND DATE('now', 'localtime') > DATE(p.datavencimento)) OR (LOWER(p.tipo) LIKE '%marco%' AND p.hor_atual > p.hor_vencimento))"

        query = f"""
            SELECT
                contrato.nome_cc AS "Centro de custo",
                p.equipamento AS "Equipamento",
                p.numos AS "Nº OS",
                p.sl_fluig AS "SL Fluig",
                CASE
                    WHEN p.datavencimento IS NOT NULL AND p.datavencimento != ''
                    THEN strftime('%d/%m/%Y', p.datavencimento)
                    ELSE NULL
                END AS "Data Vencimento",
                p.hor_vencimento AS "Horimetro Vencimento",
                p.hor_atual AS "Horimetro Atual"
            FROM preventivas p
            LEFT JOIN centros_custo contrato ON p.cod_cc = contrato.cod_cc
            LEFT JOIN centros_custo nucleo ON contrato.pai_id = nucleo.cod_cc
            LEFT JOIN centros_custo super ON nucleo.pai_id = super.cod_cc
            WHERE {where_string}
            ORDER BY DATE(p.datavencimento) ASC
        """
        
        detalhes = conn.execute(query, params).fetchall()
        return jsonify([dict(row) for row in detalhes])

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

@bp.route('/preventivas/pendentes-em-dia-detalhes', methods=['GET'])
def get_pendentes_em_dia_detalhes_data():
    conn = None
    try:
        conn = get_db_connection()
        args = request.args
        
        where_string, params = build_query_and_params(args, conn, "(p.datatermino IS NULL OR p.datatermino = '')", date_column_name='datavencimento')
        if where_string is None:
            return jsonify([])

        where_string += " AND NOT ((LOWER(p.tipo) LIKE '%tempo%' AND DATE('now', 'localtime') > DATE(p.datavencimento)) OR (LOWER(p.tipo) LIKE '%marco%' AND p.hor_atual > p.hor_vencimento))"

        query = f"""
            SELECT
                contrato.nome_cc AS "Centro de custo",
                p.equipamento AS "Equipamento",
                p.numos AS "Nº OS",
                p.sl_fluig AS "SL Fluig",
                CASE
                    WHEN p.datavencimento IS NOT NULL AND p.datavencimento != ''
                    THEN strftime('%d/%m/%Y', p.datavencimento)
                    ELSE NULL
                END AS "Data Vencimento",
                p.hor_vencimento AS "Horimetro Vencimento",
                p.hor_atual AS "Horimetro Atual"
            FROM preventivas p
            LEFT JOIN centros_custo contrato ON p.cod_cc = contrato.cod_cc
            LEFT JOIN centros_custo nucleo ON contrato.pai_id = nucleo.cod_cc
            LEFT JOIN centros_custo super ON nucleo.pai_id = super.cod_cc
            WHERE {where_string}
            ORDER BY DATE(p.datavencimento) ASC
        """
        
        detalhes = conn.execute(query, params).fetchall()
        return jsonify([dict(row) for row in detalhes])

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()


@bp.route('/preventivas/realizadas-detalhes', methods=['GET'])
def get_realizadas_detalhes_data():
    conn = None
    try:
        conn = get_db_connection()
        args = request.args
        
        where_string, params = build_query_and_params(args, conn, "p.datatermino IS NOT NULL AND p.datatermino != ''", date_column_name='datatermino')
        if where_string is None:
            return jsonify([])

        visao_map = {'contrato': 'contrato.nome_cc', 'núcleo': 'nucleo.nome_cc', 'superintendência': 'super.nome_cc'}
        for visao_key, db_col in visao_map.items():
            if args.get(visao_key):
                valores = tuple(args.get(visao_key).split(','))
                where_string += f" AND {db_col} IN ({','.join('?' for _ in valores)})"
                params.extend(valores)

        mes_ano_filter = args.get('mes_ano')
        join_calendario = "JOIN calendario cal ON DATE(p.datatermino) = cal.data" if mes_ano_filter else ""
        if mes_ano_filter:
            mes_ano_list = mes_ano_filter.split(',')
            mes_ano_conditions = []
            for item in mes_ano_list:
                mes_str, ano_str = item.split('/')
                ano_completo = f"20{ano_str}"
                mes_num = get_mes_num(mes_str)
                if mes_num:
                    mes_ano_conditions.append("(cal.mes = ? AND cal.ano = ?)")
                    params.extend([mes_num, ano_completo])
            if mes_ano_conditions:
                where_string += f" AND ({ ' OR '.join(mes_ano_conditions) })"

        status_filter = args.get('status_filter')
        if status_filter:
            if status_filter == 'Atrasada':
                where_string += " AND ((LOWER(p.tipo) LIKE '%tempo%' AND DATE(p.datatermino) > DATE(p.datavencimento)) OR (LOWER(p.tipo) LIKE '%marco%' AND p.hor_termino > p.hor_vencimento))"
            elif status_filter == 'Antecipada':
                where_string += " AND (LOWER(p.tipo) LIKE '%marco%' AND p.hor_termino IS NOT NULL AND p.hor_vencimento IS NOT NULL AND (p.hor_vencimento - p.hor_termino) > 90)"


        query = f"""
            SELECT
                contrato.nome_cc AS "Centro de Custo",
                p.equipamento AS "Equipamento",
                strftime('%d/%m/%Y', p.datatermino) AS "Data",
                p.numos AS "Nº OS",
                p.sl_fluig AS "SL Fluig",
                CASE
                    WHEN LOWER(p.tipo) LIKE '%tempo%' THEN
                        CASE
                            WHEN p.datavencimento IS NOT NULL AND p.datavencimento != '' THEN strftime('%d/%m/%Y', p.datavencimento)
                            ELSE NULL
                        END
                    ELSE p.hor_vencimento
                END AS "Vencimento",
                CASE
                    WHEN LOWER(p.tipo) LIKE '%tempo%' THEN strftime('%d/%m/%Y', p.datatermino)
                    ELSE p.hor_termino
                END AS "Término",
                CASE
                    WHEN (LOWER(p.tipo) LIKE '%tempo%' AND DATE(p.datatermino) > DATE(p.datavencimento)) OR (LOWER(p.tipo) LIKE '%marco%' AND p.hor_termino > p.hor_vencimento) THEN 'Atrasada'
                    WHEN LOWER(p.tipo) LIKE '%marco%' AND p.hor_termino IS NOT NULL AND p.hor_vencimento IS NOT NULL AND (p.hor_vencimento - p.hor_termino) > 90 THEN 'Antecipada'
                    ELSE 'No Prazo'
                END AS "Status"
            FROM preventivas p
            LEFT JOIN centros_custo contrato ON p.cod_cc = contrato.cod_cc
            LEFT JOIN centros_custo nucleo ON contrato.pai_id = nucleo.cod_cc
            LEFT JOIN centros_custo super ON nucleo.pai_id = super.cod_cc
            {join_calendario}
            WHERE {where_string}
            ORDER BY DATE(p.datatermino) DESC
        """
        
        detalhes = conn.execute(query, params).fetchall()
        return jsonify([dict(row) for row in detalhes])

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if conn: conn.close()

