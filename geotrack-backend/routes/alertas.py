from flask import Blueprint, request, jsonify
from models import Alerta

alertas_bp = Blueprint('alertas', __name__)

@alertas_bp.route('/dispositivo/<int:dispositivo_id>', methods=['GET'])
def obtener_alertas(dispositivo_id):
    limit = request.args.get('limit', 50, type=int)
    alertas = Alerta.obtener_por_dispositivo(dispositivo_id, limit)
    return jsonify({'success': True, 'alertas': alertas})

@alertas_bp.route('/<int:alerta_id>/leer', methods=['PUT'])
def marcar_leida(alerta_id):
    Alerta.marcar_leida(alerta_id)
    return jsonify({'success': True})