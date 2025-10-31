from flask import Blueprint, request, jsonify
from models import Dispositivo
from utils.helpers import generar_token

dispositivos_bp = Blueprint('dispositivos', __name__)

@dispositivos_bp.route('/', methods=['POST'])
def crear_dispositivo():
    data = request.json
    try:
        token = generar_token()
        dispositivo_id = Dispositivo.crear(
            data['usuario_id'],
            data['nombre'],
            data['imei'],
            token
        )
        return jsonify({
            'success': True,
            'dispositivo_id': dispositivo_id,
            'token': token
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@dispositivos_bp.route('/usuario/<int:usuario_id>', methods=['GET'])
def obtener_dispositivos(usuario_id):
    incluir_inactivos = request.args.get('all', default='0') == '1'
    dispositivos = Dispositivo.obtener_por_usuario(usuario_id, incluir_inactivos=incluir_inactivos)
    return jsonify({'success': True, 'dispositivos': dispositivos})

@dispositivos_bp.route('/<int:dispositivo_id>/activar', methods=['PUT'])
def activar_dispositivo(dispositivo_id):
    try:
        Dispositivo.activar(dispositivo_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@dispositivos_bp.route('/<int:dispositivo_id>/desactivar', methods=['PUT'])
def desactivar_dispositivo(dispositivo_id):
    try:
        Dispositivo.desactivar(dispositivo_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@dispositivos_bp.route('/<int:dispositivo_id>', methods=['DELETE'])
def eliminar_dispositivo(dispositivo_id):
    try:
        Dispositivo.eliminar(dispositivo_id)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400
