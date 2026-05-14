import numpy as np
import matplotlib.pyplot as plt

# --- Configuración inicial ---
# Definimos los puntos de control como arreglos de numpy
P0 = np.array([0.0, 0.0])
P1 = np.array([2.0, 4.0])
P2 = np.array([4.0, 0.0])


# ==========================================
# a) Implementar la función de la curva
# ==========================================
def bezier_cuadratica(P0, P1, P2, t):
    """
    Evalúa la curva de Bézier cuadrática en el parámetro t usando la fórmula polinómica.
    """
    return (1 - t)**2 * P0 + 2 * (1 - t) * t * P1 + t**2 * P2


# ==========================================
# b) Evaluar la curva para 100 valores de t
# ==========================================
# Generamos 100 valores linealmente espaciados entre 0 y 1
t_100 = np.linspace(0, 1, 100)

# Evaluamos la función para cada valor de t
puntos_curva = np.array([bezier_cuadratica(P0, P1, P2, t) for t in t_100])


# ==========================================
# c) Graficar los elementos en un mismo plano
# ==========================================
plt.figure(figsize=(8, 6))

# 1. Graficar la curva (puntos calculados en el inciso b)
plt.plot(puntos_curva[:, 0], puntos_curva[:, 1], label='Curva de Bézier $B(t)$', color='blue', linewidth=2)

# 2. Graficar la poligonal de control (conectando P0-P1 y P1-P2)
# Extraemos las coordenadas X e Y de los puntos de control
x_control = [P0[0], P1[0], P2[0]]
y_control = [P0[1], P1[1], P2[1]]
plt.plot(x_control, y_control, label='Poligonal de control', color='gray', linestyle='--')

# 3. Graficar los puntos de control
plt.scatter(x_control, y_control, color='red', zorder=5)
plt.text(P0[0] - 0.1, P0[1] - 0.3, 'P0 (0,0)', fontsize=11, fontweight='bold')
plt.text(P1[0] - 0.2, P1[1] + 0.2, 'P1 (2,4)', fontsize=11, fontweight='bold')
plt.text(P2[0] - 0.1, P2[1] - 0.3, 'P2 (4,0)', fontsize=11, fontweight='bold')

# Detalles del gráfico
plt.title('Implementación de Curva de Bézier Cuadrática', fontsize=14)
plt.xlabel('Eje X')
plt.ylabel('Eje Y')
plt.grid(True, linestyle=':', alpha=0.7)
plt.legend()
plt.axis('equal') # Mantiene la proporción geométrica
plt.show()


# ==========================================
# d) Construcción iterada (Algoritmo de De Casteljau) y comparación
# ==========================================

def interpolacion_lineal(A, B, t):
    """Interpola linealmente entre dos puntos A y B dado un parámetro t."""
    return (1 - t) * A + t * B

def de_casteljau(P0, P1, P2, t):
    """
    Evalúa la curva cuadrática usando la construcción iterada (De Casteljau).
    """
    # Primera iteración
    L0 = interpolacion_lineal(P0, P1, t)
    L1 = interpolacion_lineal(P1, P2, t)
    # Segunda iteración
    return interpolacion_lineal(L0, L1, t)

# Evaluamos y comparamos para 10 valores de t
t_10 = np.linspace(0, 1, 10)

print("Comparación de métodos de evaluación de la curva:")
print(f"{'t':<6} | {'Fórmula Explícita (a)':<25} | {'Método Iterado (d)':<25} | {'Diferencia Máx'}")
print("-" * 75)

for t in t_10:
    # Resultado con el método del inciso a
    res_a = bezier_cuadratica(P0, P1, P2, t)
    # Resultado con el método iterado del inciso d
    res_d = de_casteljau(P0, P1, P2, t)
    
    # Calculamos la diferencia absoluta máxima entre ambos resultados
    diferencia = np.max(np.abs(res_a - res_d))
    
    # Formateamos la salida
    str_a = f"({res_a[0]:.4f}, {res_a[1]:.4f})"
    str_d = f"({res_d[0]:.4f}, {res_d[1]:.4f})"
    
    print(f"{t:<6.4f} | {str_a:<25} | {str_d:<25} | {diferencia:.1e}")