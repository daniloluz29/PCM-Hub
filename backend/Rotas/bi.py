# backend/Rotas/bi.py
from flask import Blueprint, jsonify, request
from ..db import get_db_connection
import sqlite3
import json
import traceback
from collections import deque # Import deque for a more efficient queue

bp = Blueprint('bi', __name__, url_prefix='/api/bi')

# --- Funções de Validação e Utilitários ---

def get_valid_tables_and_columns(conn):
    """Busca e retorna um dicionário com todas as tabelas e suas colunas válidas no banco."""
    tables_and_columns = {}
    tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    for table in tables:
        table_name = table['name']
        columns_info = conn.execute(f"PRAGMA table_info('{table_name}')").fetchall()
        tables_and_columns[table_name] = {col['name'] for col in columns_info}
    return tables_and_columns

# --- NOVA E MELHORADA FUNÇÃO find_join_path ---
def find_join_path(start_table, required_tables, relationships):
    """
    Encontra o caminho de JOINs mais curto para conectar a start_table a todas as outras required_tables.
    Usa um algoritmo de busca em largura (BFS) para explorar os relacionamentos.
    Retorna uma lista de cláusulas JOIN.
    """
    if not required_tables or start_table not in required_tables:
        print(f"Aviso: Tabela inicial '{start_table}' não está nas tabelas requeridas. Nenhuma junção será feita.")
        return []

    if len(required_tables) == 1:
        return []

    # 1. Construir o grafo de relacionamentos
    graph = {}
    for rel in relationships:
        t1, c1, t2, c2 = rel['tabela_origem'], rel['coluna_origem'], rel['tabela_destino'], rel['coluna_destino']
        if t1 not in graph: graph[t1] = []
        if t2 not in graph: graph[t2] = []
        graph[t1].append({'to': t2, 'on': f'"{t1}"."{c1}" = "{t2}"."{c2}"'})
        graph[t2].append({'to': t1, 'on': f'"{t2}"."{c2}" = "{t1}"."{c1}"'})

    # 2. Executar a busca para encontrar o caminho
    join_clauses = []
    connected_tables = {start_table}
    tables_to_reach = set(required_tables) - connected_tables

    q = deque([start_table])
    
    parent_map = {start_table: None}

    while q and tables_to_reach:
        current_table = q.popleft()

        if current_table not in graph:
            continue

        for edge in graph[current_table]:
            neighbor_table = edge['to']
            if neighbor_table not in parent_map: 
                parent_map[neighbor_table] = {'table': current_table, 'on': edge['on']}
                q.append(neighbor_table)
                
                if neighbor_table in tables_to_reach:
                    temp_path = []
                    path_tables = []
                    step = neighbor_table
                    
                    while step is not None and step not in connected_tables:
                        parent_info = parent_map[step]
                        if parent_info:
                             temp_path.insert(0, f'LEFT JOIN "{step}" ON {parent_info["on"]}')
                             path_tables.append(step)
                             step = parent_info['table']
                        else:
                             break
                    
                    join_clauses.extend(temp_path)
                    
                    for table_in_path in path_tables:
                        if table_in_path in tables_to_reach:
                           tables_to_reach.remove(table_in_path)
                        connected_tables.add(table_in_path)


    if tables_to_reach:
        print(f"Aviso: Não foi possível conectar todas as tabelas. Faltando: {tables_to_reach}")

    return join_clauses


