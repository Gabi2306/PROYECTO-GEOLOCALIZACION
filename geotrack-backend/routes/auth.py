from flask import Blueprint, request, jsonify
from models import Usuario
import jwt
from config import Config

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    
    try:
        usuario_id = Usuario.crear(
            data['nombre'],
            data['email'],
            data['password'],
            data.get('telefono')
        )
        return jsonify({'success': True, 'usuario_id': usuario_id}), 201
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    
    usuario = Usuario.obtener_por_email(data['email'])
    
    if not usuario:
        return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404
    
    if not Usuario.verificar_password(data['password'], usuario['password']):
        return jsonify({'success': False, 'error': 'Contraseña incorrecta'}), 401
    
    token = jwt.encode({'usuario_id': usuario['id']}, Config.SECRET_KEY, algorithm='HS256')
    
    return jsonify({
        'success': True,
        'token': token,
        'usuario': {
            'id': usuario['id'],
            'nombre': usuario['nombre'],
            'email': usuario['email']
        }
    })