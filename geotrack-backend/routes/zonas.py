from flask import Blueprint, request, jsonify
from models import ZonaSegura

zonas_bp = Blueprint('zonas', __name__)

@zonas_bp.route('/', methods=['POST'])
def crear_zona():
    data = request.json
    
    try:
        zona_id = ZonaSegura.crear(
            data['usuario_id'],
            data['nombre'],
            data['latitud'],
            data['longitud'],
            data['radio']
        )
        return jsonify({'success': True, 'zona_id': zona_id}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@zonas_bp.route('/usuario/<int:usuario_id>', methods=['GET'])
def obtener_zonas(usuario_id):
    zonas = ZonaSegura.obtener_por_usuario(usuario_id)
    return jsonify({'success': True, 'zonas': zonas})

@zonas_bp.route('/<int:zona_id>', methods=['DELETE'])
def eliminar_zona(zona_id):
    ZonaSegura.eliminar(zona_id)
    return jsonify({'success': True})