# --- ROTAS DE DASHBOARDS ---
def ensure_dashboard_table_exists(conn):
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS bi_dashboards (
                id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, layout_json TEXT NOT NULL,
                filters_json TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, createuser TEXT, alteruser TEXT
            );
        ''')
        conn.execute('''
            CREATE TRIGGER IF NOT EXISTS update_bi_dashboards_updated_at
            AFTER UPDATE ON bi_dashboards FOR EACH ROW
            BEGIN
                UPDATE bi_dashboards SET updated_at = CURRENT_TIMESTAMP, alteruser = NEW.alteruser WHERE id = OLD.id;
            END;
        ''')
        conn.commit()
    except sqlite3.Error as e:
        print(f"Erro ao criar tabela/trigger de dashboards: {e}")

@bp.route('/dashboards', methods=['GET'])
def get_dashboards():
    conn = get_db_connection()
    try:
        ensure_dashboard_table_exists(conn)
        dashboards = conn.execute("SELECT id, name, createuser, created_at, alteruser, updated_at FROM bi_dashboards ORDER BY name ASC").fetchall()
        return jsonify([dict(row) for row in dashboards])
    finally: conn.close()

@bp.route('/dashboards/<int:dashboard_id>', methods=['GET'])
def get_dashboard_by_id(dashboard_id):
    conn = get_db_connection()
    try:
        ensure_dashboard_table_exists(conn)
        dashboard = conn.execute("SELECT * FROM bi_dashboards WHERE id = ?", (dashboard_id,)).fetchone()
        if dashboard is None: return jsonify({"message": "Dashboard não encontrado."}), 404
        dashboard_dict = dict(dashboard)
        dashboard_dict['layout'] = json.loads(dashboard_dict.pop('layout_json', '{"title": "", "rows": []}'))
        dashboard_dict['pageFilters'] = json.loads(dashboard_dict.pop('filters_json', '[]'))
        return jsonify(dashboard_dict)
    except (sqlite3.Error, json.JSONDecodeError) as e:
        return jsonify({"message": f"Erro ao buscar ou processar o dashboard: {e}"}), 500
    finally:
        conn.close()

@bp.route('/dashboards', methods=['POST'])
def create_dashboard():
    data = request.get_json()
    name = data.get('name')
    user = data.get('user', 'desconhecido')
    layout = data.get('layout')
    page_filters = data.get('pageFilters')

    if not name: return jsonify({"message": "O nome do dashboard é obrigatório."}), 400
    
    conn = get_db_connection()
    try:
        ensure_dashboard_table_exists(conn)
        
        existing = conn.execute("SELECT id FROM bi_dashboards WHERE name = ?", (name,)).fetchone()
        if existing:
            return jsonify({"message": f"Já existe um dashboard com o nome '{name}'."}), 409

        layout_to_save = layout if layout is not None else {"title": name, "rows": []}
        filters_to_save = page_filters if page_filters is not None else []
        
        layout_json = json.dumps(layout_to_save)
        filters_json = json.dumps(filters_to_save)

        cursor = conn.cursor()
        cursor.execute("INSERT INTO bi_dashboards (name, layout_json, filters_json, createuser) VALUES (?, ?, ?, ?)", (name, layout_json, filters_json, user))
        new_id = cursor.lastrowid
        conn.commit()
        
        return jsonify({
            "id": new_id, 
            "name": name, 
            "layout": layout_to_save, 
            "pageFilters": filters_to_save
        }), 201

    except sqlite3.IntegrityError:
         return jsonify({"message": f"Já existe um dashboard com o nome '{name}'."}), 409
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/dashboards/<int:dashboard_id>', methods=['PUT'])
def update_dashboard(dashboard_id):
    data = request.get_json()
    layout = data.get('layout')
    page_filters = data.get('pageFilters')
    user = data.get('user', 'desconhecido')
    name = data.get('name')

    if layout is None and page_filters is None and name is None:
        return jsonify({"message": "Pelo menos um campo (layout, pageFilters, name) é obrigatório para atualização."}), 400

    conn = get_db_connection()
    try:
        updates = []
        params = []
        
        if name is not None:
            if not name.strip():
                return jsonify({"message": "O nome do dashboard não pode ser vazio."}), 400
            existing = conn.execute("SELECT id FROM bi_dashboards WHERE name = ? AND id != ?", (name, dashboard_id)).fetchone()
            if existing:
                return jsonify({"message": f"Já existe um dashboard com o nome '{name}'."}), 409
            updates.append("name = ?")
            params.append(name)

        if layout is not None:
            updates.append("layout_json = ?")
            params.append(json.dumps(layout))
        
        if page_filters is not None:
            updates.append("filters_json = ?")
            params.append(json.dumps(page_filters))

        if not updates:
            return jsonify({"message": "Nenhuma alteração detectada."}), 200

        updates.append("alteruser = ?")
        params.append(user)
        params.append(dashboard_id)

        query = f"UPDATE bi_dashboards SET {', '.join(updates)} WHERE id = ?"
        
        cursor = conn.cursor()
        cursor.execute(query, tuple(params))
        
        if cursor.rowcount == 0:
            return jsonify({"message": "Dashboard não encontrado."}), 404
            
        conn.commit()
        return jsonify({"message": "Dashboard atualizado com sucesso!"})

    except (sqlite3.Error, TypeError) as e:
        conn.rollback()
        return jsonify({"message": f"Erro ao atualizar dashboard: {e}"}), 500
    finally:
        conn.close()

@bp.route('/dashboards/<int:dashboard_id>', methods=['DELETE'])
def delete_dashboard(dashboard_id):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM bi_dashboards WHERE id = ?", (dashboard_id,))
        if cursor.rowcount == 0: return jsonify({"message": "Dashboard não encontrado."}), 404
        conn.commit()
        return jsonify({"message": "Dashboard deletado com sucesso!"})
    except sqlite3.Error as e:
        conn.rollback(); return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/dashboards/<int:dashboard_id>/copy', methods=['POST'])
def copy_dashboard(dashboard_id):
    data = request.get_json()
    new_name = data.get('name')
    user = data.get('user', 'desconhecido')
    if not new_name: return jsonify({"message": "O novo nome para a cópia é obrigatório."}), 400
    conn = get_db_connection()
    try:
        existing = conn.execute("SELECT id FROM bi_dashboards WHERE name = ?", (new_name,)).fetchone()
        if existing:
            return jsonify({"message": f"Já existe um dashboard com o nome '{new_name}'."}), 409

        original = conn.execute("SELECT layout_json, filters_json FROM bi_dashboards WHERE id = ?", (dashboard_id,)).fetchone()
        if original is None: return jsonify({"message": "Dashboard original não encontrado."}), 404
        
        cursor = conn.cursor()
        cursor.execute("INSERT INTO bi_dashboards (name, layout_json, filters_json, createuser) VALUES (?, ?, ?, ?)", (new_name, original['layout_json'], original['filters_json'], user))
        new_id = cursor.lastrowid
        conn.commit()
        
        new_dashboard = conn.execute("SELECT * FROM bi_dashboards WHERE id = ?", (new_id,)).fetchone()
        return jsonify(dict(new_dashboard)), 201
    except sqlite3.Error as e:
        conn.rollback(); return jsonify({"message": f"Erro no banco de dados ao copiar: {e}"}), 500
    finally:
        conn.close()

# --- ROTAS DE TABELAS E RELACIONAMENTOS ---
@bp.route('/tables', methods=['GET'])
def get_bi_tables():
    conn = get_db_connection()
    try:
        try:
            conn.execute('ALTER TABLE bi_tables ADD COLUMN coord_relat TEXT;')
            conn.commit()
        except sqlite3.OperationalError: pass 
        tables = conn.execute("SELECT id, tabela, coord_relat FROM bi_tables ORDER BY tabela ASC").fetchall()
        tables_to_return = []
        for row in tables:
            coords = json.loads(row['coord_relat']) if row['coord_relat'] else None
            tables_to_return.append({'key': row['id'], 'name': row['tabela'], 'displayName': row['tabela'], 'coords': coords})
        return jsonify(tables_to_return)
    finally: conn.close()

@bp.route('/tables/positions', methods=['POST'])
def save_table_positions():
    data = request.get_json()
    positions = data.get('positions', {})
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        for table_name, coords in positions.items():
            conn.execute("UPDATE bi_tables SET coord_relat = ? WHERE tabela = ?", (json.dumps(coords), table_name))
        conn.commit()
        return jsonify({"message": "Posições salvas com sucesso!"}), 200
    except sqlite3.Error as e:
        conn.rollback(); return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally: conn.close()

@bp.route('/tables', methods=['POST'])
def update_bi_tables():
    data = request.get_json()
    tabelas = data.get('tabelas', [])
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        conn.execute('DELETE FROM bi_tables')
        if tabelas: conn.executemany("INSERT INTO bi_tables (tabela) VALUES (?)", [(t['name'],) for t in tabelas])
        conn.commit()
        return jsonify({"message": "Modelo de dados do BI atualizado com sucesso!"}), 200
    except sqlite3.Error as e:
        conn.rollback(); return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally: conn.close()

@bp.route('/table-schema/<string:table_name>', methods=['GET'])
def get_table_schema(table_name):
    conn = get_db_connection()
    try:
        valid_tables = get_valid_tables_and_columns(conn)
        if table_name not in valid_tables:
            return jsonify({"message": f"Tabela '{table_name}' não encontrada ou inválida."}), 404
        
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info('{table_name}')")
        columns = [{'name': row['name'], 'type': row['type']} for row in cursor.fetchall()]
        return jsonify({"columns": columns})
    finally: conn.close()

@bp.route('/column-distinct-values/<string:table_name>/<string:column_name>', methods=['GET'])
def get_column_distinct_values(table_name, column_name):
    search_term = request.args.get('search', None)
    conn = get_db_connection()
    try:
        valid_tables_and_columns = get_valid_tables_and_columns(conn)
        if table_name not in valid_tables_and_columns or column_name not in valid_tables_and_columns[table_name]:
            return jsonify({"message": "Nome de tabela ou coluna inválido."}), 400

        params = []
        where_clause = ""
        if search_term:
            where_clause = f'WHERE "{column_name}" LIKE ?'
            params.append(f"%{search_term}%")

        query = f'SELECT DISTINCT "{column_name}" FROM "{table_name}" {where_clause} ORDER BY 1 ASC LIMIT 200'
        
        values = [row[0] for row in conn.execute(query, params).fetchall()]
        return jsonify({"values": values})
    except sqlite3.Error as e:
        return jsonify({"message": f"Erro de banco de dados: {e}"}), 500
    finally:
        conn.close()

@bp.route('/relationships', methods=['GET'])
def get_relationships():
    conn = get_db_connection()
    try:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS bi_relacionamentos (
              id INTEGER PRIMARY KEY AUTOINCREMENT, tabela_origem TEXT NOT NULL, coluna_origem TEXT NOT NULL,
              tabela_destino TEXT NOT NULL, coluna_destino TEXT NOT NULL
            );
        ''')
        relationships = conn.execute("SELECT * FROM bi_relacionamentos").fetchall()
        rels_to_return = [{"id": r['id'], "fromTable": r['tabela_origem'], "fromColumn": r['coluna_origem'], "toTable": r['tabela_destino'], "toColumn": r['coluna_destino']} for r in relationships]
        return jsonify(rels_to_return)
    finally: conn.close()

