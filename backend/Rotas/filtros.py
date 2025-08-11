from flask import Blueprint, jsonify, request
from ..db import get_db_connection

bp = Blueprint('filtros', __name__, url_prefix='/api/filtros')

@bp.route('/opcoes', methods=['GET'])
def get_opcoes_filtros():
    """
    Busca e retorna todas as opções para os filtros.
    Se 'user_contracts_ids' for fornecido, pré-filtra a hierarquia
    para mostrar apenas os dados relevantes para aquele usuário.
    """
    conn = None
    try:
        conn = get_db_connection()
        user_contracts_ids_str = request.args.get('user_contracts')

        all_ccs_rows = conn.execute("SELECT id, cod_cc, nome_cc, tipo, pai_id, estado, gestor, controlador, status FROM centros_custo").fetchall()
        all_ccs = [dict(row) for row in all_ccs_rows]
        
        ccs_para_analise = all_ccs

        if user_contracts_ids_str is not None:
            user_contracts_ids = user_contracts_ids_str.split(',') if user_contracts_ids_str else []
            
            # --- CORREÇÃO PRINCIPAL: Traduz IDs para cod_cc ---
            # 1. Cria um mapa de ID para cod_cc
            id_to_cod_cc_map = {str(cc['id']): cc['cod_cc'] for cc in all_ccs}
            
            # 2. Converte a lista de IDs permitidos para uma lista de cod_cc permitidos
            user_contracts_cod_cc_list = [id_to_cod_cc_map[id_str] for id_str in user_contracts_ids if id_str in id_to_cod_cc_map]

            cc_map = {cc['cod_cc']: cc for cc in all_ccs}
            
            allowed_ccs_codes = set(user_contracts_cod_cc_list)
            allowed_nucleos_codes = set()
            allowed_supers_codes = set()

            for cc_code in user_contracts_cod_cc_list:
                contrato = cc_map.get(cc_code)
                if contrato and contrato.get('pai_id'):
                    nucleo = cc_map.get(contrato['pai_id'])
                    if nucleo:
                        allowed_nucleos_codes.add(nucleo['cod_cc'])
                        if nucleo.get('pai_id'):
                            superintendencia = cc_map.get(nucleo['pai_id'])
                            if superintendencia:
                                allowed_supers_codes.add(superintendencia['cod_cc'])
            
            all_allowed_codes = allowed_ccs_codes.union(allowed_nucleos_codes).union(allowed_supers_codes)
            
            ccs_para_analise = [cc for cc in all_ccs if cc['cod_cc'] in all_allowed_codes]

        controladores = sorted(list(set(c['controlador'] for c in ccs_para_analise if c['controlador'])))
        gestores = sorted(list(set(c['gestor'] for c in ccs_para_analise if c['gestor'])))
        estados = sorted(list(set(c['estado'] for c in ccs_para_analise if c['tipo'].lower().strip() == 'contrato' and c['estado'])))

        return jsonify({
            'lista_completa_ccs': ccs_para_analise,
            'controladores': controladores,
            'gestores': gestores,
            'estados': estados
        })

    except Exception as e:
        print(f"Erro na rota /filtros/opcoes: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        if conn:
            conn.close()
