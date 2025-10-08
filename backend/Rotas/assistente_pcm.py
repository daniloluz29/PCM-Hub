# backend/Rotas/assistente_pcm.py
from flask import Blueprint, jsonify, request
import time

bp = Blueprint('assistente_pcm', __name__, url_prefix='/api/assistente')

@bp.route('/chat', methods=['POST'])
def handle_chat_message():
    """
    Recebe o histórico da conversa, processa a mensagem do usuário
    e retorna uma resposta simulada da IA.
    """
    data = request.get_json()
    chat_history = data.get('history', [])

    if not chat_history:
        return jsonify({"error": "O histórico da conversa está vazio."}), 400

    # A mensagem mais recente do usuário é a última na lista
    user_message = chat_history[-1]['text']

    # --- PONTO DE INTEGRAÇÃO COM A IA ---
    # Aqui é onde você faria a chamada para o seu modelo de linguagem (ex: OpenAI, Gemini, etc.)
    # Você passaria o `chat_history` (ou uma versão processada dele) como contexto.
    
    # Para este exemplo, vamos apenas simular uma resposta.
    time.sleep(1.5) # Simula o tempo de processamento da IA

    response_text = f"Resposta simulada para a sua pergunta: '{user_message}'. O contexto com {len(chat_history)} mensagem(ns) foi recebido."

    return jsonify({"response": response_text})

