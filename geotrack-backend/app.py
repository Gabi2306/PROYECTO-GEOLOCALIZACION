from flask import Flask
from flask_cors import CORS
from routes.auth import auth_bp
from routes.dispositivos import dispositivos_bp
from routes.ubicaciones import ubicaciones_bp
from routes.zonas import zonas_bp
from routes.alertas import alertas_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(dispositivos_bp, url_prefix='/api/dispositivos')
app.register_blueprint(ubicaciones_bp, url_prefix='/api/ubicaciones')
app.register_blueprint(zonas_bp, url_prefix='/api/zonas')
app.register_blueprint(alertas_bp, url_prefix='/api/alertas')

@app.route('/')
def index():
    return {'message': 'GeoTrack API v1.0', 'status': 'running'}

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)