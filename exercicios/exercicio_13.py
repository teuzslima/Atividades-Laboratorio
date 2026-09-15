"""
Exercício 13 - Consumo de energia elétrica

Lê o consumo mensal de energia elétrica de dois setores e informa
qual foi o maior valor registrado.
"""

consumo1 = float(input("Consumo do setor 1 (kWh): "))
consumo2 = float(input("Consumo do setor 2 (kWh): "))

if consumo1 > consumo2:
    print(f"O setor 1 apresentou o maior consumo: {consumo1} kWh")
elif consumo2 > consumo1:
    print(f"O setor 2 apresentou o maior consumo: {consumo2} kWh")
else:
    print(f"Os dois setores apresentaram o mesmo consumo: {consumo1} kWh")
