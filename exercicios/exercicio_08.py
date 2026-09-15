"""
Exercício 08 - Campanha solidária

Recebe as quantidades de alimentos arrecadadas por cinco voluntários
e calcula o total arrecadado na campanha.
"""

total = 0

for voluntario in range(1, 6):
    quantidade = float(input(f"Quantidade arrecadada pelo voluntário {voluntario} (kg): "))
    total += quantidade

print(f"Total arrecadado na campanha: {total} kg")
