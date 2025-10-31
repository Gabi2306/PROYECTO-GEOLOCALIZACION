from database import execute_query
import bcrypt

class Usuario:
    @staticmethod
    def crear(nombre, email, password, telefono=None):
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        query = "INSERT INTO usuarios (nombre, email, password, telefono) VALUES (%s, %s, %s, %s)"
        return execute_query(query, (nombre, email, hashed, telefono))
    
    @staticmethod
    def obtener_por_email(email):
        query = "SELECT * FROM usuarios WHERE email = %s"
        return execute_query(query, (email,), fetch_one=True)
    
    @staticmethod
    def verificar_password(password, hashed):
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

class Dispositivo:
    @staticmethod
    def crear(usuario_id, nombre, imei, token):
        query = "INSERT INTO dispositivos (usuario_id, nombre, imei, token) VALUES (%s, %s, %s, %s)"
        return execute_query(query, (usuario_id, nombre, imei, token))
    
    @staticmethod
    def obtener_por_usuario(usuario_id, incluir_inactivos=False):
        if incluir_inactivos:
            query = "SELECT * FROM dispositivos WHERE usuario_id = %s"
            return execute_query(query, (usuario_id,), fetch_all=True)
        else:
            query = "SELECT * FROM dispositivos WHERE usuario_id = %s AND activo = 1"
            return execute_query(query, (usuario_id,), fetch_all=True)
    
    @staticmethod
    def obtener_por_token(token):
        query = "SELECT * FROM dispositivos WHERE token = %s AND activo = 1"
        return execute_query(query, (token,), fetch_one=True)

    @staticmethod
    def activar(dispositivo_id):
        query = "UPDATE dispositivos SET activo = 1 WHERE id = %s"
        return execute_query(query, (dispositivo_id,))

    @staticmethod
    def desactivar(dispositivo_id):
        query = "UPDATE dispositivos SET activo = 0 WHERE id = %s"
        return execute_query(query, (dispositivo_id,))

    @staticmethod
    def eliminar(dispositivo_id):
        query = "DELETE FROM dispositivos WHERE id = %s"
        return execute_query(query, (dispositivo_id,))

class Ubicacion:
    @staticmethod
    def crear(dispositivo_id, latitud, longitud, velocidad=0, altitud=None):
        if altitud is None:
            query = "INSERT INTO ubicaciones (dispositivo_id, latitud, longitud, velocidad) VALUES (%s, %s, %s, %s)"
            return execute_query(query, (dispositivo_id, latitud, longitud, velocidad))
        else:
            query = "INSERT INTO ubicaciones (dispositivo_id, latitud, longitud, velocidad, altitud) VALUES (%s, %s, %s, %s, %s)"
            return execute_query(query, (dispositivo_id, latitud, longitud, velocidad, altitud))
    
    @staticmethod
    def obtener_ultima(dispositivo_id):
        query = "SELECT * FROM ubicaciones WHERE dispositivo_id = %s ORDER BY timestamp DESC LIMIT 1"
        return execute_query(query, (dispositivo_id,), fetch_one=True)
    
    @staticmethod
    def obtener_historial(dispositivo_id, limit=100):
        query = "SELECT * FROM ubicaciones WHERE dispositivo_id = %s ORDER BY timestamp DESC LIMIT %s"
        return execute_query(query, (dispositivo_id, limit), fetch_all=True)

class ZonaSegura:
    @staticmethod
    def crear(usuario_id, nombre, latitud, longitud, radio):
        query = "INSERT INTO zonas_seguras (usuario_id, nombre, latitud, longitud, radio) VALUES (%s, %s, %s, %s, %s)"
        return execute_query(query, (usuario_id, nombre, latitud, longitud, radio))
    
    @staticmethod
    def obtener_por_usuario(usuario_id):
        query = "SELECT * FROM zonas_seguras WHERE usuario_id = %s AND activa = 1"
        return execute_query(query, (usuario_id,), fetch_all=True)
    
    @staticmethod
    def eliminar(zona_id):
        query = "UPDATE zonas_seguras SET activa = 0 WHERE id = %s"
        return execute_query(query, (zona_id,))

class Alerta:
    @staticmethod
    def crear(dispositivo_id, tipo, nivel, mensaje, latitud=None, longitud=None):
        query = "INSERT INTO alertas (dispositivo_id, tipo, nivel, mensaje, latitud, longitud) VALUES (%s, %s, %s, %s, %s, %s)"
        return execute_query(query, (dispositivo_id, tipo, nivel, mensaje, latitud, longitud))
    
    @staticmethod
    def obtener_por_dispositivo(dispositivo_id, limit=50):
        query = "SELECT * FROM alertas WHERE dispositivo_id = %s ORDER BY timestamp DESC LIMIT %s"
        return execute_query(query, (dispositivo_id, limit), fetch_all=True)
    
    @staticmethod
    def marcar_leida(alerta_id):
        query = "UPDATE alertas SET leida = 1 WHERE id = %s"
        return execute_query(query, (alerta_id,))
