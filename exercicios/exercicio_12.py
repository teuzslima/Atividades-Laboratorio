"""
Exercício 12 - Radar eletrônico

Lê a velocidade de um veículo e informa se ele ultrapassou o limite
permitido. A velocidade máxima permitida no trecho é de 80 km/h.
"""

LIMITE = 80

velocidade = float(input("Digite a velocidade registrada do veículo (km/h): "))

if velocidade > LIMITE:
    print(f"Excesso de velocidade! O veículo ultrapassou o limite de {LIMITE} km/h.")
else:
    print("Velocidade dentro do limite permitido.")
