from flask import Blueprint, request, jsonify
from models import Dispositivo, Ubicacion, ZonaSegura, Alerta
from utils.helpers import esta_en_zona_segura
from config import Config

ubicaciones_bp = Blueprint('ubicaciones', __name__)

@ubicaciones_bp.route('/push', methods=['POST'])
def recibir_ubicacion():
    data = request.json
    token = request.headers.get('Authorization')
    
    if not token:
        return jsonify({'success': False, 'error': 'Token requerido'}), 401
    
    dispositivo = Dispositivo.obtener_por_token(token)
    
    if not dispositivo:
        return jsonify({'success': False, 'error': 'Dispositivo no autorizado'}), 403
    
    try:
        altitud = data.get('altitud', 0)

        ubicacion_id = Ubicacion.crear(
           dispositivo['id'],
           data['latitud'],
           data['longitud'],
           data.get('velocidad', 0),
           altitud
        ) 
        
        zonas = ZonaSegura.obtener_por_usuario(dispositivo['usuario_id'])
        
        if not esta_en_zona_segura(data['latitud'], data['longitud'], zonas):
            Alerta.crear(
                dispositivo['id'],
                'fuera_zona_segura',
                2,
                'El dispositivo está fuera de las zonas seguras',
                data['latitud'],
                data['longitud']
            )
        
        if data.get('velocidad', 0) > Config.ALERT_SPEED_THRESHOLD:
            Alerta.crear(
                dispositivo['id'],
                'velocidad_alta',
                2,
                f'Velocidad inusual detectada: {data["velocidad"]} km/h',
                data['latitud'],
                data['longitud']
            )
        
        return jsonify({'success': True, 'ubicacion_id': ubicacion_id})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@ubicaciones_bp.route('/dispositivo/<int:dispositivo_id>/ultima', methods=['GET'])
def obtener_ultima_ubicacion(dispositivo_id):
    ubicacion = Ubicacion.obtener_ultima(dispositivo_id)
    return jsonify({'success': True, 'ubicacion': ubicacion})

@ubicaciones_bp.route('/dispositivo/<int:dispositivo_id>/historial', methods=['GET'])
def obtener_historial(dispositivo_id):
    limit = request.args.get('limit', 100, type=int)
    ubicaciones = Ubicacion.obtener_historial(dispositivo_id, limit)
    return jsonify({'success': True, 'ubicaciones': ubicaciones})

