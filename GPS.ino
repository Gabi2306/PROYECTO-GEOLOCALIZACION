#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_BMP085.h>

const char* ssid = "moto g34 Gabi"; 
const char* password = "gabi2024";

const char* serverUrl = "http://10.16.19.196:5000/api/ubicaciones/push";
const char* alertasUrl = "http://10.16.19.196:5000/api/alertas/dispositivo/2";
const char* deviceToken = "t3n21uPAPiytVxajyotrGsvMkA6DacjmNcnAY4l1UTI";

const int BUZZER_PIN = 25;
const int SDA_PIN = 21;
const int SCL_PIN = 22;

TinyGPSPlus gps;
HardwareSerial SerialGPS(2);
Adafruit_BMP085 bmp;

float latitud = 0.0;
float longitud = 0.0;
float velocidad = 0.0;
float altitudGPS = 0.0;
float altitudBMP = 0.0;
float presion = 0.0;
float temperatura = 0.0;
bool gpsValido = false;
bool bmpValido = false;
int enviosExitosos = 0;
int enviosFallidos = 0;
bool hayAlertasNoLeidas = false;

unsigned long lastSendTime = 0;
const unsigned long sendInterval = 30000;

unsigned long lastAlertCheck = 0;
const unsigned long alertCheckInterval = 10000;

unsigned long lastBuzzerTime = 0;
const unsigned long buzzerInterval = 5000;

unsigned long lastGPSDebug = 0;
const unsigned long gpsDebugInterval = 60000;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  
  Serial.println("\n========================================");
  Serial.println("    GPS TRACKER - Sistema Iniciado");
  Serial.println("========================================\n");
  
  Serial.println("Buzzer: GPIO 25 configurado");
  
  Wire.begin(SDA_PIN, SCL_PIN);
  
  if (bmp.begin()) {
    bmpValido = true;
    Serial.println("BMP180: Inicializado correctamente");
    Serial.println("   SDA: GPIO 21");
    Serial.println("   SCL: GPIO 22");
  } else {
    Serial.println("BMP180: ERROR - No detectado");
    Serial.println("   Verifica conexiones I2C");
  }
  
  SerialGPS.begin(9600, SERIAL_8N1, 16, 17);
  delay(1000);
  
  Serial.println("GPS M8N: Inicializado (9600 baud)");
  Serial.println("   RX: GPIO 16");
  Serial.println("   TX: GPIO 17");
  
  conectarWiFi();
  
  Serial.println("\nSistema listo");
  Serial.println("Enviara ubicacion cada 30 segundos");
  Serial.println("Verificara alertas cada 10 segundos\n");
  Serial.println("========================================\n");
  
  testBuzzer();
  testBMP180();
}

void loop() {
  while (SerialGPS.available() > 0) {
    gps.encode(SerialGPS.read());
  }
  
  if (gps.location.isUpdated()) {
    latitud = gps.location.lat();
    longitud = gps.location.lng();
    velocidad = gps.speed.kmph();
    altitudGPS = gps.altitude.meters();
    gpsValido = true;
    
    if (bmpValido) {
      leerBMP180();
    }
    
    Serial.printf("GPS actualizado: %.6f, %.6f | %d sats | %.1f km/h | Alt GPS: %.1fm", 
                  latitud, longitud, gps.satellites.value(), velocidad, altitudGPS);
    
    if (bmpValido) {
      Serial.printf(" | Alt BMP: %.1fm\n", altitudBMP);
    } else {
      Serial.println();
    }
  }
  
  if (millis() - lastGPSDebug >= gpsDebugInterval) {
    mostrarResumen();
    lastGPSDebug = millis();
  }
  
  if (millis() - lastSendTime >= sendInterval) {
    if (gpsValido && gps.location.isValid()) {
      Serial.println("\n========================================");
      Serial.println("     ENVIANDO UBICACION AL SERVIDOR");
      Serial.println("========================================");
      enviarUbicacion();
      lastSendTime = millis();
    } else {
      Serial.println("Esperando senal GPS valida... (" + String(gps.satellites.value()) + " sats)");
      lastSendTime = millis();
    }
  }
  
  if (millis() - lastAlertCheck >= alertCheckInterval) {
    verificarAlertas();
    lastAlertCheck = millis();
  }
  
  if (hayAlertasNoLeidas && (millis() - lastBuzzerTime >= buzzerInterval)) {
    pitarAlerta();
    lastBuzzerTime = millis();
  }
  
  delay(10);
}