@bp.route('/relationships', methods=['POST'])
def save_relationships():
    data = request.get_json()
    rels = data.get('relationships', [])
    conn = get_db_connection()
    try:
        conn.execute('BEGIN')
        conn.execute('DELETE FROM bi_relacionamentos')
        if rels:
            rows = [(r['fromTable'], r['fromColumn'], r['toTable'], r['toColumn']) for r in rels]
            conn.executemany("INSERT INTO bi_relacionamentos (tabela_origem, coluna_origem, tabela_destino, coluna_destino) VALUES (?, ?, ?, ?)", rows)
        conn.commit()
        return jsonify({"message": "Relacionamentos salvos com sucesso!"}), 200
    except sqlite3.Error as e:
        conn.rollback(); return jsonify({"message": f"Erro no banco de dados: {e}"}), 500
    finally: conn.close()

# --- ROTA DE DADOS DO VISUAL ---
def build_filter_clause(filters, params):
    if not filters: return "", []
    conditions = []
    for f in filters:
        if f.get('isAggregated'):
            agg_map = {'sum': 'SUM', 'average': 'AVG', 'count': 'COUNT', 'countd': 'COUNT(DISTINCT', 'min': 'MIN', 'max': 'MAX'}
            agg_func = agg_map.get(f.get('aggregation'), 'COUNT')
            col_ref = f'{agg_func}("{f["tableName"]}"."{f["originalColumn"]}"{")" if f.get("aggregation") == "countd" else ""})'
        else:
            col_ref = f'"{f["tableName"]}"."{f["columnName"]}"'
        
        cfg = f.get('filterConfig', {})

        if cfg.get('type') == 'basica' and cfg.get('selectedValues'):
            placeholders = ', '.join(['?'] * len(cfg['selectedValues']))
            conditions.append(f"{col_ref} IN ({placeholders})")
            params.extend(cfg['selectedValues'])
        elif cfg.get('type') == 'avancada' and cfg.get('advancedFilters'):
            for adv_filter in cfg['advancedFilters']:
                op, val = adv_filter.get('condition'), adv_filter.get('value')
                
                numeric_ops = ['>', '<', '>=', '<=', 'igual', 'diferente']
                if op in numeric_ops:
                    try:
                        val = float(val)
                    except (ValueError, TypeError):
                        pass

                if op == 'contem': conditions.append(f"{col_ref} LIKE ?"); params.append(f"%{val}%")
                elif op == 'nao_contem': conditions.append(f"({col_ref} NOT LIKE ? OR {col_ref} IS NULL)"); params.append(f"%{val}%")
                elif op == 'igual': conditions.append(f"{col_ref} = ?"); params.append(val)
                elif op == 'diferente': conditions.append(f"({col_ref} != ? OR {col_ref} IS NULL)"); params.append(val)
                elif op == 'nulo': conditions.append(f"{col_ref} IS NULL")
                elif op == 'nao_nulo': conditions.append(f"{col_ref} IS NOT NULL")
                elif op == '>': conditions.append(f"{col_ref} > ?"); params.append(val)
                elif op == '<': conditions.append(f"{col_ref} < ?"); params.append(val)
                elif op == '>=': conditions.append(f"{col_ref} >= ?"); params.append(val)
                elif op == '<=': conditions.append(f"{col_ref} <= ?"); params.append(val)
    return " AND ".join(conditions), params

