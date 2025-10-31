import math
import secrets

def calcular_distancia(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c

def esta_en_zona_segura(lat, lon, zonas):
    for zona in zonas:
        distancia = calcular_distancia(lat, lon, float(zona['latitud']), float(zona['longitud']))
        if distancia <= zona['radio']:
            return True
    return False

def generar_token():
    return secrets.token_urlsafe(32)