void conectarWiFi() {
  Serial.print("Conectando WiFi");
  WiFi.begin(ssid, password);
  
  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 30) {
    delay(500);
    Serial.print(".");
    intentos++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" OK");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println(" ERROR");
    Serial.println("Error WiFi - Continuara intentando");
  }
}

void leerBMP180() {
  temperatura = bmp.readTemperature();
  presion = bmp.readPressure() / 100.0;
  altitudBMP = bmp.readAltitude();
}

void testBMP180() {
  if (!bmpValido) {
    Serial.println("Test BMP180: OMITIDO (sensor no disponible)\n");
    return;
  }
  
  Serial.println("Test de BMP180...");
  
  leerBMP180();
  
  Serial.printf("   Temperatura: %.1f C\n", temperatura);
  Serial.printf("   Presion: %.1f hPa\n", presion);
  Serial.printf("   Altitud: %.1f m\n", altitudBMP);
  Serial.println("BMP180 OK\n");
}

void enviarUbicacion() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi desconectado. Reconectando...");
    conectarWiFi();
    if (WiFi.status() != WL_CONNECTED) {
      enviosFallidos++;
      return;
    }
  }
  
  if (bmpValido) {
    leerBMP180();
  }
  
  HTTPClient http;
  http.setTimeout(10000);
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", deviceToken);
  
  String payload = "{";
  payload += "\"latitud\":" + String(latitud, 6) + ",";
  payload += "\"longitud\":" + String(longitud, 6) + ",";
  payload += "\"velocidad\":" + String(velocidad, 2) + ",";
  float altitudParaEnviar = bmpValido ? altitudBMP : altitudGPS;
  if (!isfinite(altitudParaEnviar)) altitudParaEnviar = 0.0;
  payload += "\"altitud\":" + String(altitudParaEnviar, 2);
  payload += "}";

  
  Serial.println("\nDatos a enviar:");
  Serial.printf("   Latitud:  %.6f\n", latitud);
  Serial.printf("   Longitud: %.6f\n", longitud);
  Serial.printf("   Velocidad: %.1f km/h\n", velocidad);
  Serial.printf("   Satelites: %d\n", gps.satellites.value());
  Serial.printf("   Altitud GPS: %.1f m\n", altitudGPS);
  
  if (bmpValido) {
    Serial.printf("   Altitud BMP180: %.1f m\n", altitudBMP);
    Serial.printf("   Presion: %.1f hPa\n", presion);
    Serial.printf("   Temperatura: %.1f C\n", temperatura);
  }
  
  if (gps.time.isValid()) {
    Serial.printf("   Hora GPS: %02d:%02d:%02d\n", 
                  gps.time.hour(), gps.time.minute(), gps.time.second());
  }
  
  Serial.println("\nEnviando...");
  
  int httpCode = http.POST(payload);
  
  Serial.println("\n----------------------------------------");
  
  if (httpCode > 0) {
    if (httpCode == 200 || httpCode == 201) {
      enviosExitosos++;
      Serial.println("UBICACION ENVIADA EXITOSAMENTE");
      Serial.print("Codigo HTTP: ");
      Serial.println(httpCode);
      
      String response = http.getString();
      if (response.length() < 100) {
        Serial.print("Respuesta: ");
        Serial.println(response);
      }
      
      Serial.println("----------------------------------------");
      Serial.printf("Envios exitosos: %d | Fallidos: %d\n", enviosExitosos, enviosFallidos);
    } else {
      enviosFallidos++;
      Serial.println("ERROR DEL SERVIDOR");
      Serial.print("Codigo HTTP: ");
      Serial.println(httpCode);
      Serial.println("Respuesta: " + http.getString());
      Serial.println("----------------------------------------");
    }
  } else {
    enviosFallidos++;
    Serial.println("ERROR DE CONEXION");
    Serial.print("Error: ");
    Serial.println(http.errorToString(httpCode));
    Serial.println("----------------------------------------");
  }
  
  Serial.println("\nProximo envio en 30 segundos...\n");
  
  http.end();
}