@bp.route('/visual-data', methods=['POST'])
def get_visual_data():
    config = request.get_json()
    visual_config = config.get('visual')
    page_filters = config.get('pageFilters', [])
    visual_filters = visual_config.get('filters', [])
    final_query = 'Query não gerada'

    if not visual_config:
        return jsonify({"message": "Configuração do visual é obrigatória."}), 400

    conn = get_db_connection()
    try:
        tables_in_visual, fields_to_select = set(), []
        agg_map = {'sum': 'SUM', 'average': 'AVG', 'count': 'COUNT', 'countd': 'COUNT(DISTINCT', 'min': 'MIN', 'max': 'MAX', 'first': 'MIN', 'last': 'MAX'}

        data_field_keys = ['value', 'values', 'xAxis', 'yAxis', 'legend', 'minValue', 'maxValue', 'columns', 'rows', 'columnValues']

        for key, field_value in visual_config.items():
            if key in data_field_keys:
                items = field_value if isinstance(field_value, list) else ([field_value] if isinstance(field_value, dict) and 'tableName' in field_value else [])
                for item in items:
                    if item and 'tableName' in item:
                        tables_in_visual.add(item['tableName'])
                        fields_to_select.append(item)
        
        for f in page_filters + visual_filters:
            if f and 'tableName' in f:
                tables_in_visual.add(f['tableName'])


        if not tables_in_visual:
            return jsonify({"data": [], "query": "Nenhuma tabela necessária."})

        main_table = list(tables_in_visual)[0]
        
        relationships = conn.execute("SELECT * FROM bi_relacionamentos").fetchall()
        join_clauses = find_join_path(main_table, tables_in_visual, relationships)
        from_clause = f'FROM "{main_table}" ' + " ".join(join_clauses)

        select_expressions, group_by_expressions = [], []
        has_aggregation = False

        for field in fields_to_select:
            col_name = f'"{field["tableName"]}"."{field["columnName"]}"'
            alias = f'"{field.get("displayName") or field["columnName"]}"'
            agg = field.get('aggregation')
            
            if agg and agg != 'none' and agg in agg_map:
                select_expressions.append(f'{agg_map[agg]}({col_name}{")" if agg == "countd" else ""}) AS {alias}')
                has_aggregation = True
            else:
                select_expressions.append(f'{col_name} AS {alias}')
                group_by_expressions.append(col_name)
        
        if not select_expressions:
            return jsonify({"data": [], "query": "Nenhuma coluna selecionada."})

        select_clause = "SELECT " + ", ".join(select_expressions)
        
        group_by_clause = ""
        if has_aggregation and group_by_expressions:
            group_by_clause = "GROUP BY " + ", ".join(group_by_expressions)

        all_filters = page_filters + visual_filters
        
        where_filters = [f for f in all_filters if not f.get('isAggregated') and f.get('filterConfig', {}).get('type') != 'top_n']
        having_filters = [f for f in all_filters if f.get('isAggregated') and f.get('filterConfig', {}).get('type') != 'top_n']
        top_n_filter = next((f for f in all_filters if f.get('filterConfig', {}).get('type') == 'top_n'), None)

        where_conditions_str, where_params = build_filter_clause(where_filters, [])
        where_clause = f"WHERE {where_conditions_str}" if where_conditions_str else ""
        
        having_conditions_str, having_params = build_filter_clause(having_filters, [])
        having_clause = f"HAVING {having_conditions_str}" if having_conditions_str else ""
        
        params = where_params + having_params
        
        base_query = f"{select_clause} {from_clause} {where_clause} {group_by_clause} {having_clause}"

        if top_n_filter:
            config = top_n_filter.get('filterConfig', {})
            top_n_config = config.get('topN', {})
            direction = 'DESC' if top_n_config.get('direction') == 'superior' else 'ASC'
            limit = int(top_n_config.get('value', 10))
            
            # --- INÍCIO DA CORREÇÃO ---
            # Para ordenar pelo valor da agregação, precisamos reconstruir a expressão de agregação
            # usada no SELECT, em vez de usar o alias (que pode ser tratado como texto).
            agg_map_order = {'sum': 'SUM', 'average': 'AVG', 'count': 'COUNT', 'countd': 'COUNT(DISTINCT', 'min': 'MIN', 'max': 'MAX'}
            agg_func_order = agg_map_order.get(top_n_filter.get('aggregation'), 'COUNT')
            order_by_expression = f'{agg_func_order}("{top_n_filter["tableName"]}"."{top_n_filter["originalColumn"]}"{")" if top_n_filter.get("aggregation") == "countd" else ""})'
            # --- FIM DA CORREÇÃO ---
            
            final_query = f"{base_query} ORDER BY {order_by_expression} {direction} LIMIT ?"
            params.append(limit)
        else:
            final_query = f"{base_query} LIMIT 1000"
        
        print(f"--- BI Query ---\n{final_query}\nParams: {params}\n----------------")
        
        cursor = conn.cursor()
        results = cursor.execute(final_query, params).fetchall()
        
        data = [dict(row) for row in results]
        return jsonify({"data": data, "query": final_query})

    except sqlite3.Error as e:
        traceback.print_exc()
        return jsonify({"message": f"Erro de banco de dados ao executar a consulta.", "query": final_query}), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({"message": f"Erro inesperado no servidor: {e}"}), 500
    finally:
        if conn: conn.close()

