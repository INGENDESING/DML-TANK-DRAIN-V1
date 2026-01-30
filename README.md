# Cálculo Dinámico de Vaciado de Tanques

Aplicación Web de Ingeniería para el cálculo de tiempos de vaciado de tanques en régimen transitorio.

## Créditos

**Empresa**: DML Ingenieros Consultores  
**Autor**: Jonathan Arboleda Genes, Msc Chemical Engineering

## Descripción

Esta herramienta permite simular el vaciado de un tanque atmosférico considerando la geometría (fondo torisférico), tuberías de descarga, pérdidas por accesorios y válvulas, y la curva de operación de la bomba.

### Características Principales

- Base de datos de tuberías (BPE, ANSI, DIN) y válvulas.
- Animación dinámica del proceso (GA1).
- Verificación de NPSH y cavitación.
- Interfaz moderna (Windows Dark Mode).

## Ejecución

1. Instalar dependencias:

   ```bash
   pip install -r requirements.txt
   ```

2. Ejecutar la aplicación:

   ```bash
   python main.py
   ```