void verificarAlertas() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  HTTPClient http;
  http.setTimeout(5000);
  http.begin(alertasUrl);
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    
    DynamicJsonDocument doc(4096);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error) {
      bool alertasNoLeidas = false;
      int countNoLeidas = 0;
      
      if (doc["success"] == true && doc.containsKey("alertas")) {
        JsonArray alertas = doc["alertas"].as<JsonArray>();
        
        for (JsonObject alerta : alertas) {
          if (alerta["leida"] == false || alerta["leida"] == 0) {
            alertasNoLeidas = true;
            countNoLeidas++;
          }
        }
      }
      
      if (alertasNoLeidas && !hayAlertasNoLeidas) {
        Serial.println("\n!!! ALERTA DETECTADA !!!");
        Serial.printf("Total alertas no leidas: %d\n", countNoLeidas);
        Serial.println("El buzzer sonara cada 5 segundos\n");
        pitarAlerta();
      } else if (!alertasNoLeidas && hayAlertasNoLeidas) {
        Serial.println("\nAlertas resueltas - Buzzer desactivado\n");
      }
      
      hayAlertasNoLeidas = alertasNoLeidas;
    }
  }
  
  http.end();
}

void pitarAlerta() {
  Serial.println("*** ALERTA ACTIVA - BUZZER ***");
  
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(200);
    digitalWrite(BUZZER_PIN, LOW);
    delay(200);
  }
}

void testBuzzer() {
  Serial.println("Test de buzzer...");
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);
  Serial.println("Buzzer OK\n");
}

void mostrarResumen() {
  Serial.println("\n========================================");
  Serial.println("         RESUMEN DEL SISTEMA");
  Serial.println("========================================");
  
  Serial.print("WiFi: ");
  Serial.println(WiFi.status() == WL_CONNECTED ? "Conectado" : "Desconectado");
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("   IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("   Senal: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  }
  
  Serial.print("\nGPS M8N: ");
  Serial.println(gps.location.isValid() ? "Fix obtenido" : "Buscando senal");
  
  if (gps.location.isValid()) {
    Serial.printf("   Posicion: %.6f, %.6f\n", latitud, longitud);
    Serial.print("   Satelites: ");
    Serial.println(gps.satellites.value());
    Serial.print("   Precision HDOP: ");
    Serial.println(gps.hdop.hdop());
    Serial.printf("   Altitud GPS: %.1f m\n", altitudGPS);
  }
  
  Serial.print("\nBMP180: ");
  Serial.println(bmpValido ? "Operativo" : "No disponible");
  
  if (bmpValido) {
    Serial.printf("   Altitud: %.1f m\n", altitudBMP);
    Serial.printf("   Presion: %.1f hPa\n", presion);
    Serial.printf("   Temperatura: %.1f C\n", temperatura);
  }
  
  Serial.print("\nAlertas: ");
  Serial.println(hayAlertasNoLeidas ? "ACTIVAS (buzzer sonando)" : "Sin alertas");
  
  Serial.print("\nEstadisticas:");
  Serial.printf("\n   Envios exitosos: %d\n", enviosExitosos);
  Serial.printf("   Envios fallidos: %d\n", enviosFallidos);
  Serial.printf("   Uptime: %lu min\n", millis() / 60000);
  
  Serial.println("\n========================================\n");
}
