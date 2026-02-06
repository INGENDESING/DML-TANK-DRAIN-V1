
# Base de datos de tuberías para el proyecto de cálculo de vaciado de tanques.
# Incluye dimensiones estándar para BPE, ANSI/ASME y DIN.

PIPES_DB = {
    "BPE": {
        "description": "ASME BPE (Bioprocessing Equipment) - Stainless Steel 316L",
        "roughness": 0.0000015, # 1.5 micras Rz aprox (sanitaria)
        "dimensions": {
            # Nominal Size (inch): {"od_mm": X, "thickness_mm": Y, "id_mm": Z}
            "1.0": {"od_mm": 25.4, "thickness_mm": 1.65, "id_mm": 22.1},
            "1.5": {"od_mm": 38.1, "thickness_mm": 1.65, "id_mm": 34.8},
            "2.0": {"od_mm": 50.8, "thickness_mm": 1.65, "id_mm": 47.5},
            "2.5": {"od_mm": 63.5, "thickness_mm": 1.65, "id_mm": 60.2},
            "3.0": {"od_mm": 76.2, "thickness_mm": 1.65, "id_mm": 72.9},
            "4.0": {"od_mm": 101.6, "thickness_mm": 2.11, "id_mm": 97.38},
            "6.0": {"od_mm": 152.4, "thickness_mm": 2.77, "id_mm": 146.86},
        }
    },
    "ANSI_SCH40": {
        "description": "ASME B36.10M Schedule 40 - Carbon/Stainless Steel",
        "roughness": 0.000045, # 45 micras (Acero comercial)
        "dimensions": {
            "1.0": {"od_mm": 33.4, "thickness_mm": 3.38, "id_mm": 26.64},
            "1.5": {"od_mm": 48.3, "thickness_mm": 3.68, "id_mm": 40.94},
            "2.0": {"od_mm": 60.3, "thickness_mm": 3.91, "id_mm": 52.48},
            "2.5": {"od_mm": 73.0, "thickness_mm": 5.16, "id_mm": 62.68},
            "3.0": {"od_mm": 88.9, "thickness_mm": 5.49, "id_mm": 77.92},
            "4.0": {"od_mm": 114.3, "thickness_mm": 6.02, "id_mm": 102.26},
            "6.0": {"od_mm": 168.3, "thickness_mm": 7.11, "id_mm": 154.08},
             "8.0": {"od_mm": 219.1, "thickness_mm": 8.18, "id_mm": 202.74},
        }
    },
    "DIN_11850_R2": {
        "description": "DIN 11850 Range 2 (Sanitary) - Stainless Steel",
        "roughness": 0.0000015,
        "dimensions": {
            "DN25": {"od_mm": 29.0, "thickness_mm": 1.5, "id_mm": 26.0},
            "DN40": {"od_mm": 41.0, "thickness_mm": 1.5, "id_mm": 38.0},
            "DN50": {"od_mm": 53.0, "thickness_mm": 1.5, "id_mm": 50.0},
            "DN65": {"od_mm": 70.0, "thickness_mm": 2.0, "id_mm": 66.0},
            "DN80": {"od_mm": 85.0, "thickness_mm": 2.0, "id_mm": 81.0},
            "DN100": {"od_mm": 104.0, "thickness_mm": 2.0, "id_mm": 100.0},
            "DN125": {"od_mm": 129.0, "thickness_mm": 2.0, "id_mm": 125.0},
            "DN150": {"od_mm": 154.0, "thickness_mm": 2.0, "id_mm": 150.0},
        }
    }
}

def get_pipe_id(standard, size):
    """Retorna el diámetro interno en metros."""
    try:
        data = PIPES_DB[standard]["dimensions"][size]
        return data["id_mm"] / 1000.0
    except KeyError:
        return None
